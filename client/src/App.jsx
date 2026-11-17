import { Navigate, Route, Routes } from 'react-router-dom';
import { useAuth } from './context';
import AuthPage from './pages/AuthPage';
import Dashboard from './pages/Dashboard';
import Board from './pages/Board';
import Layout from './components/Layout';

function Protected({ children }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="splash"><div className="spinner" /></div>;
  return user ? children : <Navigate to="/login" replace />;
}

export default function App() {
  const { user } = useAuth();
  return (
    <Routes>
      <Route path="/login" element={user ? <Navigate to="/" replace /> : <AuthPage mode="login" />} />
      <Route path="/register" element={user ? <Navigate to="/" replace /> : <AuthPage mode="register" />} />
      <Route element={<Protected><Layout /></Protected>}>
        <Route path="/" element={<Dashboard />} />
        <Route path="/projects/:id" element={<Board />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
