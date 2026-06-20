import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { analyzeProject, detectTechnologies, discoverProjectPaths } from './scanner';

const temporaryDirectories: string[] = [];

afterEach(async () => {
  await Promise.all(temporaryDirectories.splice(0).map((directory) => fs.rm(directory, { recursive: true, force: true })));
});

async function temporaryDirectory() {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'project-graveyard-'));
  temporaryDirectories.push(directory);
  return directory;
}

describe('project discovery', () => {
  it('finds marker directories and ignores dependency/build trees', async () => {
    const root = await temporaryDirectory();
    const app = path.join(root, 'apps', 'alpha');
    const ignored = path.join(app, 'node_modules', 'hidden-project');
    await fs.mkdir(path.join(app, 'src'), { recursive: true });
    await fs.mkdir(ignored, { recursive: true });
    await fs.writeFile(path.join(app, 'package.json'), '{}');
    await fs.writeFile(path.join(ignored, 'Cargo.toml'), '[package]');

    const found = await discoverProjectPaths([root], new AbortController().signal);

    expect(found).toEqual([app]);
  });

  it('supports at least five common project ecosystems', () => {
    const technologies = detectTechnologies([
      'package.json', 'pyproject.toml', 'Cargo.toml', 'go.mod', 'pom.xml', 'CMakeLists.txt',
    ], JSON.stringify({ devDependencies: { typescript: '1', react: '1' } }));
    expect(technologies).toEqual(expect.arrayContaining(['JavaScript', 'Python', 'Rust', 'Go', 'Java', 'C/C++', 'TypeScript', 'React']));
  });
});

describe('project analysis', () => {
  it('collects read-only project facts while excluding ignored directories', async () => {
    const root = await temporaryDirectory();
    const app = path.join(root, 'alpha');
    await fs.mkdir(path.join(app, 'src'), { recursive: true });
    await fs.mkdir(path.join(app, 'dist'), { recursive: true });
    await fs.writeFile(path.join(app, 'package.json'), JSON.stringify({ dependencies: { react: 'latest' }, devDependencies: { typescript: 'latest' } }));
    await fs.writeFile(path.join(app, 'README.md'), '# Alpha\nA quiet test project.');
    await fs.writeFile(path.join(app, 'src', 'index.ts'), '// TODO: finish the actual project\nexport {};');
    await fs.writeFile(path.join(app, 'dist', 'bundle.js'), '// TODO TODO ignored output');

    const result = await analyzeProject(app, root, 1, new AbortController().signal);

    expect(result.name).toBe('alpha');
    expect(result.technologies).toEqual(expect.arrayContaining(['JavaScript', 'TypeScript', 'React']));
    expect(result.todoCount).toBe(1);
    expect(result.todos[0]).toContain('src');
    expect(result.readmeSummary).toContain('quiet test project');
    expect(result.gitState).toBe('not-repository');
  });
});
