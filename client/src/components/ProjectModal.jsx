import { useState } from 'react';
import Modal from './Modal';
import { PROJECT_COLORS } from '../utils';

export default function ProjectModal({ initial, onClose, onSave }) {
  const [form, setForm] = useState({ name: initial?.name || '', description: initial?.description || '', color: initial?.color || PROJECT_COLORS[0] });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      await onSave(form);
      onClose();
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  };

  return (
    <Modal title={initial ? 'Edit project' : 'New project'} onClose={onClose}>
      <form onSubmit={submit} className="form">
        <label>Name<input autoFocus value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. Website Revamp" required maxLength={80} /></label>
        <label>Description<textarea rows={3} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="What is this project about? (helps the AI plan better)" /></label>
        <div>
          <span className="label">Color</span>
          <div className="swatches">
            {PROJECT_COLORS.map((c) => (
              <button type="button" key={c} className={`swatch ${form.color === c ? 'active' : ''}`} style={{ background: c }} onClick={() => setForm({ ...form, color: c })} aria-label={c} />
            ))}
          </div>
        </div>
        {error && <div className="form-error">{error}</div>}
        <div className="row end">
          <button type="button" className="btn btn-ghost" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" disabled={busy}>{busy ? 'Saving…' : 'Save project'}</button>
        </div>
      </form>
    </Modal>
  );
}
