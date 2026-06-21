import { useEffect, useMemo, useRef, useState, type FormEvent, type ReactNode } from 'react';
import Cemetery3D from './components/Cemetery3D';
import { buildAnnualReport, createCemeteryPng, formatBytes, formatDate, formatLifespan, toDateTimeLocal } from './lib/domain';
import { DEMO_STATE } from './lib/demo';
import { causeLabel, epitaphSuggestions, tr, type Language } from './lib/i18n';
import { DEATH_CAUSES } from './shared/constants';
import type { AppState, FuneralInput, GraveProject, ScanProgress } from './shared/types';

type ViewMode = 'cemetery' | 'list';

const EMPTY_STATE: AppState = {
  version: 1,
  roots: [],
  projectPaths: [],
  projects: [],
  events: [],
  settings: { sleepAfterDays: 180, demoMode: false, language: 'zh-CN', theme: 'night' },
};

function Icon({ name }: { name: 'grave' | 'list' | 'scan' | 'report' | 'export' | 'close' | 'folder' }) {
  const paths: Record<typeof name, ReactNode> = {
    grave: <><path d="M8 20v-9a4 4 0 0 1 8 0v9M5 20h14M12 5V2M9 5h6" /></>,
    list: <><path d="M8 6h13M8 12h13M8 18h13" /><path d="M3 6h.01M3 12h.01M3 18h.01" /></>,
    scan: <><path d="M4 7V4h3M17 4h3v3M20 17v3h-3M7 20H4v-3" /><path d="M8 12h8M12 8v8" /></>,
    report: <><path d="M4 20V10M10 20V4M16 20v-7M22 20H2" /></>,
    export: <><path d="M12 3v13M7 8l5-5 5 5" /><path d="M5 14v6h14v-6" /></>,
    close: <path d="m6 6 12 12M18 6 6 18" />,
    folder: <path d="M3 6h7l2 2h9v11H3z" />,
  };
  return <svg className="icon" viewBox="0 0 24 24" aria-hidden="true">{paths[name]}</svg>;
}

function StatusPill({ status, language }: { status: GraveProject['status']; language: Language }) {
  return <span className={`status-pill ${status}`}><i />{tr(language, `status.${status}`)}</span>;
}

function dayCount(language: Language, count: number) {
  return `${count} ${tr(language, language === 'en-US' && count === 1 ? 'common.day' : 'common.days')}`;
}

interface GameSelectOption {
  value: string;
  label: string;
}

function GameSelect({ label, value, options, onChange }: {
  label: string;
  value: string;
  options: GameSelectOption[];
  onChange: (value: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const selected = options.find((option) => option.value === value) ?? options[0];

  useEffect(() => {
    if (!open) return;
    function closeOnOutside(event: PointerEvent) {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    }
    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === 'Escape') setOpen(false);
    }
    document.addEventListener('pointerdown', closeOnOutside);
    document.addEventListener('keydown', closeOnEscape);
    return () => {
      document.removeEventListener('pointerdown', closeOnOutside);
      document.removeEventListener('keydown', closeOnEscape);
    };
  }, [open]);

  return (
    <div className={`game-select ${open ? 'open' : ''}`} ref={rootRef}>
      <span className="game-select-label">{label}</span>
      <button
        type="button"
        className="game-select-trigger"
        role="combobox"
        aria-label={label}
        aria-expanded={open}
        aria-haspopup="listbox"
        onClick={() => setOpen((current) => !current)}
        onKeyDown={(event) => {
          if (event.key === 'ArrowDown' || event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            setOpen(true);
          }
        }}
      >
        <span>{selected?.label}</span><i aria-hidden="true" />
      </button>
      <div className="game-select-menu" role="listbox" aria-label={label} aria-hidden={!open}>
        {options.map((option) => (
          <button
            type="button"
            role="option"
            aria-selected={option.value === value}
            className={option.value === value ? 'selected' : ''}
            key={option.value}
            tabIndex={open ? 0 : -1}
            onClick={() => { onChange(option.value); setOpen(false); }}
          >
            <span>{option.label}</span>{option.value === value && <b aria-hidden="true">✓</b>}
          </button>
        ))}
      </div>
    </div>
  );
}

function EmptyState({ onSelect, onDemo, onLanguage, onTheme, language, theme }: { onSelect: () => void; onDemo: () => void; onLanguage: () => void; onTheme: () => void; language: Language; theme: AppState['settings']['theme'] }) {
  return (
    <div className="empty-state" data-theme={theme}>
      <div className="empty-utilities"><button onClick={onLanguage}>{tr(language, 'nav.language')}</button><button onClick={onTheme}>{theme === 'night' ? '☼' : '☾'}</button></div>
      <div className="empty-moon" />
      <div className="empty-stone"><span>{tr(language, 'empty.stone')}</span><i aria-hidden="true">＋</i></div>
      <p className="eyebrow">{tr(language, 'empty.eyebrow')}</p>
      <h1>{tr(language, 'empty.title')}</h1>
      <p className="empty-copy">{tr(language, 'empty.copy')}</p>
      <ol className="onboarding-steps">
        <li><b>01</b><span>{tr(language, 'empty.stepOne')}</span></li>
        <li><b>02</b><span>{tr(language, 'empty.stepTwo')}</span></li>
        <li><b>03</b><span>{tr(language, 'empty.stepThree')}</span></li>
      </ol>
      <div className="empty-actions">
        <button className="button primary" onClick={onSelect}><Icon name="folder" />{tr(language, 'empty.scan')}</button>
        <button className="button ghost" onClick={onDemo}>{tr(language, 'empty.demo')}</button>
      </div>
      <div className="privacy-strip"><span>●</span>{tr(language, 'privacy.offline')}<span>●</span>{tr(language, 'privacy.noTelemetry')}<span>●</span>{tr(language, 'privacy.controlled')}</div>
    </div>
  );
}

interface ProjectListProps {
  projects: GraveProject[];
  onSelect: (project: GraveProject) => void;
  language: Language;
}

function ProjectList({ projects, onSelect, language }: ProjectListProps) {
  return (
    <section className="archive-ledger">
      <header className="ledger-heading">
        <div><p className="eyebrow">{tr(language, 'ledger.eyebrow')}</p><h2>{tr(language, 'ledger.title')}</h2></div>
        <p>{tr(language, 'ledger.copy')}</p>
      </header>
      <div className="project-table-wrap">
        <table className="project-table">
          <thead><tr><th>{tr(language, 'table.project')}</th><th>{tr(language, 'table.status')}</th><th>{tr(language, 'table.tech')}</th><th>{tr(language, 'table.activity')}</th><th>{tr(language, 'ledger.meta')}</th><th aria-label={tr(language, 'ledger.record')} /></tr></thead>
          <tbody>
            {projects.map((project, index) => (
              <tr key={project.id} onClick={() => onSelect(project)} tabIndex={0} onKeyDown={(event) => event.key === 'Enter' && onSelect(project)}>
                <td><span className="ledger-index">{String(index + 1).padStart(3, '0')}</span><strong>{project.name}</strong><small>{project.path}</small></td>
                <td><span className={`ledger-status ${project.status}`}><i aria-hidden="true" />{tr(language, project.status === 'alive' ? 'ledger.alive' : project.status === 'sleeping' ? 'ledger.sleeping' : 'ledger.dead')}</span></td>
                <td><div className="tech-list">{project.technologies.slice(0, 3).map((tech) => <span key={tech}>{tech}</span>)}</div></td>
                <td className="ledger-activity"><b>{formatDate(project.lastActiveAt)}</b><small>{dayCount(language, project.sleepingDays)}</small></td>
                <td><div className="ledger-meta"><span>{formatBytes(project.sizeBytes)}</span><span>{project.todoCount} TODO</span><span className={`git-state ${project.gitState}`}>{project.gitState}</span></div></td>
                <td><button type="button" className="ledger-open" onClick={(event) => { event.stopPropagation(); onSelect(project); }}>{tr(language, 'ledger.record')} <span>→</span></button></td>
              </tr>
            ))}
          </tbody>
        </table>
        {projects.length === 0 && <div className="no-results">{tr(language, 'content.noResults')}</div>}
      </div>
    </section>
  );
}

function DetailDrawer({ project, language, onClose, onFuneral, onRevive, onOpen, onArchive, onTrash }: {
  project: GraveProject; onClose: () => void; onFuneral: () => void; onRevive: () => void;
  language: Language; onOpen: () => void; onArchive: () => void; onTrash: () => void;
}) {
  const lifespanEnd = project.death?.date ?? new Date().toISOString();
  const statusStory = tr(language, project.status === 'alive' ? 'detail.aliveStory' : project.status === 'sleeping' ? 'detail.sleepingStory' : 'detail.deadStory');
  return (
    <div className="drawer-backdrop" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <aside className="detail-drawer">
        <button className="icon-button close-button" onClick={onClose} aria-label={tr(language, 'common.close')}><Icon name="close" /></button>
        <p className="eyebrow">{tr(language, 'detail.archive')}</p>
        <div className="detail-title"><div><h2>{project.name}</h2><p>{project.path}</p></div><StatusPill status={project.status} language={language} /></div>
        <p className={`status-story ${project.status}`}><i aria-hidden="true" />{statusStory}</p>
        <div className="life-timeline">
          <div className="timeline-node born"><i /><span>{tr(language, 'time.born')}</span><b>{formatDate(project.bornAt)}</b></div>
          <div className="timeline-track"><span /></div>
          <div className="timeline-node active"><i /><span>{tr(language, 'time.lastActive')}</span><b>{formatDate(project.lastActiveAt)}</b></div>
          <div className="timeline-track"><span /></div>
          <div className={`timeline-node ${project.death ? 'death' : 'pending'}`}><i /><span>{tr(language, 'time.death')}</span><b>{project.death ? formatDate(project.death.date) : tr(language, 'time.pending')}</b></div>
        </div>
        {project.death && (
          <div className="memorial-card">
            <span>{tr(language, 'memorial.inMemory')}</span><div className="memorial-dates"><p><i>{tr(language, 'time.born')}</i>{formatDate(project.bornAt)}</p><em>→</em><p><i>{tr(language, 'time.death')}</i>{formatDate(project.death.date)}</p></div>
            <b>{tr(language, 'detail.lived')} {formatLifespan(project.bornAt, project.death.date, language)}</b>
            <p>{tr(language, 'detail.cause')}：{causeLabel(language, project.death.cause)}</p><blockquote>“{project.death.epitaph || '—'}”</blockquote>
          </div>
        )}
        {!project.death && <div className="unburied-note"><span>◇</span><p>{tr(language, 'detail.unburied')}</p></div>}
        <section className="primary-actions">
          <h3>{tr(language, 'detail.actions')}</h3>
          <div className="drawer-actions">
            {project.status === 'sleeping' && <button className="button funeral" onClick={onFuneral}>{tr(language, 'action.funeral')}</button>}
            {project.status === 'dead' && <button className="button revive" onClick={onRevive}>{tr(language, 'action.revive')}</button>}
            {project.status !== 'dead' && <button className="button secondary" onClick={onOpen}>{tr(language, 'action.open')}</button>}
            <button className="button ghost" onClick={onArchive}>{tr(language, 'action.archive')}</button>
          </div>
        </section>
        <details className="archive-disclosure">
          <summary><span>{tr(language, 'detail.technical')}</span><i aria-hidden="true">＋</i></summary>
          <div className="detail-stats">
            <div><span>{tr(language, 'detail.age')}</span><b>{formatLifespan(project.bornAt, lifespanEnd, language)}</b></div><div><span>{tr(language, 'detail.size')}</span><b>{formatBytes(project.sizeBytes)}</b></div>
            <div><span>{tr(language, 'detail.todos')}</span><b>{project.todoCount}</b></div><div><span>Git</span><b>{project.gitState}</b></div>
          </div>
          <section className="archive-section"><h3>{tr(language, 'detail.artifacts')}</h3><div className="tech-list large">{project.technologies.map((tech) => <span key={tech}>{tech}</span>)}</div></section>
        </details>
        <details className="archive-disclosure">
          <summary><span>{tr(language, 'detail.projectRecord')}</span><i aria-hidden="true">＋</i></summary>
          <section className="archive-section"><h3>{tr(language, 'detail.biography')}</h3><p>{project.readmeSummary ?? tr(language, 'detail.noReadme')}</p></section>
          <section className="archive-section"><h3>{tr(language, 'detail.commit')}</h3><p className="commit">{project.lastCommit ?? tr(language, 'detail.noCommit')}</p></section>
          <section className="archive-section"><h3>{tr(language, 'detail.unfinished')}</h3>{project.todos.length ? <ul className="todo-list">{project.todos.map((todo) => <li key={todo}>{todo}</li>)}</ul> : <p>{tr(language, 'detail.noTodos')}</p>}</section>
        </details>
        <section className="danger-zone">
          <div><h3>{tr(language, 'detail.danger')}</h3><p>{tr(language, 'detail.dangerCopy')}</p></div>
          <button className="button danger-text" onClick={onTrash}>{tr(language, 'action.trash')}</button>
        </section>
      </aside>
    </div>
  );
}

function FuneralModal({ project, language, onClose, onSubmit }: { project: GraveProject; language: Language; onClose: () => void; onSubmit: (input: FuneralInput) => void }) {
  const [date, setDate] = useState(toDateTimeLocal(project.lastActiveAt));
  const [cause, setCause] = useState<string>(DEATH_CAUSES[0]);
  const [epitaph, setEpitaph] = useState('');
  function submit(event: FormEvent) { event.preventDefault(); onSubmit({ projectId: project.id, date, cause, epitaph }); }
  return (
    <div className="modal-backdrop">
      <form className="modal funeral-modal" onSubmit={submit}>
        <button type="button" className="icon-button close-button" onClick={onClose}><Icon name="close" /></button>
        <header className="certificate-heading"><span aria-hidden="true">✦</span><div><p className="eyebrow">{tr(language, 'funeral.record')}</p><h2>{tr(language, 'funeral.for')} <strong>{project.name}</strong></h2></div><span aria-hidden="true">✦</span></header>
        <div className="certificate-facts">
          <p><span>{tr(language, 'funeral.project')}</span><b>{project.name}</b></p>
          <p><span>{tr(language, 'funeral.born')}</span><b>{formatDate(project.bornAt)}</b></p>
          <p><span>{tr(language, 'funeral.lastActive')}</span><b>{formatDate(project.lastActiveAt)}</b></p>
        </div>
        <div className="funeral-layout">
          <div className="funeral-fields">
            <label>{tr(language, 'funeral.time')}<input type="datetime-local" step="60" required value={date} min={toDateTimeLocal(project.lastActiveAt)} max={toDateTimeLocal(new Date().toISOString())} onChange={(event) => setDate(event.target.value)} /></label>
            <label>{tr(language, 'funeral.cause')}<select value={cause} onChange={(event) => setCause(event.target.value)}>{DEATH_CAUSES.map((item) => <option key={item} value={item}>{causeLabel(language, item)}</option>)}</select></label>
            <label>{tr(language, 'funeral.epitaph')}<textarea value={epitaph} maxLength={160} placeholder={language === 'en-US' ? 'The login page remains unfinished.' : '登录页面还没写完。'} onChange={(event) => setEpitaph(event.target.value)} /><small>{epitaph.length} / 160</small></label>
          </div>
          <aside className="funeral-preview">
            <p>{tr(language, 'funeral.preview')}</p>
            <div className="preview-stone"><i aria-hidden="true">✦</i><strong>{project.name}</strong><span>{formatDate(project.bornAt)}<br />—<br />{date ? formatDate(new Date(date).toISOString()) : '—'}</span><blockquote>“{epitaph || tr(language, 'funeral.previewPending')}”</blockquote></div>
            <small>{causeLabel(language, cause)}</small>
          </aside>
        </div>
        <div className="epitaph-suggestions"><p>{tr(language, 'funeral.suggestions')}</p><div>{epitaphSuggestions(language).map((suggestion) => <button type="button" key={suggestion} onClick={() => setEpitaph(suggestion)}>{suggestion}</button>)}</div></div>
        <p className="funeral-warning"><span aria-hidden="true">i</span>{tr(language, 'funeral.warning')}</p>
        <div className="modal-actions"><button type="button" className="button ghost" onClick={onClose}>{tr(language, 'funeral.cancel')}</button><button className="button funeral" type="submit">{tr(language, 'funeral.confirm')}</button></div>
      </form>
    </div>
  );
}

function ReportModal({ state, language, onClose }: { state: AppState; language: Language; onClose: () => void }) {
  const availableYears = [...new Set([
    new Date().getFullYear(),
    ...state.projects.flatMap((project) => [new Date(project.bornAt).getFullYear(), ...(project.death ? [new Date(project.death.date).getFullYear()] : [])]),
  ])].sort((a, b) => b - a);
  const [year, setYear] = useState(availableYears[0]);
  const report = buildAnnualReport(state.projects, state.events, year);
  return (
    <div className="modal-backdrop"><div className="modal report-modal">
      <button className="icon-button close-button" onClick={onClose}><Icon name="close" /></button>
      <p className="eyebrow">{tr(language, 'report.eyebrow')}</p>
      <div className="report-title"><h2>{year} {tr(language, 'report.title')}</h2><select value={year} onChange={(event) => setYear(Number(event.target.value))}>{availableYears.map((item) => <option key={item}>{item}</option>)}</select></div>
      <div className="report-grid"><div><span>{tr(language, 'report.new')}</span><b>{report.newProjects}</b></div><div><span>{tr(language, 'report.deaths')}</span><b>{report.deaths}</b></div><div><span>{tr(language, 'report.revivals')}</span><b>{report.revivals}</b></div><div><span>{tr(language, 'report.average')}</span><b>{dayCount(language, report.averageLifespanDays)}</b></div></div>
      <div className="report-facts"><p><span>{tr(language, 'report.shortest')}</span><b>{report.shortestLived ? `${report.shortestLived.name} · ${dayCount(language, report.shortestLived.days)}` : tr(language, 'common.none')}</b></p><p><span>{tr(language, 'report.cause')}</span><b>{report.topCause ? causeLabel(language, report.topCause) : tr(language, 'common.none')}</b></p><p><span>{tr(language, 'report.tech')}</span><b>{report.topTechnology ?? tr(language, 'common.none')}</b></p></div>
    </div></div>
  );
}

export default function App() {
  const [state, setState] = useState<AppState>(() => window.graveyard
    ? EMPTY_STATE
    : { ...EMPTY_STATE, settings: { ...EMPTY_STATE.settings, demoMode: true } });
  const [demoState, setDemoState] = useState<AppState>(DEMO_STATE);
  const [loading, setLoading] = useState(() => Boolean(window.graveyard));
  const [view, setView] = useState<ViewMode>('cemetery');
  const [showcase, setShowcase] = useState(false);
  const [selectedId, setSelectedId] = useState<string>();
  const [funeralId, setFuneralId] = useState<string>();
  const [showReport, setShowReport] = useState(false);
  const [showSources, setShowSources] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [progress, setProgress] = useState<ScanProgress>();
  const [message, setMessage] = useState<string>();
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('all');
  const [technology, setTechnology] = useState('all');
  const [year, setYear] = useState('all');
  const [size, setSize] = useState('all');
  const [sleepMin, setSleepMin] = useState(0);

  const effective = state.settings.demoMode ? demoState : state;
  const selected = effective.projects.find((project) => project.id === selectedId);
  const funeralProject = effective.projects.find((project) => project.id === funeralId);

  useEffect(() => {
    const api = window.graveyard;
    if (!api) return;
    void api.getState().then(setState).catch((error) => setMessage(String(error))).finally(() => setLoading(false));
    return api.onScanProgress(setProgress);
  }, []);

  useEffect(() => {
    if (!showcase) return;
    function exitOnEscape(event: KeyboardEvent) { if (event.key === 'Escape') setShowcase(false); }
    document.addEventListener('keydown', exitOnEscape);
    return () => document.removeEventListener('keydown', exitOnEscape);
  }, [showcase]);

  const technologies = useMemo(() => [...new Set(effective.projects.flatMap((project) => project.technologies))].sort(), [effective.projects]);
  const years = useMemo(() => [...new Set(effective.projects.flatMap((project) => [new Date(project.bornAt).getFullYear(), ...(project.death ? [new Date(project.death.date).getFullYear()] : [])]))].sort((a, b) => b - a), [effective.projects]);
  const filtered = useMemo(() => effective.projects.filter((project) => {
    const haystack = `${project.name} ${project.path}`.toLowerCase();
    const yearValues = [new Date(project.bornAt).getFullYear(), ...(project.death ? [new Date(project.death.date).getFullYear()] : [])];
    const sizeMatches = size === 'all' || (size === 'small' && project.sizeBytes < 10_000_000) || (size === 'medium' && project.sizeBytes >= 10_000_000 && project.sizeBytes < 100_000_000) || (size === 'large' && project.sizeBytes >= 100_000_000);
    return haystack.includes(search.toLowerCase()) && (status === 'all' || project.status === status) && (technology === 'all' || project.technologies.includes(technology)) && (year === 'all' || yearValues.includes(Number(year))) && sizeMatches && project.sleepingDays >= sleepMin;
  }), [effective.projects, search, status, technology, year, size, sleepMin]);

  const counts = useMemo(() => ({
    alive: effective.projects.filter((project) => project.status === 'alive').length,
    sleeping: effective.projects.filter((project) => project.status === 'sleeping').length,
    dead: effective.projects.filter((project) => project.status === 'dead').length,
  }), [effective.projects]);

  function fail(error: unknown) { setMessage(error instanceof Error ? error.message : String(error)); }
  async function selectRoots() {
    if (!window.graveyard) return;
    try { const next = await window.graveyard.selectRoots(); setState(next); if (next.roots.length > state.roots.length) await scan(); } catch (error) { fail(error); }
  }
  async function selectProject() {
    if (!window.graveyard) return;
    try {
      const next = await window.graveyard.selectProject();
      const added = next.projectPaths.length > state.projectPaths.length;
      setState(next);
      if (added) await scan();
    } catch (error) { fail(error); }
  }
  async function removeSource(source: string, mode: 'folder' | 'project') {
    if (!window.graveyard || state.settings.demoMode) return;
    try {
      setState(mode === 'folder' ? await window.graveyard.removeRoot(source) : await window.graveyard.removeProjectSource(source));
    } catch (error) { fail(error); }
  }
  async function scan() {
    if (!window.graveyard) return;
    setScanning(true); setProgress({ phase: 'discovering', currentPath: '', found: 0, analyzed: 0, errors: 0 });
    try { setState(await window.graveyard.startScan()); } catch (error) { fail(error); } finally { setScanning(false); }
  }
  async function toggleDemo() {
    const settings = { ...state.settings, demoMode: !state.settings.demoMode };
    if (!window.graveyard) { setState((current) => ({ ...current, settings })); return; }
    try { setState(await window.graveyard.updateSettings(settings)); } catch (error) { fail(error); }
  }
  async function updateAppearance(patch: Partial<AppState['settings']>) {
    const settings = { ...state.settings, ...patch };
    if (!window.graveyard) { setState((current) => ({ ...current, settings })); return; }
    try { setState(await window.graveyard.updateSettings(settings)); } catch (error) { fail(error); }
  }
  async function changeThreshold(value: number) {
    const settings = { ...state.settings, sleepAfterDays: value };
    if (!window.graveyard) { setState((current) => ({ ...current, settings })); return; }
    try { setState(await window.graveyard.updateSettings(settings)); } catch (error) { fail(error); }
  }
  async function funeral(input: FuneralInput) {
    try {
      if (state.settings.demoMode || !window.graveyard) {
        setDemoState((current) => ({ ...current, projects: current.projects.map((project) => project.id === input.projectId ? { ...project, status: 'dead', death: { date: new Date(input.date).toISOString(), cause: input.cause, epitaph: input.epitaph } } : project) }));
      } else setState(await window.graveyard.holdFuneral(input));
      setFuneralId(undefined); setSelectedId(input.projectId);
    } catch (error) { fail(error); }
  }
  async function revive(project: GraveProject) {
    try {
      if (state.settings.demoMode || !window.graveyard) setDemoState((current) => ({ ...current, projects: current.projects.map((item) => item.id === project.id ? { ...item, status: 'alive', death: undefined, sleepingDays: 0 } : item) }));
      else setState(await window.graveyard.reviveProject(project.id));
      setSelectedId(undefined);
    } catch (error) { fail(error); }
  }
  async function archive(project: GraveProject) {
    if (!window.confirm(`${tr(language, 'confirm.archive')}\n\n${project.path}`)) return;
    if (state.settings.demoMode || !window.graveyard) { setMessage(tr(language, 'demo.noMove')); return; }
    try { setState(await window.graveyard.archiveProject(project.id)); setSelectedId(undefined); } catch (error) { fail(error); }
  }
  async function trash(project: GraveProject) {
    if (!window.confirm(`${tr(language, 'confirm.trash')}\n\n${project.path}`)) return;
    if (state.settings.demoMode || !window.graveyard) { setMessage(tr(language, 'demo.noTrash')); return; }
    try { setState(await window.graveyard.trashProject(project.id)); setSelectedId(undefined); } catch (error) { fail(error); }
  }
  async function exportPng() {
    try {
      const data = createCemeteryPng(effective.projects);
      if (window.graveyard) await window.graveyard.savePng(data);
      else { const anchor = document.createElement('a'); anchor.href = data; anchor.download = 'project-graveyard.png'; anchor.click(); }
    } catch (error) { fail(error); }
  }

  const language = state.settings.language;
  const hasSources = state.roots.length > 0 || state.projectPaths.length > 0;
  if (loading) return <div className="loading-screen"><div className="loader-stone" /><p>PROJECT GRAVEYARD</p></div>;
  if (!state.settings.demoMode && state.projects.length === 0 && !hasSources) return <EmptyState onSelect={() => void selectRoots()} onDemo={() => void toggleDemo()} onLanguage={() => void updateAppearance({ language: language === 'zh-CN' ? 'en-US' : 'zh-CN' })} onTheme={() => void updateAppearance({ theme: state.settings.theme === 'night' ? 'day' : 'night' })} language={language} theme={state.settings.theme} />;

  return (
    <div className={`app-shell ${showcase ? 'showcase-mode' : ''}`} data-theme={state.settings.theme} lang={language}>
      <header className="topbar">
        <div className="brand"><span className="brand-mark">PG</span><div><strong>PROJECT GRAVEYARD</strong><small>LOCAL MEMORIAL FOR UNFINISHED CODE</small></div></div>
        <nav className="view-tabs"><button className={view === 'cemetery' ? 'active' : ''} onClick={() => setView('cemetery')}><Icon name="grave" />{tr(language, 'nav.cemetery')}</button><button className={view === 'list' ? 'active' : ''} onClick={() => setView('list')}><Icon name="list" />{tr(language, 'nav.list')}</button></nav>
        <div className="top-actions"><button className="showcase-toggle" onClick={() => { setView('cemetery'); setShowcase(true); }}><span aria-hidden="true">✦</span>{tr(language, 'nav.showcase')}</button><button className="icon-button labeled" onClick={() => setShowReport(true)}><Icon name="report" />{tr(language, 'nav.report')}</button><button className="icon-button labeled" onClick={() => void exportPng()}><Icon name="export" />{tr(language, 'nav.export')}</button><button className="utility-toggle" onClick={() => void updateAppearance({ language: language === 'zh-CN' ? 'en-US' : 'zh-CN' })}>{tr(language, 'nav.language')}</button><button className="utility-toggle theme-toggle" aria-label={tr(language, state.settings.theme === 'night' ? 'theme.day' : 'theme.night')} onClick={() => void updateAppearance({ theme: state.settings.theme === 'night' ? 'day' : 'night' })}><span>{state.settings.theme === 'night' ? '☼' : '☾'}</span></button><button className={`demo-toggle ${state.settings.demoMode ? 'on' : ''}`} onClick={() => void toggleDemo()}><i />{tr(language, 'nav.demo')}</button></div>
      </header>

      <aside className="sidebar">
        <div className="source-actions"><button className="button primary" onClick={() => void selectRoots()} disabled={scanning}><Icon name="folder" />{tr(language, 'scan.folder')}</button><button className="button secondary" onClick={() => void selectProject()} disabled={scanning}>＋ {tr(language, 'scan.project')}</button>{hasSources && <button className="rescan-link" onClick={() => void scan()} disabled={scanning}><Icon name="scan" />{scanning ? tr(language, 'scan.running') : tr(language, 'scan.again')}</button>}</div>
        {scanning && <div className="scan-progress"><div><span style={{ width: `${progress?.found ? Math.max(8, (progress.analyzed / progress.found) * 100) : 8}%` }} /></div><p>{progress?.phase === 'discovering' ? `${tr(language, 'scan.found')} ${progress.found}` : `${tr(language, 'scan.analyzing')} ${progress?.analyzed ?? 0} / ${progress?.found ?? 0}`}</p><button onClick={() => void window.graveyard?.cancelScan()}>{tr(language, 'scan.cancel')}</button></div>}
        <details className="advanced-controls">
          <summary><span><b>{tr(language, 'advanced.title')}</b><small>{tr(language, 'advanced.copy')}</small></span><i aria-hidden="true">＋</i></summary>
          <div className="advanced-body">
            <div className="sidebar-block filters"><div className="sidebar-heading"><span>{tr(language, 'filter.title')}</span><button onClick={() => { setTechnology('all'); setYear('all'); setSize('all'); setSleepMin(0); }}>{tr(language, 'filter.reset')}</button></div>
              <GameSelect label={tr(language, 'filter.tech')} value={technology} onChange={setTechnology} options={[{ value: 'all', label: tr(language, 'filter.allTech') }, ...technologies.map((item) => ({ value: item, label: item }))]} />
              <GameSelect label={tr(language, 'filter.year')} value={year} onChange={setYear} options={[{ value: 'all', label: tr(language, 'filter.allYears') }, ...years.map((item) => ({ value: String(item), label: String(item) }))]} />
              <GameSelect label={tr(language, 'filter.size')} value={size} onChange={setSize} options={[{ value: 'all', label: tr(language, 'filter.allSizes') }, { value: 'small', label: tr(language, 'filter.small') }, { value: 'medium', label: tr(language, 'filter.medium') }, { value: 'large', label: tr(language, 'filter.large') }]} />
              <label>{tr(language, 'filter.sleep')} <output>{sleepMin} {tr(language, 'common.days')}</output><input type="range" min="0" max="730" step="30" value={sleepMin} onChange={(event) => setSleepMin(Number(event.target.value))} /></label>
            </div>
            <div className="sidebar-block sources"><button type="button" className="sidebar-heading source-toggle" onClick={() => setShowSources(!showSources)}><span>{tr(language, 'source.title')}</span><b>{effective.roots.length + effective.projectPaths.length}</b></button>{showSources && <div className="source-list">{effective.roots.map((root) => <div key={root} title={root}><small>{tr(language, 'source.folder')}</small><span>{root}</span>{!state.settings.demoMode && <button aria-label={tr(language, 'source.remove')} onClick={() => void removeSource(root, 'folder')}>×</button>}</div>)}{effective.projectPaths.map((projectPath) => <div key={projectPath} title={projectPath}><small>{tr(language, 'source.project')}</small><span>{projectPath}</span>{!state.settings.demoMode && <button aria-label={tr(language, 'source.remove')} onClick={() => void removeSource(projectPath, 'project')}>×</button>}</div>)}</div>}</div>
            <div className="threshold"><label>{tr(language, 'settings.sleep')} <b>{state.settings.sleepAfterDays} {tr(language, 'settings.days')}</b></label><input type="range" min="30" max="730" step="30" value={state.settings.sleepAfterDays} onChange={(event) => void changeThreshold(Number(event.target.value))} /></div>
          </div>
        </details>
        <div className="local-note"><span>{tr(language, 'privacy.offline')}</span><p>{tr(language, 'privacy.local')}</p><div><i />{tr(language, 'privacy.noCloud')}<i />{tr(language, 'privacy.noTelemetry')}<i />{tr(language, 'privacy.controlled')}</div></div>
      </aside>

      <main className="content">
        <div className="content-head"><div className="title-cluster"><p className="eyebrow">{tr(language, view === 'cemetery' ? 'content.cemeteryEyebrow' : 'content.inventoryEyebrow')}</p><div className="title-line"><h1>{state.settings.demoMode ? tr(language, 'content.demo') : tr(language, 'content.overview')}</h1><div className="title-status"><button onClick={() => setStatus('alive')} className={status === 'alive' ? 'active' : ''}><span className="dot alive" /><b>{counts.alive}</b><small>{tr(language, 'status.alive')}</small></button><button onClick={() => setStatus('sleeping')} className={status === 'sleeping' ? 'active' : ''}><span className="dot sleeping" /><b>{counts.sleeping}</b><small>{tr(language, 'status.sleeping')}</small></button><button onClick={() => setStatus('dead')} className={status === 'dead' ? 'active' : ''}><span className="dot dead" /><b>{counts.dead}</b><small>{tr(language, 'status.dead')}</small></button><button className={status === 'all' ? 'active showing' : 'showing'} onClick={() => setStatus('all')}>{tr(language, 'content.showing')} {filtered.length}/{effective.projects.length}</button></div></div><p>{counts.sleeping ? `${counts.sleeping} ${tr(language, 'content.sleeping')}` : tr(language, 'content.healthy')}</p></div><label className="search"><span>⌕</span><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder={tr(language, 'content.search')} /></label></div>
        {view === 'cemetery' ? <Cemetery3D projects={showcase ? effective.projects : filtered} language={language} theme={state.settings.theme} statusCounts={counts} showcase={showcase} onExitShowcase={() => setShowcase(false)} onStatusFilter={setStatus} onSelect={(project) => setSelectedId(project.id)} /> : <ProjectList projects={filtered} language={language} onSelect={(project) => setSelectedId(project.id)} />}
      </main>

      {selected && <DetailDrawer project={selected} language={language} onClose={() => setSelectedId(undefined)} onFuneral={() => setFuneralId(selected.id)} onRevive={() => void revive(selected)} onOpen={() => state.settings.demoMode ? setMessage(tr(language, 'demo.noOpen')) : void window.graveyard?.openProject(selected.id).catch(fail)} onArchive={() => void archive(selected)} onTrash={() => void trash(selected)} />}
      {funeralProject && <FuneralModal project={funeralProject} language={language} onClose={() => setFuneralId(undefined)} onSubmit={(input) => void funeral(input)} />}
      {showReport && <ReportModal state={effective} language={language} onClose={() => setShowReport(false)} />}
      {message && <div className="toast" role="alert"><span>{message}</span><button onClick={() => setMessage(undefined)}>{tr(language, 'common.close')}</button></div>}
    </div>
  );
}
