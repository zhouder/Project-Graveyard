import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { formatDate } from '../lib/domain';
import { tr } from '../lib/i18n';
import type { AppSettings, GraveProject } from '../shared/types';

type Language = AppSettings['language'];
type Theme = AppSettings['theme'];

interface Cemetery3DProps {
  projects: GraveProject[];
  language: Language;
  theme: Theme;
  onSelect: (project: GraveProject) => void;
  onStatusFilter: (status: GraveProject['status']) => void;
  statusCounts: Record<GraveProject['status'], number>;
  showcase?: boolean;
  onExitShowcase?: () => void;
}

interface GraveObject {
  group: THREE.Group;
  body: THREE.Mesh<THREE.ExtrudeGeometry, THREE.MeshStandardMaterial>;
  outline: THREE.Mesh<THREE.ExtrudeGeometry, THREE.MeshBasicMaterial>;
  project: GraveProject;
  restingY: number;
  restingRotationY: number;
  restingScale: number;
  entranceDelay: number;
}

function text(language: Language, zh: string, en: string) {
  return language === 'en-US' ? en : zh;
}

function stoneDate(value: string) {
  return formatDate(value).split(' ')[0];
}

function createNoiseTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const context = canvas.getContext('2d')!;
  const image = context.createImageData(256, 256);
  for (let index = 0; index < image.data.length; index += 4) {
    const value = 95 + Math.floor(Math.random() * 65);
    image.data[index] = value;
    image.data[index + 1] = value + 3;
    image.data[index + 2] = value;
    image.data[index + 3] = 255;
  }
  context.putImageData(image, 0, 0);
  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(2, 3);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function createInscription(project: GraveProject, language: Language, theme: Theme) {
  const canvas = document.createElement('canvas');
  canvas.width = 1024;
  canvas.height = 768;
  const context = canvas.getContext('2d')!;
  context.clearRect(0, 0, canvas.width, canvas.height);
  context.textAlign = 'center';
  context.textBaseline = 'middle';
  const outline = theme === 'day' ? '#252a2d' : '#101723';
  const panel = theme === 'day' ? '#76798a' : '#59647d';
  const panelLight = theme === 'day' ? '#a2a6b3' : '#808ca6';
  const ink = theme === 'day' ? '#181b1f' : '#111724';
  const statusColor = project.status === 'alive' ? '#86a65a' : project.status === 'sleeping' ? '#c59545' : '#a96c66';
  function drawPanel(x: number, y: number, width: number, height: number, fill: string) {
    context.fillStyle = outline;
    context.roundRect(x - 12, y - 12, width + 24, height + 24, 32);
    context.fill();
    context.fillStyle = fill;
    context.roundRect(x, y, width, height, 24);
    context.fill();
    context.strokeStyle = 'rgba(255,255,255,.2)';
    context.lineWidth = 8;
    context.beginPath();
    context.moveTo(x + 28, y + 15);
    context.lineTo(x + width - 28, y + 15);
    context.stroke();
  }
  drawPanel(65, 20, 894, 238, panel);
  drawPanel(65, 282, 894, 300, panelLight);
  drawPanel(154, 612, 716, 126, statusColor);
  const name = project.name.length > 20 ? `${project.name.slice(0, 19)}…` : project.name;
  const nameSize = name.length > 17 ? 102 : name.length > 12 ? 120 : 140;
  context.font = `900 ${nameSize}px "Cooper Black", "Arial Rounded MT Bold", "STKaiti", "KaiTi", serif`;
  context.lineWidth = 12;
  context.strokeStyle = outline;
  context.strokeText(name.toUpperCase(), 512, 133, 820);
  context.fillStyle = theme === 'day' ? '#d9d9df' : '#dce5f1';
  context.fillText(name.toUpperCase(), 512, 133, 820);

  function drawDateRow(label: string, value: string, y: number) {
    context.textAlign = 'left';
    context.fillStyle = theme === 'day' ? '#3d4148' : '#283044';
    context.font = '900 54px "SF Mono", "Cascadia Mono", Consolas, "Microsoft YaHei UI", monospace';
    context.fillText(label, 118, y, 205);
    context.fillStyle = ink;
    context.font = '900 92px "SF Mono", "Cascadia Mono", Consolas, "Microsoft YaHei UI", monospace';
    context.fillText(value, 325, y, 575);
    context.textAlign = 'center';
  }

  context.fillStyle = ink;
  drawDateRow(text(language, '生', 'BORN'), stoneDate(project.bornAt), 375);
  drawDateRow(text(language, '卒', 'DIED'), project.death ? stoneDate(project.death.date) : text(language, '未宣告', 'NOT DECLARED'), 510);
  context.font = '900 72px "Cooper Black", "Arial Rounded MT Bold", "STKaiti", "KaiTi", serif';
  context.strokeStyle = 'rgba(35,26,17,.65)';
  context.lineWidth = 7;
  const statusText = tr(language, project.status === 'alive' ? 'showcase.alive' : project.status === 'sleeping' ? 'showcase.dormant' : 'showcase.buried');
  context.strokeText(statusText, 512, 675, 650);
  context.fillStyle = '#f5ead1';
  context.fillText(statusText, 512, 675, 650);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 16;
  return texture;
}

function createWoodLabel(label: string, count: number, direction: 1 | -1) {
  const canvas = document.createElement('canvas');
  canvas.width = 768;
  canvas.height = 180;
  const context = canvas.getContext('2d')!;
  const centerX = direction === 1 ? 350 : 420;
  const labelFont = '900 92px "Cooper Black", "Arial Rounded MT Bold", "STKaiti", "KaiTi", serif';
  const countFont = '800 70px "Segoe UI", "SF Mono", "Cascadia Mono", Consolas, sans-serif';
  const countText = `· ${count}`;
  context.font = labelFont;
  const labelWidth = Math.min(context.measureText(label).width, 430);
  context.font = countFont;
  const countWidth = Math.min(context.measureText(countText).width, 145);
  let cursorX = centerX - (labelWidth + 24 + countWidth) / 2;
  context.textAlign = 'left';
  context.textBaseline = 'middle';
  context.lineWidth = 8;
  context.strokeStyle = '#2b1a10';
  context.fillStyle = '#f0d38d';
  context.font = labelFont;
  context.strokeText(label, cursorX, 90, 430);
  context.fillText(label, cursorX, 90, 430);
  cursorX += labelWidth + 24;
  context.font = countFont;
  context.lineWidth = 6;
  context.strokeText(countText, cursorX, 92, 145);
  context.fillText(countText, cursorX, 92, 145);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function graveColor(project: GraveProject, theme: Theme) {
  if (project.status === 'alive') return theme === 'day' ? 0x829368 : 0x62775f;
  if (project.status === 'sleeping') return theme === 'day' ? 0x858591 : 0x656b80;
  return theme === 'day' ? 0x70737e : 0x535d73;
}

function makeGrave(project: GraveProject, language: Language, theme: Theme, stoneNoise: THREE.Texture): GraveObject {
  const group = new THREE.Group();
  const shape = new THREE.Shape();
  const isAlive = project.status === 'alive';
  const isSleeping = project.status === 'sleeping';
  const shoulder = isAlive ? 1.56 : 1.92;
  const crown = isAlive ? 2.25 : isSleeping ? 2.68 : 2.84;
  const halfWidth = isAlive ? 1 : 1.08;
  shape.moveTo(-halfWidth, 0);
  shape.lineTo(-halfWidth - 0.04, shoulder);
  shape.bezierCurveTo(-halfWidth - 0.04, crown - 0.38, -0.72, crown - 0.08, -0.32, crown);
  shape.lineTo(isAlive ? 0.32 : 0.52, crown - 0.08);
  shape.bezierCurveTo(0.86, crown - 0.14, halfWidth + 0.04, crown - 0.46, halfWidth + 0.02, shoulder + 0.04);
  shape.lineTo(halfWidth, 0);
  shape.closePath();
  const geometry = new THREE.ExtrudeGeometry(shape, { depth: 0.52, bevelEnabled: true, bevelSegments: 2, bevelSize: 0.1, bevelThickness: 0.08, curveSegments: 10 });
  geometry.center();
  geometry.translate(0, 1.48, -0.26);
  const material = new THREE.MeshStandardMaterial({
    color: graveColor(project, theme),
    roughness: 0.94,
    metalness: 0.02,
    bumpMap: stoneNoise,
    bumpScale: 0.075,
    emissive: project.status === 'alive' ? new THREE.Color(theme === 'day' ? 0x28311f : 0x172612) : new THREE.Color(0x000000),
    emissiveIntensity: project.status === 'alive' ? 0.18 : 0,
  });
  const body = new THREE.Mesh(geometry, material);
  body.castShadow = true;
  body.receiveShadow = true;
  body.userData.projectId = project.id;
  group.add(body);

  const outline = new THREE.Mesh(geometry.clone(), new THREE.MeshBasicMaterial({ color: 0x171b24, side: THREE.BackSide }));
  outline.scale.set(1.045, 1.035, 1.08);
  outline.position.z = -0.015;
  outline.userData.projectId = project.id;
  group.add(outline);

  const baseMaterial = material.clone();
  baseMaterial.color.offsetHSL(0, -0.03, -0.08);
  const base = new THREE.Mesh(new THREE.BoxGeometry(2.62, 0.28, 0.9, 2, 1, 2), baseMaterial);
  base.position.set(0, 0.2, 0);
  base.castShadow = true;
  base.receiveShadow = true;
  base.userData.projectId = project.id;
  group.add(base);

  const foot = new THREE.Mesh(new THREE.BoxGeometry(2.95, 0.18, 1.12), new THREE.MeshStandardMaterial({ color: 0x343946, roughness: 1 }));
  foot.position.set(0, 0.06, 0.01);
  foot.castShadow = true;
  foot.receiveShadow = true;
  foot.userData.projectId = project.id;
  group.add(foot);

  const inscription = createInscription(project, language, theme);
  const plaque = new THREE.Mesh(
    new THREE.PlaneGeometry(2.24, 1.68),
    new THREE.MeshStandardMaterial({ map: inscription, transparent: true, roughness: 1, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -3 }),
  );
  plaque.scale.setScalar(isAlive ? 0.94 : 1);
  plaque.position.set(0, isAlive ? 1.32 : isSleeping ? 1.46 : 1.52, 0.365);
  plaque.userData.projectId = project.id;
  group.add(plaque);

  if (isAlive) {
    const leafMaterial = new THREE.MeshStandardMaterial({ color: theme === 'day' ? 0x79a24d : 0x8fc55a, emissive: 0x355a24, emissiveIntensity: theme === 'day' ? 0.12 : 0.4, roughness: 0.78 });
    for (const [x, y, rotation, scale] of [[-0.92, 0.47, -0.5, 1], [-0.69, 0.38, 0.22, 0.78], [0.92, 0.42, 0.48, 0.92]] as const) {
      const leaf = new THREE.Mesh(new THREE.SphereGeometry(0.17, 10, 8), leafMaterial);
      leaf.scale.set(1.5 * scale, 0.42 * scale, 0.68 * scale);
      leaf.position.set(x, y, 0.38);
      leaf.rotation.z = rotation;
      leaf.userData.projectId = project.id;
      group.add(leaf);
    }
    const planter = new THREE.Mesh(new THREE.BoxGeometry(2.18, 0.34, 0.72), new THREE.MeshStandardMaterial({ color: theme === 'day' ? 0x6f8c4e : 0x496b3d, roughness: 0.9 }));
    planter.position.set(0, 0.48, 0.31);
    planter.userData.projectId = project.id;
    planter.castShadow = true;
    group.add(planter);
  } else if (isSleeping) {
    const webPoints = [
      new THREE.Vector3(0.98, 2.36, 0.22), new THREE.Vector3(1.4, 2.13, 0.18),
      new THREE.Vector3(0.98, 2.36, 0.22), new THREE.Vector3(1.37, 2.61, 0.18),
      new THREE.Vector3(1.12, 2.3, 0.22), new THREE.Vector3(1.28, 2.51, 0.18),
      new THREE.Vector3(1.12, 2.3, 0.22), new THREE.Vector3(1.31, 2.21, 0.18),
    ];
    const web = new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(webPoints), new THREE.LineBasicMaterial({ color: theme === 'day' ? 0x4c514a : 0xc4cabd, transparent: true, opacity: 0.58 }));
    web.userData.projectId = project.id;
    group.add(web);
    for (const [index, radius] of [0.1, 0.072].entries()) {
      const sleepOrb = new THREE.Mesh(new THREE.TorusGeometry(radius, 0.023, 6, 12, Math.PI * 1.65), new THREE.MeshBasicMaterial({ color: 0xd2ad58, transparent: true, opacity: 0.78 }));
      sleepOrb.position.set(1.12 + index * 0.2, 2.72 + index * 0.18, 0.08);
      sleepOrb.rotation.z = -0.35;
      sleepOrb.userData.projectId = project.id;
      group.add(sleepOrb);
    }
    const leafMaterial = new THREE.MeshStandardMaterial({ color: 0x7b6038, roughness: 1 });
    for (const [x, z, rotation] of [[-0.92, 0.47, -0.5], [0.74, 0.51, 0.35]] as const) {
      const leaf = new THREE.Mesh(new THREE.SphereGeometry(0.15, 8, 6), leafMaterial);
      leaf.scale.set(1.6, 0.22, 0.72);
      leaf.position.set(x, 0.31, z);
      leaf.rotation.z = rotation;
      leaf.userData.projectId = project.id;
      group.add(leaf);
    }
    const glow = new THREE.Mesh(new THREE.SphereGeometry(0.055, 8, 6), new THREE.MeshBasicMaterial({ color: 0xf2dc7a }));
    glow.position.set(-1.08, 1.03, 0.48);
    glow.userData.projectId = project.id;
    group.add(glow);
  } else {
    const crackPoints = [
      new THREE.Vector3(-0.58, 2.79, 0.38), new THREE.Vector3(-0.43, 2.61, 0.38),
      new THREE.Vector3(-0.43, 2.61, 0.38), new THREE.Vector3(-0.58, 2.45, 0.38),
      new THREE.Vector3(-0.43, 2.61, 0.38), new THREE.Vector3(-0.23, 2.5, 0.38),
    ];
    const cracks = new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(crackPoints), new THREE.LineBasicMaterial({ color: 0x20252a }));
    cracks.userData.projectId = project.id;
    group.add(cracks);
    const dryMaterial = new THREE.MeshStandardMaterial({ color: 0x725d3a, roughness: 1 });
    for (const x of [-1.1, 1.05]) {
      const dryGrass = new THREE.Mesh(new THREE.ConeGeometry(0.1, 0.56, 5), dryMaterial);
      dryGrass.position.set(x, 0.36, 0.2);
      dryGrass.rotation.z = x < 0 ? -0.28 : 0.28;
      dryGrass.userData.projectId = project.id;
      group.add(dryGrass);
    }
    for (const [x, size] of [[-0.74, 0.18], [0.65, 0.13]] as const) {
      const pebble = new THREE.Mesh(new THREE.DodecahedronGeometry(size, 0), new THREE.MeshStandardMaterial({ color: 0x414852, roughness: 1 }));
      pebble.position.set(x, 0.25, 0.52);
      pebble.userData.projectId = project.id;
      group.add(pebble);
    }
  }

  const scale = 1.04 + Math.min(0.15, Math.log10(Math.max(project.sizeBytes, 1)) / 60);
  group.scale.setScalar(scale);
  const deterministicTilt = ((project.id.charCodeAt(0) + project.name.length) % 7 - 3) * 0.007;
  const dormantTilt = isSleeping ? ((project.id.charCodeAt(project.id.length - 1) + project.name.length) % 5 - 2) * 0.008 : 0;
  group.rotation.z = dormantTilt;
  group.rotation.y = deterministicTilt;
  return { group, body, outline, project, restingY: 0, restingRotationY: deterministicTilt, restingScale: scale, entranceDelay: 0 };
}

function makeStatusSign(status: GraveProject['status'], label: string, count: number, direction: 1 | -1, theme: Theme) {
  const group = new THREE.Group();
  const shape = new THREE.Shape();
  if (direction === 1) {
    shape.moveTo(-1.25, -0.34); shape.lineTo(0.72, -0.34); shape.lineTo(1.24, 0); shape.lineTo(0.72, 0.34); shape.lineTo(-1.25, 0.34);
  } else {
    shape.moveTo(1.25, -0.34); shape.lineTo(-0.72, -0.34); shape.lineTo(-1.24, 0); shape.lineTo(-0.72, 0.34); shape.lineTo(1.25, 0.34);
  }
  shape.closePath();
  const geometry = new THREE.ExtrudeGeometry(shape, { depth: 0.2, bevelEnabled: true, bevelSegments: 2, bevelSize: 0.045, bevelThickness: 0.035 });
  geometry.center();
  const material = new THREE.MeshStandardMaterial({ color: theme === 'day' ? 0xa56a32 : 0x79502d, roughness: 0.82 });
  const board = new THREE.Mesh(geometry, material);
  board.position.y = 1.35;
  board.castShadow = true;
  board.userData.status = status;
  group.add(board);
  const outline = new THREE.Mesh(geometry.clone(), new THREE.MeshBasicMaterial({ color: 0x2b1a10, side: THREE.BackSide }));
  outline.scale.set(1.055, 1.12, 1.15);
  outline.position.y = 1.35;
  outline.userData.status = status;
  group.add(outline);
  const texture = createWoodLabel(label, count, direction);
  const lettering = new THREE.Mesh(new THREE.PlaneGeometry(2.42, 0.58), new THREE.MeshBasicMaterial({ map: texture, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -4 }));
  lettering.position.set(0, 1.35, 0.22);
  lettering.renderOrder = 4;
  lettering.userData.status = status;
  group.add(lettering);
  const post = new THREE.Mesh(
    new THREE.BoxGeometry(0.22, 1.55, 0.24),
    new THREE.MeshStandardMaterial({ color: theme === 'day' ? 0x6d3e23 : 0x4b3022, roughness: 0.9 }),
  );
  post.position.set(direction === 1 ? -0.86 : 0.86, 0.63, -0.02);
  post.castShadow = true;
  post.userData.status = status;
  group.add(post);
  return { group, texture };
}

export default function Cemetery3D({ projects, language, theme, onSelect, onStatusFilter, statusCounts, showcase = false, onExitShowcase }: Cemetery3DProps) {
  const hostRef = useRef<HTMLDivElement>(null);
  const onSelectRef = useRef(onSelect);
  const onStatusFilterRef = useRef(onStatusFilter);
  const [hovered, setHovered] = useState<GraveProject>();
  const [webglError, setWebglError] = useState(false);
  useEffect(() => { onSelectRef.current = onSelect; }, [onSelect]);
  useEffect(() => { onStatusFilterRef.current = onStatusFilter; }, [onStatusFilter]);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    setWebglError(false);
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
    } catch {
      queueMicrotask(() => setWebglError(true));
      return;
    }

    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = theme === 'day' ? 1.05 : 1.15;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFShadowMap;
    host.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(theme === 'day' ? 0xcbd0c5 : 0x15221e, theme === 'day' ? 0.014 : 0.018);
    const camera = new THREE.PerspectiveCamera(37, 1, 0.1, 120);
    const stoneNoise = createNoiseTexture();

    const ambient = new THREE.HemisphereLight(theme === 'day' ? 0xf7f4df : 0xa9c5d2, theme === 'day' ? 0x596146 : 0x263326, theme === 'day' ? 2.15 : 2.15);
    scene.add(ambient);
    const key = new THREE.DirectionalLight(theme === 'day' ? 0xfff3d1 : 0xe1edff, theme === 'day' ? 3.2 : 3.6);
    key.position.set(theme === 'day' ? -8 : 7, 13, 9);
    key.castShadow = true;
    key.shadow.mapSize.set(2048, 2048);
    key.shadow.camera.left = -18;
    key.shadow.camera.right = 18;
    key.shadow.camera.top = 18;
    key.shadow.camera.bottom = -18;
    key.shadow.bias = -0.0004;
    scene.add(key);
    const rim = new THREE.DirectionalLight(theme === 'day' ? 0xbdd3a6 : 0x86a9db, theme === 'day' ? 1.1 : 2.0);
    rim.position.set(-10, 5, -12);
    scene.add(rim);

    const alive = projects.filter((project) => project.status === 'alive');
    const sleeping = projects.filter((project) => project.status === 'sleeping');
    const dead = projects
      .filter((project) => project.status === 'dead')
      .sort((a, b) => new Date(b.death?.date ?? b.lastActiveAt).getTime() - new Date(a.death?.date ?? a.lastActiveAt).getTime());
    const sections: Array<{ status: GraveProject['status']; projects: GraveProject[] }> = [
      ...(alive.length ? [{ status: 'alive' as const, projects: alive }] : []),
      ...(sleeping.length ? [{ status: 'sleeping' as const, projects: sleeping }] : []),
      ...(dead.length ? [{ status: 'dead' as const, projects: dead }] : []),
    ];
    const columns = 5;
    const columnSpacing = 3.38;
    const rowSpacing = 4.72;
    const layoutOffsetX = 1.05;
    let rowCursor = 0;
    let graveCursor = 0;
    const graves: GraveObject[] = [];
    const signs: Array<{ group: THREE.Group; restingX: number; entranceDelay: number }> = [];
    const interactive: THREE.Object3D[] = [];
    const disposableTextures: THREE.Texture[] = [stoneNoise];
    const statusAnchors = new Map<GraveProject['status'], THREE.Vector3>();

    for (const section of sections) {
      if (!statusAnchors.has(section.status)) {
        const firstRowCount = Math.min(columns, section.projects.length);
        const firstGraveX = -((firstRowCount - 1) / 2) * columnSpacing + layoutOffsetX;
        const firstRowForward = rowCursor === 0 ? 1 : 0;
        statusAnchors.set(section.status, new THREE.Vector3(firstGraveX - 3.08, 0, -rowCursor * rowSpacing + firstRowForward));
      }
      for (const [index, project] of section.projects.entries()) {
        const column = index % columns;
        const row = Math.floor(index / columns);
        const projectsInRow = Math.min(columns, section.projects.length - row * columns);
        const grave = makeGrave(project, language, theme, stoneNoise);
        const rowForward = rowCursor === 0 && row === 0 ? 1 : 0;
        grave.group.position.set((column - (projectsInRow - 1) / 2) * columnSpacing + layoutOffsetX, 0, -(rowCursor + row) * rowSpacing + rowForward);
        grave.restingY = grave.group.position.y;
        grave.entranceDelay = 0.18 + graveCursor * 0.055;
        if (!prefersReducedMotion) {
          grave.group.position.y -= 0.22;
          grave.group.scale.setScalar(grave.restingScale * 0.92);
        }
        graveCursor += 1;
        grave.group.traverse((object) => { if (object.userData.projectId) interactive.push(object); });
        const plaque = grave.group.children.find((child) => child instanceof THREE.Mesh && child.material instanceof THREE.MeshStandardMaterial && child.material.transparent) as THREE.Mesh | undefined;
        if (plaque && plaque.material instanceof THREE.MeshStandardMaterial && plaque.material.map) disposableTextures.push(plaque.material.map);
        scene.add(grave.group);
        graves.push(grave);
      }
      rowCursor += Math.ceil(section.projects.length / columns);
    }

    const signData: Array<[GraveProject['status'], string, number]> = [
      ['alive', tr(language, 'showcase.alive'), statusCounts.alive],
      ['sleeping', tr(language, 'showcase.dormant'), statusCounts.sleeping],
      ['dead', tr(language, 'showcase.buried'), statusCounts.dead],
    ];
    for (const [status, label, count] of signData) {
      const anchor = statusAnchors.get(status);
      if (!anchor) continue;
      const sign = makeStatusSign(status, label, count, 1, theme);
      sign.group.position.copy(anchor);
      sign.group.scale.setScalar(0.98);
      const restingX = sign.group.position.x;
      if (!prefersReducedMotion) {
        sign.group.position.x -= 0.7;
        sign.group.scale.setScalar(0.94);
      }
      sign.group.traverse((object) => { if (object.userData.status) interactive.push(object); });
      disposableTextures.push(sign.texture);
      scene.add(sign.group);
      signs.push({ group: sign.group, restingX, entranceDelay: 0.22 + signs.length * 0.13 });
    }

    const sceneDepth = Math.max(2, (rowCursor - 1) * rowSpacing);
    camera.position.set(0, 14.2 + Math.min(rowCursor, 10) * 0.3, 16.2 + Math.min(rowCursor, 10) * 0.35);
    const lookAt = new THREE.Vector3(0, 1.15, -sceneDepth * 0.5);
    camera.lookAt(lookAt);

    const raycaster = new THREE.Raycaster();
    const pointer = new THREE.Vector2(0, 0);
    let hoveredId: string | undefined;
    let hoveredStatus: GraveProject['status'] | undefined;
    let disposed = false;
    let animationFrame = 0;

    function pick(event: PointerEvent) {
      const bounds = renderer.domElement.getBoundingClientRect();
      pointer.x = ((event.clientX - bounds.left) / bounds.width) * 2 - 1;
      pointer.y = -((event.clientY - bounds.top) / bounds.height) * 2 + 1;
      raycaster.setFromCamera(pointer, camera);
      const hit = raycaster.intersectObjects(interactive, false)[0];
      const nextId = hit?.object.userData.projectId as string | undefined;
      const nextStatus = hit?.object.userData.status as GraveProject['status'] | undefined;
      if (nextId !== hoveredId || nextStatus !== hoveredStatus) {
        hoveredId = nextId;
        hoveredStatus = nextStatus;
        const project = graves.find((grave) => grave.project.id === nextId)?.project;
        setHovered(project);
        renderer.domElement.style.cursor = project || nextStatus ? 'pointer' : 'grab';
      }
    }
    function click() {
      if (hoveredStatus) { onStatusFilterRef.current(hoveredStatus); return; }
      if (!hoveredId) return;
      const project = graves.find((grave) => grave.project.id === hoveredId)?.project;
      if (project) onSelectRef.current(project);
    }
    function leave() {
      hoveredId = undefined;
      hoveredStatus = undefined;
      setHovered(undefined);
      renderer.domElement.style.cursor = 'grab';
    }
    renderer.domElement.addEventListener('pointermove', pick);
    renderer.domElement.addEventListener('pointerleave', leave);
    renderer.domElement.addEventListener('click', click);

    const resizeObserver = new ResizeObserver(() => {
      const width = host.clientWidth;
      const height = host.clientHeight;
      if (!width || !height) return;
      renderer.setSize(width, height, false);
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
    });
    resizeObserver.observe(host);

    const baseCamera = camera.position.clone();
    const startedAt = performance.now();
    const outlineIdle = new THREE.Color(0x171b24);
    const outlineHover = new THREE.Color(0x9fba78);
    function render() {
      if (disposed) return;
      const elapsed = (performance.now() - startedAt) / 1000;
      camera.position.copy(baseCamera);
      camera.lookAt(lookAt);
      for (const grave of graves) {
        const isHovered = grave.project.id === hoveredId;
        const entranceProgress = prefersReducedMotion ? 1 : THREE.MathUtils.clamp((elapsed - grave.entranceDelay) / 0.58, 0, 1);
        const entranceEase = 1 - (1 - entranceProgress) ** 3;
        const hoverLift = isHovered ? 0.13 : 0;
        const hoverScale = isHovered ? 1.035 : 1;
        grave.group.position.y = THREE.MathUtils.lerp(grave.group.position.y, grave.restingY - (1 - entranceEase) * 0.22 + hoverLift, 0.14);
        const nextScale = grave.restingScale * (0.92 + entranceEase * 0.08) * hoverScale;
        grave.group.scale.setScalar(THREE.MathUtils.lerp(grave.group.scale.x, nextScale, 0.14));
        grave.group.rotation.y = THREE.MathUtils.lerp(grave.group.rotation.y, grave.restingRotationY, 0.12);
        grave.body.material.emissiveIntensity = THREE.MathUtils.lerp(grave.body.material.emissiveIntensity, isHovered ? 0.24 : grave.project.status === 'alive' ? 0.18 : 0, 0.1);
        grave.outline.material.color.lerp(isHovered ? outlineHover : outlineIdle, 0.12);
      }
      for (const sign of signs) {
        const progress = prefersReducedMotion ? 1 : THREE.MathUtils.clamp((elapsed - sign.entranceDelay) / 0.52, 0, 1);
        const ease = 1 - (1 - progress) ** 3;
        sign.group.position.x = THREE.MathUtils.lerp(sign.group.position.x, sign.restingX - (1 - ease) * 0.7, 0.16);
        sign.group.scale.setScalar(0.98 * (0.96 + ease * 0.04));
      }
      renderer.render(scene, camera);
      animationFrame = requestAnimationFrame(render);
    }
    render();

    return () => {
      disposed = true;
      cancelAnimationFrame(animationFrame);
      resizeObserver.disconnect();
      renderer.domElement.removeEventListener('pointermove', pick);
      renderer.domElement.removeEventListener('pointerleave', leave);
      renderer.domElement.removeEventListener('click', click);
      scene.traverse((object) => {
        if (object instanceof THREE.Mesh) {
          object.geometry.dispose();
          const materials = Array.isArray(object.material) ? object.material : [object.material];
          materials.forEach((material) => material.dispose());
        }
        if (object instanceof THREE.Sprite) object.material.dispose();
      });
      disposableTextures.forEach((texture) => texture.dispose());
      renderer.dispose();
      renderer.domElement.remove();
    };
  }, [projects, language, theme, statusCounts.alive, statusCounts.sleeping, statusCounts.dead]);

  return (
    <div className={`cinematic-cemetery ${theme} ${showcase ? 'showcase' : ''}`}>
      <div className="cinematic-backdrop" />
      <div className="cinematic-stars" />
      <div className="celestial-glow" />
      <div className="cartoon-clouds cloud-bank-one" /><div className="cartoon-clouds cloud-bank-two" />
      <div className="cartoon-canopy canopy-left" /><div className="cartoon-canopy canopy-right" />
      <div className="cartoon-fireflies">{Array.from({ length: 9 }, (_, index) => <i key={index} />)}</div>
      <div className="cinematic-grade" />
      <div ref={hostRef} className="webgl-stage" />
      {showcase && <div className="showcase-poster">
        <p>{tr(language, 'showcase.kicker')}</p>
        <h1>{tr(language, 'showcase.title')}</h1>
        <span>{tr(language, 'showcase.tagline')}</span>
        <div className="showcase-stats">
          <button onClick={() => { onStatusFilter('alive'); onExitShowcase?.(); }}><i className="alive" /><b>{statusCounts.alive}</b><small>{tr(language, 'showcase.alive')}</small></button>
          <button onClick={() => { onStatusFilter('sleeping'); onExitShowcase?.(); }}><i className="sleeping" /><b>{statusCounts.sleeping}</b><small>{tr(language, 'showcase.dormant')}</small></button>
          <button onClick={() => { onStatusFilter('dead'); onExitShowcase?.(); }}><i className="dead" /><b>{statusCounts.dead}</b><small>{tr(language, 'showcase.buried')}</small></button>
        </div>
      </div>}
      {showcase && <button type="button" className="exit-showcase" onClick={onExitShowcase}>{tr(language, 'showcase.exit').toUpperCase()} <kbd>Esc</kbd></button>}
      <div className="cinema-topline"><span>{tr(language, 'showcase.sceneTitle')}</span><i /> <b>{projects.length.toString().padStart(3, '0')}</b></div>
      <div className="cinema-help">{tr(language, 'showcase.help')}</div>
      {hovered && <div className="cinema-inspector"><span>{hovered.technologies[0] ?? tr(language, 'showcase.project')}</span><strong>{hovered.name}</strong><p>{formatDate(hovered.bornAt)} <i>→</i> {hovered.death ? formatDate(hovered.death.date) : tr(language, 'showcase.present')}</p></div>}
      {webglError && <div className="webgl-error">{text(language, '当前设备无法启用 3D 渲染，请更新显卡驱动。', '3D rendering is unavailable. Please update your graphics driver.')}</div>}
      {projects.length === 0 && <div className="webgl-empty">{text(language, '没有符合筛选条件的项目', 'NO PROJECTS MATCH THE CURRENT FILTERS')}</div>}
    </div>
  );
}
