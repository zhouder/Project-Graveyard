import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { formatDate } from '../lib/domain';
import { causeLabel, tr } from '../lib/i18n';
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
  project: GraveProject;
  restingY: number;
  restingRotationY: number;
}

function text(language: Language, zh: string, en: string) {
  return language === 'en-US' ? en : zh;
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
  drawPanel(65, 24, 894, 220, panel);
  drawPanel(65, 268, 894, 316, panelLight);
  drawPanel(154, 608, 716, 124, statusColor);
  const name = project.name.length > 22 ? `${project.name.slice(0, 21)}…` : project.name;
  const nameSize = name.length > 17 ? 92 : name.length > 12 ? 108 : 126;
  context.font = `900 ${nameSize}px "Cooper Black", "Arial Rounded MT Bold", "STKaiti", "KaiTi", serif`;
  context.lineWidth = 12;
  context.strokeStyle = outline;
  context.strokeText(name.toUpperCase(), 512, 124, 820);
  context.fillStyle = theme === 'day' ? '#d9d9df' : '#dce5f1';
  context.fillText(name.toUpperCase(), 512, 124, 820);
  context.fillStyle = ink;
  context.font = '900 100px "SF Mono", "Cascadia Mono", Consolas, "STKaiti", "KaiTi", monospace';
  context.fillText(`${text(language, '生', 'BORN')}  ${formatDate(project.bornAt)}`, 512, 350, 880);
  context.fillText(`${text(language, '卒', 'DIED')}  ${project.death ? formatDate(project.death.date) : text(language, '尚未确认', 'NOT DECLARED')}`, 512, 495, 880);
  context.font = '900 64px "Cooper Black", "Arial Rounded MT Bold", "STKaiti", "KaiTi", serif';
  context.strokeStyle = 'rgba(35,26,17,.65)';
  context.lineWidth = 7;
  const statusText = text(language,
    project.status === 'alive' ? '存活 · 仍在维护' : project.status === 'sleeping' ? `沉睡 · ${project.sleepingDays} 天` : `死亡 · ${project.death?.cause ?? '未知原因'}`,
    project.status === 'alive' ? 'ACTIVE' : project.status === 'sleeping' ? `DORMANT · ${project.sleepingDays} DAYS` : project.death ? `DECEASED · ${causeLabel(language, project.death.cause)}` : 'DECEASED');
  context.strokeText(statusText, 512, 670, 650);
  context.fillStyle = '#f5ead1';
  context.fillText(statusText, 512, 670, 650);
  context.strokeStyle = `${outline}88`;
  context.lineWidth = 6;
  context.beginPath();
  context.moveTo(120, 525);
  context.lineTo(205, 500);
  context.lineTo(250, 525);
  context.moveTo(770, 345);
  context.lineTo(820, 370);
  context.lineTo(875, 350);
  context.stroke();
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 16;
  return texture;
}

function createWoodLabel(label: string, direction: 1 | -1) {
  const canvas = document.createElement('canvas');
  canvas.width = 768;
  canvas.height = 180;
  const context = canvas.getContext('2d')!;
  context.fillStyle = '#f0d38d';
  context.font = '900 104px "Cooper Black", "Arial Rounded MT Bold", "STKaiti", "KaiTi", serif';
  context.textAlign = 'center';
  context.textBaseline = 'middle';
  context.lineWidth = 8;
  context.strokeStyle = '#2b1a10';
  context.strokeText(label, direction === 1 ? 350 : 420, 90, 590);
  context.fillText(label, direction === 1 ? 350 : 420, 90, 590);
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
    new THREE.PlaneGeometry(2.18, 1.64),
    new THREE.MeshStandardMaterial({ map: inscription, transparent: true, roughness: 1, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -3 }),
  );
  plaque.scale.setScalar(isAlive ? 0.88 : 1);
  plaque.position.set(0, isAlive ? 1.22 : isSleeping ? 1.42 : 1.5, 0.365);
  plaque.userData.projectId = project.id;
  group.add(plaque);

  if (isAlive) {
    const leafMaterial = new THREE.MeshStandardMaterial({ color: theme === 'day' ? 0x79a24d : 0x8fc55a, emissive: 0x355a24, emissiveIntensity: theme === 'day' ? 0.12 : 0.4, roughness: 0.78 });
    const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.08, 0.58, 8), leafMaterial);
    stem.position.set(0, 2.3, 0.08);
    stem.userData.projectId = project.id;
    group.add(stem);
    for (const [x, y, rotation] of [[-0.18, 2.38, -0.65], [0.18, 2.53, 0.65]] as const) {
      const leaf = new THREE.Mesh(new THREE.SphereGeometry(0.16, 10, 8), leafMaterial);
      leaf.scale.set(1.35, 0.48, 0.65);
      leaf.position.set(x, y, 0.08);
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
    group.rotation.z = -0.055;
    const webPoints = [
      new THREE.Vector3(0.48, 2.35, 0.37), new THREE.Vector3(1.02, 2.04, 0.37),
      new THREE.Vector3(0.48, 2.35, 0.37), new THREE.Vector3(0.98, 2.48, 0.37),
      new THREE.Vector3(0.69, 2.23, 0.37), new THREE.Vector3(0.87, 2.4, 0.37),
      new THREE.Vector3(0.69, 2.23, 0.37), new THREE.Vector3(0.9, 2.13, 0.37),
    ];
    const web = new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(webPoints), new THREE.LineBasicMaterial({ color: theme === 'day' ? 0x4c514a : 0xc4cabd, transparent: true, opacity: 0.58 }));
    web.userData.projectId = project.id;
    group.add(web);
    for (const [index, radius] of [0.12, 0.09, 0.065].entries()) {
      const sleepOrb = new THREE.Mesh(new THREE.TorusGeometry(radius, 0.026, 6, 12, Math.PI * 1.65), new THREE.MeshBasicMaterial({ color: 0xe3bd66 }));
      sleepOrb.position.set(0.68 + index * 0.22, 2.78 + index * 0.2, 0.12);
      sleepOrb.rotation.z = -0.35;
      sleepOrb.userData.projectId = project.id;
      group.add(sleepOrb);
    }
  } else {
    const crackPoints = [
      new THREE.Vector3(-0.2, 2.55, 0.38), new THREE.Vector3(-0.05, 2.28, 0.38),
      new THREE.Vector3(-0.05, 2.28, 0.38), new THREE.Vector3(-0.22, 2.05, 0.38),
      new THREE.Vector3(-0.05, 2.28, 0.38), new THREE.Vector3(0.15, 2.12, 0.38),
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
  }

  const scale = 0.96 + Math.min(0.15, Math.log10(Math.max(project.sizeBytes, 1)) / 60);
  group.scale.setScalar(scale);
  const deterministicTilt = ((project.id.charCodeAt(0) + project.name.length) % 7 - 3) * 0.007;
  group.rotation.y = deterministicTilt;
  return { group, body, project, restingY: 0, restingRotationY: deterministicTilt };
}

function makeStatusSign(status: GraveProject['status'], label: string, direction: 1 | -1, theme: Theme) {
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
  const texture = createWoodLabel(label, direction);
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
    const columnSpacing = 3.28;
    const rowSpacing = 4.5;
    const layoutOffsetX = 0.9;
    let rowCursor = 0;
    const graves: GraveObject[] = [];
    const interactive: THREE.Object3D[] = [];
    const disposableTextures: THREE.Texture[] = [stoneNoise];
    const statusAnchors = new Map<GraveProject['status'], THREE.Vector3>();

    for (const section of sections) {
      if (!statusAnchors.has(section.status)) {
        const firstRowCount = Math.min(columns, section.projects.length);
        const firstGraveX = -((firstRowCount - 1) / 2) * columnSpacing + layoutOffsetX;
        const firstRowForward = rowCursor === 0 ? 1 : 0;
        statusAnchors.set(section.status, new THREE.Vector3(firstGraveX - 2.75, 0, -rowCursor * rowSpacing + firstRowForward));
      }
      for (const [index, project] of section.projects.entries()) {
        const column = index % columns;
        const row = Math.floor(index / columns);
        const projectsInRow = Math.min(columns, section.projects.length - row * columns);
        const grave = makeGrave(project, language, theme, stoneNoise);
        const rowForward = rowCursor === 0 && row === 0 ? 1 : 0;
        grave.group.position.set((column - (projectsInRow - 1) / 2) * columnSpacing + layoutOffsetX, 0, -(rowCursor + row) * rowSpacing + rowForward);
        grave.restingY = grave.group.position.y;
        grave.group.traverse((object) => { if (object.userData.projectId) interactive.push(object); });
        const plaque = grave.group.children.find((child) => child instanceof THREE.Mesh && child.material instanceof THREE.MeshStandardMaterial && child.material.transparent) as THREE.Mesh | undefined;
        if (plaque && plaque.material instanceof THREE.MeshStandardMaterial && plaque.material.map) disposableTextures.push(plaque.material.map);
        scene.add(grave.group);
        graves.push(grave);
      }
      rowCursor += Math.ceil(section.projects.length / columns);
    }

    const signData: Array<[GraveProject['status'], string]> = [
      ['alive', `${text(language, '存活', 'ACTIVE')}  ${statusCounts.alive}`],
      ['sleeping', `${text(language, '沉睡', 'DORMANT')}  ${statusCounts.sleeping}`],
      ['dead', `${text(language, '死亡', 'DECEASED')}  ${statusCounts.dead}`],
    ];
    for (const [status, label] of signData) {
      const anchor = statusAnchors.get(status);
      if (!anchor) continue;
      const sign = makeStatusSign(status, label, 1, theme);
      sign.group.position.copy(anchor);
      sign.group.scale.setScalar(0.92);
      sign.group.traverse((object) => { if (object.userData.status) interactive.push(object); });
      disposableTextures.push(sign.texture);
      scene.add(sign.group);
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
    function render() {
      if (disposed) return;
      const elapsed = (performance.now() - startedAt) / 1000;
      camera.position.copy(baseCamera);
      camera.lookAt(lookAt);
      for (const grave of graves) {
        const isHovered = grave.project.id === hoveredId;
        const hoverLift = isHovered ? 0.2 + Math.sin(elapsed * 3.2) * 0.018 : 0;
        const hoverTurn = isHovered ? Math.sin(elapsed * 3.2) * 0.052 : 0;
        grave.group.position.y = THREE.MathUtils.lerp(grave.group.position.y, grave.restingY + hoverLift, 0.1);
        grave.group.rotation.y = THREE.MathUtils.lerp(grave.group.rotation.y, grave.restingRotationY + hoverTurn, 0.08);
        grave.body.material.emissiveIntensity = THREE.MathUtils.lerp(grave.body.material.emissiveIntensity, isHovered ? 0.24 : grave.project.status === 'alive' ? 0.18 : 0, 0.1);
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
          <button onClick={() => { onStatusFilter('alive'); onExitShowcase?.(); }}><i className="alive" /><b>{statusCounts.alive}</b><small>{text(language, '存活', 'ALIVE')}</small></button>
          <button onClick={() => { onStatusFilter('sleeping'); onExitShowcase?.(); }}><i className="sleeping" /><b>{statusCounts.sleeping}</b><small>{text(language, '沉睡', 'DORMANT')}</small></button>
          <button onClick={() => { onStatusFilter('dead'); onExitShowcase?.(); }}><i className="dead" /><b>{statusCounts.dead}</b><small>{text(language, '死亡', 'BURIED')}</small></button>
        </div>
      </div>}
      {showcase && <button type="button" className="exit-showcase" onClick={onExitShowcase}>{tr(language, 'showcase.exit').toUpperCase()} <kbd>Esc</kbd></button>}
      <div className="cinema-topline"><span>{text(language, '项目纪念园', 'PROJECT MEMORIAL GARDEN')}</span><i /> <b>{projects.length.toString().padStart(3, '0')}</b></div>
      <div className="cinema-help">{text(language, '移动指针探索 · 点击墓碑打开档案', 'MOVE TO EXPLORE · SELECT A STONE TO OPEN')}</div>
      {hovered && <div className="cinema-inspector"><span>{hovered.technologies[0] ?? 'PROJECT'}</span><strong>{hovered.name}</strong><p>{formatDate(hovered.bornAt)} <i>→</i> {hovered.death ? formatDate(hovered.death.date) : text(language, '尚未确认', 'PRESENT')}</p></div>}
      {webglError && <div className="webgl-error">{text(language, '当前设备无法启用 3D 渲染，请更新显卡驱动。', '3D rendering is unavailable. Please update your graphics driver.')}</div>}
      {projects.length === 0 && <div className="webgl-empty">{text(language, '没有符合筛选条件的项目', 'NO PROJECTS MATCH THE CURRENT FILTERS')}</div>}
    </div>
  );
}
