import { useCallback, useEffect, useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { api } from '../api';
import { useAuth, useToast } from '../context';
import ProjectModal from './ProjectModal';

export default function Layout() {
  const { user, logout } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const [projects, setProjects] = useState([]);
  const [aiStatus, setAiStatus] = useState(null);
  const [showNew, setShowNew] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  const refreshProjects = useCallback(async () => {
    try {
      const d = await api.get('/projects');
      setProjects(d.projects);
    } catch (e) {
      toast(e.message, 'error');
    }
  }, [toast]);

  const refreshAi = useCallback(() => api.get('/ai/status').then(setAiStatus).catch(() => {}), []);

  useEffect(() => {
    refreshProjects();
    refreshAi();
  }, [refreshProjects, refreshAi]);

  const createProject = async (data) => {
    const d = await api.post('/projects', data);
    await refreshProjects();
    toast('Project created 🎉', 'success');
    navigate(`/projects/${d.project._id}`);
  };

  return (
    <div className={`app ${menuOpen ? 'menu-open' : ''}`}>
      <aside className="sidebar" onClick={() => setMenuOpen(false)}>
        <div className="brand"><span className="logo">⚡</span> TaskFlow <b>AI</b></div>

        <nav className="nav">
          <NavLink to="/" end className="nav-item"><span>📊</span> Dashboard</NavLink>
        </nav>

        <div className="nav-section">
          <span>Projects</span>
          <button className="icon-btn" title="New project" onClick={(e) => { e.stopPropagation(); setShowNew(true); }}>＋</button>
        </div>
        <nav className="nav projects-nav">
          {projects.map((p) => (
            <NavLink key={p._id} to={`/projects/${p._id}`} className="nav-item project-item">
              <span className="dot" style={{ background: p.color }} />
              <span className="grow ellipsis">{p.name}</span>
              <span className="count">{p.taskCount - p.doneCount}</span>
            </NavLink>
          ))}
          {!projects.length && <p className="muted small pad">No projects yet.</p>}
        </nav>

        <div className="sidebar-footer">
          {aiStatus && (
            <div className="ai-chip" title="AI engine powering smart features">
              <span className={`pulse ${aiStatus.engine}`} />
              {aiStatus.engine === 'gemini' ? `Gemini AI · ${aiStatus.credits} credits` : 'Built-in AI engine'}
            </div>
          )}
          <div className="user">
            <div className="avatar">{user?.name?.[0]?.toUpperCase()}</div>
            <div className="grow">
              <div className="ellipsis"><b>{user?.name}</b></div>
              <div className="muted small">{user?.plan?.toUpperCase()} plan</div>
            </div>
            <button className="icon-btn" title="Log out" onClick={logout} aria-label="Log out">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><polyline points="16 17 21 12 16 7" /><line x1="21" y1="12" x2="9" y2="12" /></svg>
            </button>
          </div>
        </div>
      </aside>

      <main className="main">
        <button className="menu-toggle" onClick={() => setMenuOpen((o) => !o)}>☰</button>
        <Outlet context={{ projects, refreshProjects, refreshAi }} />
      </main>

      {showNew && <ProjectModal onClose={() => setShowNew(false)} onSave={createProject} />}
    </div>
  );
}
