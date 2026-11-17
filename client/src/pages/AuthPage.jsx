import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context';

const FEATURES = [
  ['✨', 'AI Quick Add', 'Type "Demo for client by friday urgent" — AI fills priority, date & tags.'],
  ['🧩', 'Goal → Tasks', 'Describe a goal, AI breaks it into an actionable plan.'],
  ['📊', 'Smart Insights', 'Velocity, overdue risk and daily focus — computed for you.'],
];

export default function AuthPage({ mode }) {
  const isLogin = mode === 'login';
  const { authenticate } = useAuth();
  const [form, setForm] = useState({ name: '', email: '', password: '' });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      await authenticate(isLogin ? 'login' : 'register', isLogin ? { email: form.email, password: form.password } : form);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const fillDemo = () => setForm({ name: '', email: 'demo@taskflow.ai', password: 'demo1234' });
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  return (
    <div className="auth">
      <section className="auth-hero">
        <div className="brand brand-lg"><span className="logo">⚡</span> TaskFlow <b>AI</b></div>
        <h1>Plan less.<br />Ship more.</h1>
        <p className="muted-light">The AI-powered workspace that turns messy goals into organised, prioritised work.</p>
        <ul className="feature-list">
          {FEATURES.map(([icon, title, text]) => (
            <li key={title}><span>{icon}</span><div><b>{title}</b><p>{text}</p></div></li>
          ))}
        </ul>
      </section>

      <section className="auth-panel">
        <form className="auth-card" onSubmit={submit}>
          <h2>{isLogin ? 'Welcome back 👋' : 'Create your workspace'}</h2>
          <p className="muted">{isLogin ? 'Log in to continue to your board.' : 'Free plan · 50 AI credits included.'}</p>

          {!isLogin && (
            <label>Full name<input value={form.name} onChange={set('name')} placeholder="Mohit Hingase" required /></label>
          )}
          <label>Email<input type="email" value={form.email} onChange={set('email')} placeholder="you@example.com" required /></label>
          <label>Password<input type="password" value={form.password} onChange={set('password')} placeholder="Min. 6 characters" minLength={6} required /></label>

          {error && <div className="form-error">{error}</div>}
          <button className="btn btn-primary btn-block" disabled={busy}>{busy ? 'Please wait…' : isLogin ? 'Log in' : 'Create account'}</button>

          {isLogin && (
            <button type="button" className="btn btn-ghost btn-block" onClick={fillDemo}>Use demo account</button>
          )}
          <p className="switch">
            {isLogin ? "Don't have an account? " : 'Already have an account? '}
            <Link to={isLogin ? '/register' : '/login'}>{isLogin ? 'Sign up' : 'Log in'}</Link>
          </p>
        </form>
      </section>
    </div>
  );
}
