import { useState } from 'react';
import Modal from './Modal';
import { api } from '../api';
import { useToast } from '../context';
import { PRIORITIES, STATUSES, fromDateInput, toDateInput } from '../utils';

export default function TaskModal({ task, onClose, onSaved, onDeleted }) {
  const toast = useToast();
  const [form, setForm] = useState({
    title: task.title,
    description: task.description || '',
    status: task.status,
    priority: task.priority,
    dueDate: task.dueDate,
    estimateHours: task.estimateHours ?? '',
    tags: (task.tags || []).join(', '),
    subtasks: task.subtasks || [],
  });
  const [newSub, setNewSub] = useState('');
  const [suggestion, setSuggestion] = useState(null);
  const [busy, setBusy] = useState(false);
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const suggest = async () => {
    try {
      const d = await api.post('/ai/priority', { title: form.title, description: form.description, dueDate: form.dueDate });
      setSuggestion(d);
    } catch (e) {
      toast(e.message, 'error');
    }
  };

  const save = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      const payload = {
        ...form,
        estimateHours: form.estimateHours === '' ? null : Number(form.estimateHours),
        tags: form.tags.split(',').map((t) => t.trim().replace(/^#/, '').toLowerCase()).filter(Boolean),
        subtasks: form.subtasks.map(({ _id, title, done }) => (_id ? { _id, title, done } : { title, done })),
      };
      const d = await api.patch(`/tasks/${task._id}`, payload);
      onSaved(d.task);
      toast('Task saved', 'success');
      onClose();
    } catch (err) {
      toast(err.message, 'error');
      setBusy(false);
    }
  };

  const remove = async () => {
    if (!window.confirm('Delete this task?')) return;
    try {
      await api.del(`/tasks/${task._id}`);
      onDeleted(task._id);
      toast('Task deleted');
      onClose();
    } catch (e) {
      toast(e.message, 'error');
    }
  };

  const addSub = () => {
    if (!newSub.trim()) return;
    set('subtasks', [...form.subtasks, { title: newSub.trim(), done: false }]);
    setNewSub('');
  };

  return (
    <Modal title={task.aiGenerated ? 'Edit task ✨' : 'Edit task'} onClose={onClose} width={620}>
      <form className="form" onSubmit={save}>
        <input className="title-input" value={form.title} onChange={(e) => set('title', e.target.value)} required maxLength={200} />
        <textarea rows={3} placeholder="Add a description…" value={form.description} onChange={(e) => set('description', e.target.value)} />

        <div className="grid-3">
          <label>Status
            <select value={form.status} onChange={(e) => set('status', e.target.value)}>
              {STATUSES.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
            </select>
          </label>
          <label>Priority
            <select value={form.priority} onChange={(e) => set('priority', e.target.value)}>
              {PRIORITIES.map((p) => <option key={p} value={p}>{p[0].toUpperCase() + p.slice(1)}</option>)}
            </select>
          </label>
          <label>Due date
            <input type="date" value={toDateInput(form.dueDate)} onChange={(e) => set('dueDate', fromDateInput(e.target.value))} />
          </label>
          <label>Estimate (h)
            <input type="number" min="0" step="0.5" value={form.estimateHours} onChange={(e) => set('estimateHours', e.target.value)} />
          </label>
          <label className="span-2">Tags
            <input value={form.tags} onChange={(e) => set('tags', e.target.value)} placeholder="frontend, bug" />
          </label>
        </div>

        <div className="ai-suggest">
          <button type="button" className="btn btn-soft btn-sm" onClick={suggest}>✨ Suggest priority</button>
          {suggestion && (
            <span className="small">
              AI suggests <span className={`pill p-${suggestion.priority}`}>{suggestion.priority}</span> — {suggestion.reason}{' '}
              {suggestion.priority !== form.priority && <button type="button" className="link" onClick={() => set('priority', suggestion.priority)}>Apply</button>}
            </span>
          )}
        </div>

        <div>
          <span className="label">Subtasks ({form.subtasks.filter((s) => s.done).length}/{form.subtasks.length})</span>
          <ul className="subtasks">
            {form.subtasks.map((s, i) => (
              <li key={s._id || i}>
                <input type="checkbox" checked={s.done} onChange={(e) => set('subtasks', form.subtasks.map((x, j) => (j === i ? { ...x, done: e.target.checked } : x)))} />
                <span className={`grow ${s.done ? 'strike' : ''}`}>{s.title}</span>
                <button type="button" className="icon-btn" onClick={() => set('subtasks', form.subtasks.filter((_, j) => j !== i))}>✕</button>
              </li>
            ))}
          </ul>
          <div className="row gap-sm">
            <input value={newSub} onChange={(e) => setNewSub(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addSub(); } }} placeholder="Add subtask and press Enter" />
            <button type="button" className="btn btn-ghost btn-sm" onClick={addSub}>Add</button>
          </div>
        </div>

        <div className="row between">
          <button type="button" className="btn btn-danger-ghost" onClick={remove}>Delete</button>
          <div className="row gap-sm">
            <button type="button" className="btn btn-ghost" onClick={onClose}>Cancel</button>
            <button className="btn btn-primary" disabled={busy}>{busy ? 'Saving…' : 'Save changes'}</button>
          </div>
        </div>
      </form>
    </Modal>
  );
}
