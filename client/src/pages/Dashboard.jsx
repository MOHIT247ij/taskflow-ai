import { useEffect, useState } from 'react';
import { Link, useOutletContext } from 'react-router-dom';
import { api } from '../api';
import { useAuth, useToast } from '../context';
import { formatDue, greeting, timeAgo } from '../utils';

function StatCard({ label, value, hint, tone }) {
  return (
    <div className={`stat ${tone || ''}`}>
      <span className="stat-label">{label}</span>
      <span className="stat-value">{value}</span>
      {hint && <span className="stat-hint">{hint}</span>}
    </div>
  );
}

function WeeklyChart({ daily }) {
  const max = Math.max(1, ...daily.map((d) => d.count));
  return (
    <div className="bars">
      {daily.map((d) => (
        <div key={d.date} className="bar-col" title={`${d.count} completed on ${d.date}`}>
          <span className="bar-num">{d.count || ''}</span>
          <div className="bar" style={{ height: `${(d.count / max) * 100}%` }} />
          <span className="bar-label">{d.label}</span>
        </div>
      ))}
    </div>
  );
}

const PRIORITY_COLORS = { urgent: '#ef4444', high: '#f97316', medium: '#6366f1', low: '#94a3b8' };

function PriorityBreakdown({ priority }) {
  const total = Object.values(priority).reduce((a, b) => a + b, 0) || 1;
  return (
    <div className="prio-breakdown">
      <div className="stack-bar">
        {Object.entries(priority).map(([k, v]) => v > 0 && <span key={k} style={{ width: `${(v / total) * 100}%`, background: PRIORITY_COLORS[k] }} />)}
      </div>
      <ul className="legend">
        {Object.entries(priority).map(([k, v]) => (
          <li key={k}><span className="dot" style={{ background: PRIORITY_COLORS[k] }} />{k}<b>{v}</b></li>
        ))}
      </ul>
    </div>
  );
}

export default function Dashboard() {
  const { user } = useAuth();
  const toast = useToast();
  const { projects } = useOutletContext();
  const [data, setData] = useState(null);
  const [insights, setInsights] = useState(null);
  const [loadingInsights, setLoadingInsights] = useState(false);

  const loadInsights = async () => {
    setLoadingInsights(true);
    try {
      setInsights(await api.get('/dashboard/insights'));
    } catch (e) {
      toast(e.message, 'error');
    } finally {
      setLoadingInsights(false);
    }
  };

  useEffect(() => {
    api.get('/dashboard/summary').then(setData).catch((e) => toast(e.message, 'error'));
    loadInsights();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!data) return <div className="page"><div className="skeleton-grid">{[...Array(4)].map((_, i) => <div key={i} className="skeleton" />)}</div></div>;
  const { stats, recent, upcoming } = data;

  return (
    <div className="page">
      <header className="page-head">
        <div>
          <h1>{greeting()}, {user?.name?.split(' ')[0]} 👋</h1>
          <p className="muted">Here’s what’s happening across your {projects.length} project{projects.length === 1 ? '' : 's'}.</p>
        </div>
      </header>

      <section className="card ai-card">
        <div className="ai-card-head">
          <div className="row gap">
            <span className="ai-icon">✨</span>
            <div>
              <h3>AI Daily Briefing</h3>
              {insights && <span className="badge">{insights.source === 'gemini' ? 'Gemini' : 'Built-in AI'}</span>}
            </div>
          </div>
          <button className="btn btn-ghost btn-sm" onClick={loadInsights} disabled={loadingInsights}>{loadingInsights ? 'Thinking…' : '↻ Refresh'}</button>
        </div>
        {insights ? (
          <div className="ai-card-body">
            <p className="headline">{insights.headline}</p>
            <ul className="insights">{insights.insights.map((i) => <li key={i}>{i}</li>)}</ul>
            {insights.focus?.length > 0 && (
              <div className="focus">
                <span className="label">Today’s focus</span>
                {insights.focus.map((t, i) => (
                  <div key={t._id} className="focus-item">
                    <span className="focus-num">{i + 1}</span>
                    <span className="grow">{t.title}</span>
                    <span className={`pill p-${t.priority}`}>{t.priority}</span>
                    {t.dueDate && <span className="muted small">{formatDue(t.dueDate)}</span>}
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : <div className="skeleton" style={{ height: 90 }} />}
      </section>

      <section className="stats">
        <StatCard label="Total tasks" value={stats.total} hint={`${stats.aiGenerated} created by AI`} />
        <StatCard label="Completion" value={`${stats.completionRate}%`} hint={`${stats.done} done`} tone="green" />
        <StatCard label="In progress" value={stats.inProgress} hint={`${stats.review} in review`} tone="blue" />
        <StatCard label="Overdue" value={stats.overdue} hint={`${stats.dueSoon} due in 48h`} tone={stats.overdue ? 'red' : ''} />
        <StatCard label="Open workload" value={`${stats.openHours}h`} hint="estimated effort" tone="purple" />
      </section>

      <section className="grid-2">
        <div className="card">
          <div className="card-head"><h3>Completed this week</h3><span className="muted small">{stats.completedThisWeek} vs {stats.completedLastWeek} last week</span></div>
          <WeeklyChart daily={stats.daily} />
        </div>
        <div className="card">
          <div className="card-head"><h3>Open work by priority</h3></div>
          <PriorityBreakdown priority={stats.priority} />
          <div className="project-progress">
            {projects.map((p) => (
              <Link key={p._id} to={`/projects/${p._id}`} className="pp-row">
                <span className="dot" style={{ background: p.color }} />
                <span className="grow ellipsis">{p.name}</span>
                <div className="progress"><span style={{ width: `${p.progress}%`, background: p.color }} /></div>
                <span className="small muted pp-pct">{p.progress}%</span>
              </Link>
            ))}
          </div>
        </div>
      </section>

      <section className="grid-2">
        <div className="card">
          <div className="card-head"><h3>Upcoming deadlines</h3></div>
          {upcoming.length ? (
            <ul className="list">
              {upcoming.map((t) => (
                <li key={t._id}>
                  <span className="dot" style={{ background: t.project?.color }} />
                  <span className="grow ellipsis">{t.title}</span>
                  <span className={`pill p-${t.priority}`}>{t.priority}</span>
                  <span className={`due ${new Date(t.dueDate) < new Date() ? 'overdue' : ''}`}>{formatDue(t.dueDate)}</span>
                </li>
              ))}
            </ul>
          ) : <p className="muted">No upcoming deadlines 🎉</p>}
        </div>
        <div className="card">
          <div className="card-head"><h3>Recent activity</h3></div>
          {recent.length ? (
            <ul className="list activity">
              {recent.map((a) => (
                <li key={a._id}>
                  <span className="act-icon">{a.action.startsWith('ai') ? '✨' : a.action.includes('moved') ? '➜' : a.action.includes('deleted') ? '🗑' : '＋'}</span>
                  <span className="grow">{a.message}</span>
                  <span className="muted small">{timeAgo(a.createdAt)}</span>
                </li>
              ))}
            </ul>
          ) : <p className="muted">No activity yet.</p>}
        </div>
      </section>
    </div>
  );
}
