export const PROJECT_MARKERS = [
  '.git',
  'package.json',
  'pyproject.toml',
  'requirements.txt',
  'Cargo.toml',
  'go.mod',
  'pom.xml',
  'build.gradle',
  'CMakeLists.txt',
  'composer.json',
] as const;

export const IGNORED_DIRECTORIES = new Set([
  '.git', '.svn', '.hg', 'node_modules', 'dist', 'build', 'target', 'venv', '.venv',
  'env', '.env', '__pycache__', '.next', '.nuxt', 'coverage', '.cache', '.idea', '.vscode',
]);

export const DEATH_CAUSES = [
  '需求膨胀',
  '技术选型失败',
  '已有替代品',
  '失去兴趣',
  '只是为了学习',
  '未知原因',
] as const;
