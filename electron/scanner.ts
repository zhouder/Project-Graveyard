import { createHash } from 'node:crypto';
import { execFile } from 'node:child_process';
import { promises as fs, type Dirent } from 'node:fs';
import path from 'node:path';
import { promisify } from 'node:util';
import { IGNORED_DIRECTORIES, PROJECT_MARKERS } from '../src/shared/constants';
import type { GitState, GraveProject, ScanProgress } from '../src/shared/types';

const execFileAsync = promisify(execFile);
const TEXT_EXTENSIONS = new Set([
  '.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs', '.py', '.rs', '.go', '.java', '.kt',
  '.cs', '.cpp', '.c', '.h', '.hpp', '.rb', '.php', '.swift', '.vue', '.svelte',
  '.html', '.css', '.scss', '.md', '.toml', '.yaml', '.yml', '.json', '.xml', '.sh', '.ps1',
]);

interface FileFacts {
  sizeBytes: number;
  earliest: number;
  latest: number;
  todoCount: number;
  todos: string[];
}

export class ScanCancelledError extends Error {
  constructor() {
    super('Scan cancelled');
    this.name = 'ScanCancelledError';
  }
}

function assertNotCancelled(signal: AbortSignal) {
  if (signal.aborted) throw new ScanCancelledError();
}

async function safeReadDir(directory: string): Promise<Dirent[]> {
  try {
    return await fs.readdir(directory, { withFileTypes: true });
  } catch {
    return [];
  }
}

export async function discoverProjectPaths(
  roots: string[],
  signal: AbortSignal,
  onProgress?: (progress: ScanProgress) => void,
): Promise<string[]> {
  const projects = new Set<string>();
  const queue = roots.map((root) => path.resolve(root));
  let errors = 0;

  while (queue.length > 0) {
    assertNotCancelled(signal);
    const current = queue.shift()!;
    let entries: Dirent[];
    try {
      entries = await fs.readdir(current, { withFileTypes: true });
    } catch {
      errors += 1;
      onProgress?.({ phase: 'discovering', currentPath: current, found: projects.size, analyzed: 0, errors });
      continue;
    }

    const names = new Set(entries.map((entry) => entry.name));
    if (PROJECT_MARKERS.some((marker) => names.has(marker))) projects.add(current);

    for (const entry of entries) {
      if (!entry.isDirectory() || entry.isSymbolicLink() || IGNORED_DIRECTORIES.has(entry.name)) continue;
      queue.push(path.join(current, entry.name));
    }

    onProgress?.({ phase: 'discovering', currentPath: current, found: projects.size, analyzed: 0, errors });
    await new Promise<void>((resolve) => setImmediate(resolve));
  }

  return [...projects];
}

async function collectFileFacts(projectPath: string, signal: AbortSignal): Promise<FileFacts> {
  const facts: FileFacts = {
    sizeBytes: 0,
    earliest: Number.POSITIVE_INFINITY,
    latest: 0,
    todoCount: 0,
    todos: [],
  };
  const queue = [projectPath];

  while (queue.length > 0) {
    assertNotCancelled(signal);
    const directory = queue.shift()!;
    const entries = await safeReadDir(directory);
    for (const entry of entries) {
      assertNotCancelled(signal);
      if (entry.isSymbolicLink()) continue;
      const fullPath = path.join(directory, entry.name);
      if (entry.isDirectory()) {
        if (!IGNORED_DIRECTORIES.has(entry.name)) queue.push(fullPath);
        continue;
      }
      if (!entry.isFile()) continue;
      try {
        const stat = await fs.stat(fullPath);
        facts.sizeBytes += stat.size;
        facts.earliest = Math.min(facts.earliest, stat.birthtimeMs || stat.ctimeMs);
        facts.latest = Math.max(facts.latest, stat.mtimeMs);
        if (stat.size <= 1024 * 1024 && TEXT_EXTENSIONS.has(path.extname(entry.name).toLowerCase())) {
          const content = await fs.readFile(fullPath, 'utf8');
          for (const [index, line] of content.split(/\r?\n/).entries()) {
            const matches = line.match(/\b(?:TODO|FIXME)\b/gi);
            if (!matches) continue;
            facts.todoCount += matches.length;
            if (facts.todos.length < 12) {
              facts.todos.push(`${path.relative(projectPath, fullPath)}:${index + 1} ${line.trim().slice(0, 120)}`);
            }
          }
        }
      } catch {
        // A file can disappear or become unreadable during a read-only scan.
      }
    }
    await new Promise<void>((resolve) => setImmediate(resolve));
  }
  return facts;
}

async function git(projectPath: string, args: string[]): Promise<string | undefined> {
  try {
    const result = await execFileAsync('git', ['-C', projectPath, ...args], {
      timeout: 12_000,
      windowsHide: true,
      maxBuffer: 1024 * 1024,
    });
    return result.stdout.trim();
  } catch {
    return undefined;
  }
}

async function inspectGit(projectPath: string) {
  try {
    await fs.access(path.join(projectPath, '.git'));
  } catch {
    return { state: 'not-repository' as GitState };
  }
  const status = await git(projectPath, ['status', '--porcelain']);
  if (status === undefined) return { state: 'unavailable' as GitState };
  const roots = await git(projectPath, ['log', '--max-parents=0', '--format=%aI']);
  const bornAt = roots?.split(/\r?\n/).filter(Boolean).sort()[0];
  const latest = await git(projectPath, ['log', '-1', '--format=%aI%x00%s']);
  const [lastCommitAt, lastCommit] = latest?.split('\0') ?? [];
  return {
    state: status ? 'dirty' as GitState : 'clean' as GitState,
    bornAt,
    lastCommitAt,
    lastCommit,
  };
}

export function detectTechnologies(markers: string[], packageJson?: string): string[] {
  const technologies = new Set<string>();
  if (markers.includes('package.json')) technologies.add('JavaScript');
  if (markers.includes('pyproject.toml') || markers.includes('requirements.txt')) technologies.add('Python');
  if (markers.includes('Cargo.toml')) technologies.add('Rust');
  if (markers.includes('go.mod')) technologies.add('Go');
  if (markers.includes('pom.xml') || markers.includes('build.gradle')) technologies.add('Java');
  if (markers.includes('CMakeLists.txt')) technologies.add('C/C++');
  if (markers.includes('composer.json')) technologies.add('PHP');
  if (packageJson) {
    try {
      const pkg = JSON.parse(packageJson) as Record<string, unknown>;
      const deps = { ...(pkg.dependencies as object ?? {}), ...(pkg.devDependencies as object ?? {}) } as Record<string, unknown>;
      if ('typescript' in deps) technologies.add('TypeScript');
      if ('react' in deps) technologies.add('React');
      if ('vue' in deps) technologies.add('Vue');
      if ('electron' in deps) technologies.add('Electron');
    } catch {
      // Invalid package metadata should not stop the scan.
    }
  }
  return [...technologies];
}

async function readSummary(projectPath: string): Promise<string | undefined> {
  const entries = await safeReadDir(projectPath);
  const readme = entries.find((entry) => entry.isFile() && /^readme(?:\..+)?$/i.test(entry.name));
  if (!readme) return undefined;
  try {
    const content = await fs.readFile(path.join(projectPath, readme.name), 'utf8');
    return content
      .replace(/```[\s\S]*?```/g, '')
      .replace(/!\[[^\]]*\]\([^)]*\)/g, '')
      .replace(/[#>*_`[\]]/g, '')
      .replace(/\([^)]*\)/g, '')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 320) || undefined;
  } catch {
    return undefined;
  }
}

export async function analyzeProject(
  projectPath: string,
  rootPath: string,
  sleepAfterDays: number,
  signal: AbortSignal,
): Promise<GraveProject> {
  const entries = await safeReadDir(projectPath);
  const names = new Set(entries.map((entry) => entry.name));
  const markers = PROJECT_MARKERS.filter((marker) => names.has(marker));
  const [facts, gitFacts, readmeSummary, packageJson, markerBirthTimes] = await Promise.all([
    collectFileFacts(projectPath, signal),
    inspectGit(projectPath),
    readSummary(projectPath),
    names.has('package.json') ? fs.readFile(path.join(projectPath, 'package.json'), 'utf8').catch(() => undefined) : undefined,
    Promise.all(markers.map(async (marker) => {
      try {
        const stat = await fs.stat(path.join(projectPath, marker));
        return stat.birthtimeMs || stat.ctimeMs;
      } catch {
        return Number.POSITIVE_INFINITY;
      }
    })),
  ]);
  const fallback = Date.now();
  const earliestMarker = Math.min(...markerBirthTimes);
  const bornMs = gitFacts.bornAt ? Date.parse(gitFacts.bornAt) : (Number.isFinite(earliestMarker) ? earliestMarker : (Number.isFinite(facts.earliest) ? facts.earliest : fallback));
  const lastMs = Math.max(facts.latest, gitFacts.lastCommitAt ? Date.parse(gitFacts.lastCommitAt) : 0) || bornMs;
  const sleepingDays = Math.max(0, Math.floor((Date.now() - lastMs) / 86_400_000));
  const normalized = path.resolve(projectPath).toLowerCase();

  return {
    id: createHash('sha256').update(normalized).digest('hex').slice(0, 16),
    name: path.basename(projectPath),
    path: path.resolve(projectPath),
    rootPath: path.resolve(rootPath),
    markers: [...markers],
    technologies: detectTechnologies([...markers], packageJson),
    bornAt: new Date(bornMs).toISOString(),
    lastActiveAt: new Date(lastMs).toISOString(),
    sleepingDays,
    sizeBytes: facts.sizeBytes,
    todoCount: facts.todoCount,
    todos: facts.todos,
    gitState: gitFacts.state,
    lastCommit: gitFacts.lastCommit,
    readmeSummary,
    status: sleepingDays >= sleepAfterDays ? 'sleeping' : 'alive',
  };
}

export function containingRoot(projectPath: string, roots: string[]): string {
  const resolved = path.resolve(projectPath);
  return roots
    .map((root) => path.resolve(root))
    .filter((root) => resolved === root || resolved.startsWith(`${root}${path.sep}`))
    .sort((a, b) => b.length - a.length)[0] ?? roots[0];
}
