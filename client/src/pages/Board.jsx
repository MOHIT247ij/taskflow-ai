import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useOutletContext, useParams } from 'react-router-dom';
import { api } from '../api';
import { useToast } from '../context';
import { PRIORITIES, STATUSES, formatDue, isOverdue } from '../utils';
import QuickAdd from '../components/QuickAdd';
import TaskModal from '../components/TaskModal';
import AIBreakdownModal from '../components/AIBreakdownModal';
import ProjectModal from '../components/ProjectModal';

function TaskCard({ task, onOpen, onDragStart, onDropBefore }) {
  const subDone = task.subtasks?.filter((s) => s.done).length || 0;
  const subTotal = task.subtasks?.length || 0;
  return (
    <article
      className={`task-card prio-${task.priority}`}
      draggable
      onDragStart={(e) => { e.dataTransfer.effectAllowed = 'move'; onDragStart(task._id); }}
      onDragOver={(e) => e.preventDefault()}
      onDrop={(e) => { e.preventDefault(); e.stopPropagation(); onDropBefore(task._id); }}
      onClick={() => onOpen(task)}
    >
      <div className="row between">
        <span className={`pill p-${task.priority}`}>{task.priority}</span>
        {task.aiGenerated && <span className="ai-tag" title="Created with AI">✨ AI</span>}
      </div>
      <h4 className={task.status === 'done' ? 'strike' : ''}>{task.title}</h4>
      {task.tags?.length > 0 && (
        <div className="tags">{task.tags.slice(0, 3).map((t) => <span key={t}>#{t}</span>)}</div>
      )}
      <div className="card-meta">
        {task.dueDate && <span className={`due ${isOverdue(task) ? 'overdue' : ''}`}>📅 {formatDue(task.dueDate)}</span>}
        {task.estimateHours ? <span>⏱ {task.estimateHours}h</span> : null}
        {subTotal > 0 && <span>☑ {subDone}/{subTotal}</span>}
      </div>
    </article>
  );
}

export default function Board() {
  const { id } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const { projects, refreshProjects, refreshAi } = useOutletContext();
  const project = projects.find((p) => p._id === id);

  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dragId, setDragId] = useState(null);
  const [overCol, setOverCol] = useState(null);
  const [openTask, setOpenTask] = useState(null);
  const [showAI, setShowAI] = useState(false);
  const [editProject, setEditProject] = useState(false);
  const [search, setSearch] = useState('');
  const [prioFilter, setPrioFilter] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const d = await api.get(`/tasks?project=${id}`);
      setTasks(d.tasks);
    } catch (e) {
      toast(e.message, 'error');
    } finally {
      setLoading(false);
    }
  }, [id, toast]);

  useEffect(() => { load(); }, [load]);

  const afterChange = () => { refreshProjects(); refreshAi(); };

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    return tasks.filter((t) =>
      (!prioFilter || t.priority === prioFilter) &&
      (!q || t.title.toLowerCase().includes(q) || t.tags?.some((tag) => tag.includes(q))));
  }, [tasks, search, prioFilter]);

  const columns = useMemo(
    () => STATUSES.map((s) => ({ ...s, tasks: visible.filter((t) => t.status === s.key).sort((a, b) => a.order - b.order) })),
    [visible]
  );

  // Drag & drop: reorder target column locally (optimistic UI), then persist in one bulk request
  const handleDrop = async (status, beforeId = null) => {
    setOverCol(null);
    const dragged = tasks.find((t) => t._id === dragId);
    if (!dragged || beforeId === dragId) return;

    const col = tasks.filter((t) => t.status === status && t._id !== dragId).sort((a, b) => a.order - b.order);
    const idx = beforeId ? Math.max(0, col.findIndex((t) => t._id === beforeId)) : col.length;
    col.splice(idx, 0, { ...dragged, status, completedAt: status === 'done' ? dragged.completedAt || new Date().toISOString() : null });
    const updated = col.map((t, i) => ({ ...t, order: i }));
    const byId = Object.fromEntries(updated.map((t) => [t._id, t]));

    const prev = tasks;
    setTasks((ts) => ts.map((t) => byId[t._id] || t));
    setDragId(null);
    try {
      await api.patch('/tasks/reorder', { items: updated.map(({ _id, status: s, order }) => ({ id: _id, status: s, order })) });
      if (status === 'done' && dragged.status !== 'done') toast(`🎉 Completed "${dragged.title}"`, 'success');
      afterChange();
    } catch (e) {
      setTasks(prev);
      toast(e.message, 'error');
    }
  };

  const saveProject = async (data) => {
    await api.patch(`/projects/${id}`, data);
    await refreshProjects();
    toast('Project updated', 'success');
  };

  const deleteProject = async () => {
    if (!window.confirm(`Delete "${project.name}" and all its tasks?`)) return;
    try {
      await api.del(`/projects/${id}`);
      await refreshProjects();
      toast('Project deleted');
      navigate('/');
    } catch (e) {
      toast(e.message, 'error');
    }
  };

  if (!project && !loading) {
    return <div className="page"><div className="empty"><h2>Project not found</h2><button className="btn btn-primary" onClick={() => navigate('/')}>Back to dashboard</button></div></div>;
  }

  const done = tasks.filter((t) => t.status === 'done').length;
  const progress = tasks.length ? Math.round((done / tasks.length) * 100) : 0;

  return (
    <div className="page board-page">
      <header className="page-head">
        <div className="grow">
          <div className="row gap-sm">
            <span className="dot dot-lg" style={{ background: project?.color }} />
            <h1>{project?.name}</h1>
            <button className="icon-btn" title="Edit project" onClick={() => setEditProject(true)}>✎</button>
            <button className="icon-btn" title="Delete project" onClick={deleteProject}>🗑</button>
          </div>
          {project?.description && <p className="muted">{project.description}</p>}
          <div className="row gap-sm progress-row">
            <div className="progress wide"><span style={{ width: `${progress}%`, background: project?.color }} /></div>
            <span className="small muted">{done}/{tasks.length} done · {progress}%</span>
          </div>
        </div>
        <button className="btn btn-gradient" onClick={() => setShowAI(true)}>✨ AI Breakdown</button>
      </header>

      <QuickAdd projectId={id} onCreated={(t) => { setTasks((ts) => [...ts, t]); afterChange(); }} />

      <div className="toolbar">
        <input className="search" placeholder="🔍 Search tasks or #tags" value={search} onChange={(e) => setSearch(e.target.value)} />
        <div className="seg">
          <button className={!prioFilter ? 'active' : ''} onClick={() => setPrioFilter('')}>All</button>
          {PRIORITIES.map((p) => <button key={p} className={prioFilter === p ? 'active' : ''} onClick={() => setPrioFilter(p)}>{p}</button>)}
        </div>
      </div>

      {loading ? (
        <div className="kanban">{STATUSES.map((s) => <div key={s.key} className="column"><div className="skeleton" style={{ height: 120 }} /></div>)}</div>
      ) : (
        <div className="kanban">
          {columns.map((col) => (
            <section
              key={col.key}
              className={`column ${overCol === col.key ? 'drag-over' : ''}`}
              onDragOver={(e) => { e.preventDefault(); setOverCol(col.key); }}
              onDragLeave={(e) => { if (!e.currentTarget.contains(e.relatedTarget)) setOverCol(null); }}
              onDrop={(e) => { e.preventDefault(); handleDrop(col.key); }}
            >
              <header className="column-head">
                <span className="dot" style={{ background: col.color }} />
                <h3>{col.label}</h3>
                <span className="count">{col.tasks.length}</span>
              </header>
              <div className="column-body">
                {col.tasks.map((t) => (
                  <TaskCard key={t._id} task={t} onOpen={setOpenTask} onDragStart={setDragId} onDropBefore={(beforeId) => handleDrop(col.key, beforeId)} />
                ))}
                {!col.tasks.length && <div className="column-empty">Drop tasks here</div>}
              </div>
            </section>
          ))}
        </div>
      )}

      {openTask && (
        <TaskModal
          task={openTask}
          onClose={() => setOpenTask(null)}
          onSaved={(t) => { setTasks((ts) => ts.map((x) => (x._id === t._id ? t : x))); afterChange(); }}
          onDeleted={(tid) => { setTasks((ts) => ts.filter((x) => x._id !== tid)); afterChange(); }}
        />
      )}
      {showAI && (
        <AIBreakdownModal projectId={id} onClose={() => setShowAI(false)} onCreated={(created) => { setTasks((ts) => [...ts, ...created]); afterChange(); }} />
      )}
      {editProject && project && <ProjectModal initial={project} onClose={() => setEditProject(false)} onSave={saveProject} />}
    </div>
  );
}
