import { useEffect, useState } from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import { Home, ArrowLeftRight, ListTree, Users, LogOut, Menu, X, WalletCards, Sun, Moon, KeyRound, ChevronUp } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { usersApi } from '../services/api';

export default function Layout({ theme, onToggleTheme }) {
  const { user, logout } = useAuth();
  const [open, setOpen] = useState(false);
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const [passwordDialogOpen, setPasswordDialogOpen] = useState(false);
  const [passwords, setPasswords] = useState({ current: '', next: '', confirm: '' });
  const [passwordError, setPasswordError] = useState('');
  const [passwordSuccess, setPasswordSuccess] = useState('');
  const [passwordSaving, setPasswordSaving] = useState(false);
  const isSystem = !!user?.isSystem;
  const links = isSystem ? [{ to: '/users', label: 'Users', icon: Users }] : [
    { to: '/home', label: 'Home', icon: Home },
    { to: '/transactions', label: 'Transactions', icon: ArrowLeftRight },
    { to: '/lookups', label: 'LookUps', icon: ListTree }
  ];
  const closePasswordDialog = () => {
    setPasswordDialogOpen(false);
    setPasswords({ current: '', next: '', confirm: '' });
    setPasswordError('');
    setPasswordSuccess('');
  };

  useEffect(() => {
    if (!passwordDialogOpen) return undefined;
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') closePasswordDialog();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [passwordDialogOpen]);

  const submitPasswordChange = async (event) => {
    event.preventDefault();
    setPasswordError('');
    setPasswordSuccess('');
    if (passwords.next !== passwords.confirm) {
      setPasswordError('New passwords do not match.');
      return;
    }
    setPasswordSaving(true);
    try {
      await usersApi.changePassword({ old_password: passwords.current, new_password: passwords.next });
      setPasswordSuccess('Password changed successfully.');
      setPasswords({ current: '', next: '', confirm: '' });
    } catch (error) {
      setPasswordError(error.message);
    } finally {
      setPasswordSaving(false);
    }
  };
  return <div className="app-shell">
    <aside className={`sidebar ${open ? 'mobile-open' : ''}`}>
      <div className="brand"><div className="brand-mark"><WalletCards size={18}/></div><span>Personal Tracker</span></div>
      <nav>{links.map(({ to, label, icon: Icon }) => <NavLink key={to} to={to} onClick={() => setOpen(false)} className={({isActive}) => `nav-link ${isActive ? 'active' : ''}`}><Icon size={18}/><span>{label}</span></NavLink>)}</nav>
      <div className="sidebar-bottom">
        {profileMenuOpen && <div className="profile-menu" role="menu" aria-label="Profile options">
          <button className="profile-menu-item" role="menuitem" onClick={() => { onToggleTheme(); setProfileMenuOpen(false); }}>
            {theme === 'light' ? <Moon size={17}/> : <Sun size={17}/>}<span>Switch to {theme === 'light' ? 'dark' : 'light'} theme</span>
          </button>
          <button className="profile-menu-item" role="menuitem" onClick={() => { setProfileMenuOpen(false); setPasswordDialogOpen(true); }}><KeyRound size={17}/><span>Change password</span></button>
          <button className="profile-menu-item danger" role="menuitem" onClick={logout}><LogOut size={17}/><span>Sign out</span></button>
        </div>}
        <button className="profile profile-trigger" aria-expanded={profileMenuOpen} aria-haspopup="menu" onClick={() => setProfileMenuOpen(value => !value)}>
          <span className="avatar">{(user?.user_name || 'U').charAt(0).toUpperCase()}</span><span className="profile-text"><strong>{user?.user_name || 'User'}</strong><span>{isSystem ? 'System' : 'Personal account'}</span></span><ChevronUp className={profileMenuOpen ? '' : 'profile-chevron-closed'} size={16}/>
        </button>
      </div>
    </aside>
    {open && <button className="mobile-overlay" onClick={() => setOpen(false)} aria-label="Close menu"/>}
    <main className="main-area">
      <button className="mobile-menu" onClick={() => setOpen(v => !v)} aria-label={open ? 'Close menu' : 'Open menu'}>{open ? <X/> : <Menu/>}</button>
      <section className="page-content"><Outlet /></section>
    </main>
    {passwordDialogOpen && <div className="dialog-backdrop" onMouseDown={event => { if (event.target === event.currentTarget) closePasswordDialog(); }}>
      <section className="password-dialog" role="dialog" aria-modal="true" aria-labelledby="password-dialog-title">
        <div className="dialog-heading"><h2 id="password-dialog-title">Change password</h2><button className="dialog-close" aria-label="Close" onClick={closePasswordDialog}><X size={18}/></button></div>
        <form onSubmit={submitPasswordChange}>
          <label>Current password<input type="password" autoComplete="current-password" required value={passwords.current} onChange={event => setPasswords(value => ({ ...value, current: event.target.value }))}/></label>
          <label>New password<input type="password" autoComplete="new-password" required minLength={8} value={passwords.next} onChange={event => setPasswords(value => ({ ...value, next: event.target.value }))}/></label>
          <label>Confirm new password<input type="password" autoComplete="new-password" required minLength={8} value={passwords.confirm} onChange={event => setPasswords(value => ({ ...value, confirm: event.target.value }))}/></label>
          {passwordError && <div className="form-error" role="alert">{passwordError}</div>}
          {passwordSuccess && <div className="form-success" role="status">{passwordSuccess}</div>}
          <div className="dialog-actions"><button type="button" className="secondary-btn" onClick={closePasswordDialog}>Cancel</button><button className="primary-btn" disabled={passwordSaving}>{passwordSaving ? 'Saving…' : 'Update password'}</button></div>
        </form>
      </section>
    </div>}
  </div>;
}
