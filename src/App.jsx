import { useEffect, useState } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import ProtectedRoute from './components/ProtectedRoute';
import Layout from './components/Layout';
import Login from './pages/Login';
import Users from './pages/Users';
import Lookups from './pages/Lookups';
import Transactions from './pages/Transactions';
import EmptyPage from './pages/EmptyPage';
import { useAuth } from './context/AuthContext';

export default function App() {
  const [theme, setTheme] = useState(() => localStorage.getItem('personalTrackerTheme') || 'light');
  const { isAuthenticated, user } = useAuth();
  useEffect(() => { document.documentElement.dataset.theme = theme; localStorage.setItem('personalTrackerTheme', theme); }, [theme]);
  const toggle = () => setTheme(v => v === 'light' ? 'dark' : 'light');
  const landing = user?.isSystem ? '/users' : '/home';
  return <Routes>
    <Route path="/login" element={<Login theme={theme} onToggleTheme={toggle}/>} />
    <Route element={<ProtectedRoute/>}><Route element={<Layout theme={theme} onToggleTheme={toggle}/>}> 
      <Route index element={<Navigate to={landing} replace/>}/>
      <Route path="home" element={user?.isSystem ? <Navigate to="/users" replace/> : <EmptyPage title="Home" description="Your personal finance workspace."/>}/>
      <Route path="summary" element={<EmptyPage title="Summary" description="Your financial summary will appear here."/>}/>
      <Route path="transactions" element={<Transactions/>}/>
      <Route path="lookups" element={<Lookups/>}/>
      <Route path="users" element={user?.isSystem ? <Users/> : <Navigate to="/home" replace/>}/>
    </Route></Route>
    <Route path="*" element={<Navigate to={isAuthenticated ? landing : '/login'} replace/>}/>
  </Routes>;
}
