import type { AnnualReport, GraveEvent, GraveProject } from '../shared/types';

export function daysBetween(start: string, end: string): number {
  return Math.max(0, Math.floor((new Date(end).getTime() - new Date(start).getTime()) / 86_400_000));
}

export function formatDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '--';
  const part = (number: number) => String(number).padStart(2, '0');
  return `${date.getFullYear()}.${part(date.getMonth() + 1)}.${part(date.getDate())} ${part(date.getHours())}:${part(date.getMinutes())}`;
}

export function toDateTimeLocal(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const part = (number: number) => String(number).padStart(2, '0');
  return `${date.getFullYear()}-${part(date.getMonth() + 1)}-${part(date.getDate())}T${part(date.getHours())}:${part(date.getMinutes())}`;
}

export function formatLifespan(start: string, end: string, language: 'zh-CN' | 'en-US' = 'zh-CN'): string {
  const totalMinutes = Math.max(0, Math.floor((new Date(end).getTime() - new Date(start).getTime()) / 60_000));
  const units = language === 'en-US' ? { minute: 'min', hour: 'hr', day: 'days' } : { minute: '分钟', hour: '小时', day: '天' };
  if (totalMinutes < 60) return `${totalMinutes} ${units.minute}`;
  if (totalMinutes < 1_440) return `${Math.floor(totalMinutes / 60)} ${units.hour} ${totalMinutes % 60} ${units.minute}`;
  const days = Math.floor(totalMinutes / 1_440);
  const hours = Math.floor((totalMinutes % 1_440) / 60);
  return hours ? `${days} ${units.day} ${hours} ${units.hour}` : `${days} ${units.day}`;
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  const units = ['KB', 'MB', 'GB', 'TB'];
  let value = bytes / 1024;
  let unit = units[0];
  for (let index = 1; value >= 1024 && index < units.length; index += 1) {
    value /= 1024;
    unit = units[index];
  }
  return `${value >= 10 ? value.toFixed(0) : value.toFixed(1)} ${unit}`;
}

export function statusLabel(status: GraveProject['status']): string {
  return { alive: '存活', sleeping: '沉睡', dead: '死亡' }[status];
}

function mostCommon(values: string[]): string | undefined {
  const counts = new Map<string, number>();
  for (const value of values) counts.set(value, (counts.get(value) ?? 0) + 1);
  return [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0]?.[0];
}

export function buildAnnualReport(projects: GraveProject[], events: GraveEvent[], year: number): AnnualReport {
  const deaths = projects.filter((project) => project.death && new Date(project.death.date).getFullYear() === year);
  const lifespans = deaths.map((project) => ({ name: project.name, days: daysBetween(project.bornAt, project.death!.date) }));
  const technologies = projects
    .filter((project) => new Date(project.bornAt).getFullYear() === year)
    .flatMap((project) => project.technologies);
  return {
    year,
    newProjects: projects.filter((project) => new Date(project.bornAt).getFullYear() === year).length,
    deaths: deaths.length,
    revivals: events.filter((item) => item.type === 'revived' && new Date(item.at).getFullYear() === year).length,
    averageLifespanDays: lifespans.length
      ? Math.round(lifespans.reduce((sum, item) => sum + item.days, 0) / lifespans.length)
      : 0,
    shortestLived: [...lifespans].sort((a, b) => a.days - b.days)[0],
    topCause: mostCommon(deaths.map((project) => project.death!.cause)),
    topTechnology: mostCommon(technologies),
  };
}

export function createCemeteryPng(projects: GraveProject[]): string {
  const dead = projects.filter((project) => project.status === 'dead' && project.death);
  const groups = new Map<number, GraveProject[]>();
  for (const project of dead) {
    const year = new Date(project.death!.date).getFullYear();
    groups.set(year, [...(groups.get(year) ?? []), project]);
  }
  const years = [...groups.keys()].sort((a, b) => b - a);
  const width = 1600;
  const sectionHeights = years.map((year) => Math.max(360, Math.ceil(groups.get(year)!.length / 6) * 260 + 140));
  const height = Math.max(900, 280 + sectionHeights.reduce((sum, value) => sum + value, 0));
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('当前系统无法创建导出画布。');

  const gradient = context.createLinearGradient(0, 0, 0, height);
  gradient.addColorStop(0, '#101813');
  gradient.addColorStop(1, '#253327');
  context.fillStyle = gradient;
  context.fillRect(0, 0, width, height);
  context.fillStyle = '#eef1df';
  context.font = '700 56px Georgia, serif';
  context.fillText('PROJECT GRAVEYARD', 90, 110);
  context.fillStyle = '#9ba895';
  context.font = '28px sans-serif';
  context.fillText('给未完成的项目一个体面的结局。', 92, 164);
  context.font = '20px monospace';
  context.fillText(`本地项目纪念册 · ${new Date().toLocaleDateString('zh-CN')}`, 92, 210);

  let top = 270;
  for (const [groupIndex, year] of years.entries()) {
    const items = groups.get(year)!;
    context.strokeStyle = '#60715f';
    context.lineWidth = 2;
    context.beginPath();
    context.moveTo(80, top + 55);
    context.lineTo(width - 80, top + 55);
    context.stroke();
    context.fillStyle = '#d0d7bc';
    context.font = '700 31px monospace';
    context.fillText(`${year} 区 · ${items.length} 个项目`, 90, top + 38);
    for (const [index, project] of items.entries()) {
      const column = index % 6;
      const row = Math.floor(index / 6);
      const x = 105 + column * 245;
      const y = top + 115 + row * 260;
      const stoneHeight = 150 + Math.min(34, Math.log10(Math.max(project.sizeBytes, 1)) * 6);
      context.fillStyle = groupIndex % 2 ? '#7e8779' : '#889184';
      context.beginPath();
      context.roundRect(x, y, 205, stoneHeight, [55, 55, 10, 10]);
      context.fill();
      context.fillStyle = '#172019';
      context.font = '700 19px monospace';
      context.textAlign = 'center';
      context.fillText(project.name.slice(0, 18), x + 102, y + 63);
      context.font = '15px monospace';
      context.fillText(`${formatDate(project.bornAt)} -`, x + 102, y + 95);
      context.fillText(formatDate(project.death!.date), x + 102, y + 118);
      context.fillText(`${daysBetween(project.bornAt, project.death!.date)} DAYS`, x + 102, y + 146);
      context.textAlign = 'left';
    }
    top += sectionHeights[groupIndex];
  }
  if (dead.length === 0) {
    context.fillStyle = '#aeb9a4';
    context.font = '32px sans-serif';
    context.fillText('这里还没有墓碑。所有项目都还有机会。', 90, 380);
  }
  return canvas.toDataURL('image/png');
}
