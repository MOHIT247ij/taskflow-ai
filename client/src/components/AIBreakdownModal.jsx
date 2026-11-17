import { useState } from 'react';
import Modal from './Modal';
import { api } from '../api';
import { useToast } from '../context';
import { formatDue } from '../utils';

const EXAMPLES = ['Build a portfolio website with blog', 'Prepare for data analyst interview', 'Launch our mobile app on Play Store', 'Write a research paper on Fashion-MNIST'];

export default function AIBreakdownModal({ projectId, onClose, onCreated }) {
  const toast = useToast();
  const [goal, setGoal] = useState('');
  const [result, setResult] = useState(null);
  const [selected, setSelected] = useState({});
  const [busy, setBusy] = useState(false);

  const generate = async (e) => {
    e?.preventDefault();
    if (!goal.trim()) return;
    setBusy(true);
    try {
      const d = await api.post('/ai/breakdown', { goal, projectId });
      setResult(d);
      setSelected(Object.fromEntries(d.tasks.map((_, i) => [i, true])));
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      setBusy(false);
    }
  };

  const updateTitle = (i, title) => setResult((r) => ({ ...r, tasks: r.tasks.map((t, j) => (j === i ? { ...t, title } : t)) }));

  const addToBoard = async () => {
    const tasks = result.tasks.filter((_, i) => selected[i]);
    if (!tasks.length) return toast('Select at least one task', 'error');
    setBusy(true);
    try {
      const d = await api.post('/tasks/bulk', { project: projectId, tasks });
      onCreated(d.tasks);
      toast(`${d.tasks.length} AI tasks added to board 🚀`, 'success');
      onClose();
    } catch (err) {
      toast(err.message, 'error');
      setBusy(false);
    }
  };

  const count = Object.values(selected).filter(Boolean).length;
  const hours = result?.tasks.reduce((s, t, i) => s + (selected[i] ? t.estimateHours || 0 : 0), 0);

  return (
    <Modal
      title="✨ AI Goal Breakdown"
      onClose={onClose}
      width={640}
      footer={result && (
        <>
          <span className="muted small grow">{count} tasks · ~{hours}h estimated · via {result.source === 'gemini' ? 'Gemini' : 'built-in AI'}</span>
          <button className="btn btn-ghost" onClick={() => setResult(null)}>Start over</button>
          <button className="btn btn-primary" onClick={addToBoard} disabled={busy}>Add {count} to board</button>
        </>
      )}
    >
      {!result ? (
        <form onSubmit={generate} className="form">
          <p className="muted">Describe a goal or outcome. AI will create an ordered plan with estimates, priorities and deadlines.</p>
          <textarea autoFocus rows={3} value={goal} onChange={(e) => setGoal(e.target.value)} placeholder="e.g. Build an inventory dashboard for our warehouse team" maxLength={500} />
          <div className="examples">
            {EXAMPLES.map((ex) => <button type="button" key={ex} className="chip chip-btn" onClick={() => setGoal(ex)}>{ex}</button>)}
          </div>
          <button className="btn btn-primary btn-block" disabled={busy || !goal.trim()}>{busy ? 'AI is planning…' : 'Generate plan'}</button>
        </form>
      ) : (
        <ol className="breakdown">
          {result.tasks.map((t, i) => (
            <li key={i} className={selected[i] ? '' : 'off'}>
              <input type="checkbox" checked={!!selected[i]} onChange={(e) => setSelected({ ...selected, [i]: e.target.checked })} />
              <div className="grow">
                <input className="inline-input" value={t.title} onChange={(e) => updateTitle(i, e.target.value)} />
                <div className="row gap-sm small muted">
                  <span className={`pill p-${t.priority}`}>{t.priority}</span>
                  {t.estimateHours && <span>⏱ {t.estimateHours}h</span>}
                  {t.dueDate && <span>📅 {formatDue(t.dueDate)}</span>}
                  {t.tags?.map((tag) => <span key={tag}>#{tag}</span>)}
                </div>
              </div>
            </li>
          ))}
        </ol>
      )}
    </Modal>
  );
}
