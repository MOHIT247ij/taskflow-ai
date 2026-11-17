import { useState } from 'react';
import { api } from '../api';
import { useToast } from '../context';
import { formatDue } from '../utils';

/**
 * Natural-language task entry. Enter once -> AI parses into a preview.
 * Enter again (or click Add) -> task is created.
 */
export default function QuickAdd({ projectId, onCreated }) {
  const toast = useToast();
  const [text, setText] = useState('');
  const [preview, setPreview] = useState(null);
  const [busy, setBusy] = useState(false);

  const parse = async () => {
    if (!text.trim()) return;
    setBusy(true);
    try {
      const d = await api.post('/ai/parse', { text });
      setPreview({ ...d.task, source: d.source });
    } catch (e) {
      toast(e.message, 'error');
    } finally {
      setBusy(false);
    }
  };

  const create = async () => {
    setBusy(true);
    try {
      const { source, ...task } = preview;
      const d = await api.post('/tasks', { ...task, project: projectId, aiGenerated: source === 'gemini' });
      onCreated(d.task);
      setText('');
      setPreview(null);
      toast('Task added ✅', 'success');
    } catch (e) {
      toast(e.message, 'error');
    } finally {
      setBusy(false);
    }
  };

  const onKey = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      preview ? create() : parse();
    }
    if (e.key === 'Escape') setPreview(null);
  };

  return (
    <div className="quickadd">
      <div className="quickadd-bar">
        <span className="qa-icon">✨</span>
        <input
          value={text}
          onChange={(e) => { setText(e.target.value); setPreview(null); }}
          onKeyDown={onKey}
          placeholder='Try: "Prepare client demo by friday urgent #sales ~2h"'
          disabled={busy}
        />
        {preview
          ? <button className="btn btn-primary btn-sm" onClick={create} disabled={busy}>Add task ↵</button>
          : <button className="btn btn-soft btn-sm" onClick={parse} disabled={busy || !text.trim()}>{busy ? 'Parsing…' : 'AI Parse ↵'}</button>}
      </div>
      {preview && (
        <div className="qa-preview">
          <span className="muted small">{preview.source === 'gemini' ? 'Gemini understood:' : 'AI understood:'}</span>
          <b>{preview.title}</b>
          <span className={`pill p-${preview.priority}`}>{preview.priority}</span>
          {preview.dueDate && <span className="chip">📅 {formatDue(preview.dueDate)}</span>}
          {preview.estimateHours && <span className="chip">⏱ {preview.estimateHours}h</span>}
          {preview.tags?.map((t) => <span key={t} className="chip">#{t}</span>)}
        </div>
      )}
    </div>
  );
}
