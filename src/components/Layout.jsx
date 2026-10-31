import { useEffect, useRef, useState } from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import { Home, ArrowLeftRight, ListTree, Users, LogOut, X, WalletCards, Sun, Moon, KeyRound, ChevronUp, ShieldCheck, Download, Upload, Clock } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { usersApi } from '../services/api';
import { EMPTY_ENCRYPTION_KEYS, clearStoredEncryptionKeys, generateEncryptionKeyPair, getStoredEncryptionKeys, setStoredEncryptionKeys } from '../services/encryption';

export default function Layout({ theme, onToggleTheme }) {
  const { user, logout, sessionSecondsRemaining } = useAuth();
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const [passwordDialogOpen, setPasswordDialogOpen] = useState(false);
  const [encryptionDialogOpen, setEncryptionDialogOpen] = useState(false);
  const [passwords, setPasswords] = useState({ current: '', next: '', confirm: '' });
  const [passwordError, setPasswordError] = useState('');
  const [passwordSuccess, setPasswordSuccess] = useState('');
  const [passwordSaving, setPasswordSaving] = useState(false);
  const [encryptionKeys, setEncryptionKeys] = useState(() => getStoredEncryptionKeys() || EMPTY_ENCRYPTION_KEYS);
  const [encryptionError, setEncryptionError] = useState('');
  const [encryptionSuccess, setEncryptionSuccess] = useState('');
  const [encryptionGenerating, setEncryptionGenerating] = useState(false);
  const encryptionImportRef = useRef(null);
  const isSystem = !!user?.isSystem;
  const sessionTimer = (() => {
    if (sessionSecondsRemaining == null) return '';
    const safeSeconds = Math.max(0, sessionSecondsRemaining);
    const hours = Math.floor(safeSeconds / 3600);
    const minutes = Math.floor((safeSeconds % 3600) / 60);
    const seconds = String(safeSeconds % 60).padStart(2, '0');
    return hours ? `${hours}:${String(minutes).padStart(2, '0')}:${seconds}` : `${minutes}:${seconds}`;
  })();
  const showSessionToast = sessionSecondsRemaining != null && sessionSecondsRemaining <= 5 * 60;
  const profileEmail = user?.loginEmail || user?.email || user?.user_email || '';
  const links = isSystem ? [{ to: '/users', label: 'Users', icon: Users }] : [
    { to: '/home', label: 'Home', icon: Home },
    { to: '/transactions', label: 'Transactions', icon: ArrowLeftRight },
    { to: '/passwords', label: 'Passwords', icon: KeyRound },
    { to: '/lookups', label: 'LookUps', icon: ListTree }
  ];
  const closePasswordDialog = () => {
    setPasswordDialogOpen(false);
    setPasswords({ current: '', next: '', confirm: '' });
    setPasswordError('');
    setPasswordSuccess('');
  };
  const closeEncryptionDialog = () => {
    setEncryptionDialogOpen(false);
    setEncryptionKeys(getStoredEncryptionKeys() || EMPTY_ENCRYPTION_KEYS);
    setEncryptionError('');
    setEncryptionSuccess('');
  };

  useEffect(() => {
    if (!passwordDialogOpen) return undefined;
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') closePasswordDialog();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [passwordDialogOpen]);

  useEffect(() => {
    if (!encryptionDialogOpen) return undefined;
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') closeEncryptionDialog();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [encryptionDialogOpen]);

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
  const saveEncryptionKeys = (event) => {
    event.preventDefault();
    setEncryptionError('');
    setEncryptionSuccess('');
    const nextKeys = {
      publicKey: encryptionKeys.publicKey.trim(),
      privateKey: encryptionKeys.privateKey.trim()
    };
    if (!nextKeys.publicKey || !nextKeys.privateKey) {
      setEncryptionError('Public and private keys are required.');
      return;
    }
    setStoredEncryptionKeys(nextKeys);
    setEncryptionKeys(nextKeys);
    setEncryptionSuccess('Encryption keys saved for this session.');
  };
  const generateEncryptionKeys = async () => {
    setEncryptionError('');
    setEncryptionSuccess('');
    setEncryptionGenerating(true);
    try {
      const generatedKeys = await generateEncryptionKeyPair();
      setStoredEncryptionKeys(generatedKeys);
      setEncryptionKeys(generatedKeys);
      setEncryptionSuccess('Encryption keys generated for this session.');
    } catch (error) {
      setEncryptionError(error.message);
    } finally {
      setEncryptionGenerating(false);
    }
  };
  const clearEncryptionKeys = () => {
    clearStoredEncryptionKeys();
    setEncryptionKeys(EMPTY_ENCRYPTION_KEYS);
    setEncryptionError('');
    setEncryptionSuccess('Encryption keys cleared.');
  };
  const exportEncryptionKeys = () => {
    setEncryptionError('');
    setEncryptionSuccess('');
    const exportKeys = {
      publicKey: encryptionKeys.publicKey.trim(),
      privateKey: encryptionKeys.privateKey.trim()
    };
    if (!exportKeys.publicKey || !exportKeys.privateKey) {
      setEncryptionError('Public and private keys are required before export.');
      return;
    }
    const blob = new Blob([JSON.stringify(exportKeys, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'personal-tracker-encryption-keys.json';
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
    setEncryptionSuccess('Encryption keys exported as JSON.');
  };
  const importEncryptionKeys = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    setEncryptionError('');
    setEncryptionSuccess('');
    try {
      const imported = JSON.parse(await file.text());
      const importedKeys = {
        publicKey: String(imported.publicKey || '').trim(),
        privateKey: String(imported.privateKey || '').trim()
      };
      if (!importedKeys.publicKey || !importedKeys.privateKey) throw new Error('JSON must include publicKey and privateKey.');
      setStoredEncryptionKeys(importedKeys);
      setEncryptionKeys(importedKeys);
      setEncryptionSuccess('Encryption keys imported and saved for this session.');
    } catch (error) {
      setEncryptionError(error.message || 'Unable to import encryption keys.');
    }
  };
  return <div className="app-shell">
    <aside className="sidebar">
      <div className="brand"><div className="brand-mark"><WalletCards size={18}/></div><span>Personal Tracker</span></div>
      <nav>{links.map(({ to, label, icon: Icon }) => <NavLink key={to} to={to} title={label} className={({isActive}) => `nav-link ${isActive ? 'active' : ''}`}><Icon size={18}/><span>{label}</span></NavLink>)}</nav>
      <div className="sidebar-bottom">
        {profileMenuOpen && <div className="profile-menu" role="menu" aria-label="Profile options">
          <button className="profile-menu-item" role="menuitem" onClick={() => { onToggleTheme(); setProfileMenuOpen(false); }}>
            {theme === 'light' ? <Moon size={17}/> : <Sun size={17}/>}<span>Switch to {theme === 'light' ? 'dark' : 'light'} theme</span>
          </button>
          <button className="profile-menu-item" role="menuitem" onClick={() => { setProfileMenuOpen(false); setEncryptionDialogOpen(true); setEncryptionKeys(getStoredEncryptionKeys() || EMPTY_ENCRYPTION_KEYS); }}><ShieldCheck size={17}/><span>Encryption key</span></button>
          <button className="profile-menu-item" role="menuitem" onClick={() => { setProfileMenuOpen(false); setPasswordDialogOpen(true); }}><KeyRound size={17}/><span>Change password</span></button>
          <button className="profile-menu-item danger" role="menuitem" onClick={logout}><LogOut size={17}/><span>Sign out</span></button>
        </div>}
        <button className="profile profile-trigger" aria-expanded={profileMenuOpen} aria-haspopup="menu" onClick={() => setProfileMenuOpen(value => !value)}>
          <span className="avatar">{(user?.user_name || profileEmail || 'U').charAt(0).toUpperCase()}</span><span className="profile-text"><strong>{user?.user_name || 'User'}</strong><span>{profileEmail || 'Signed in'}</span></span><ChevronUp className={profileMenuOpen ? '' : 'profile-chevron-closed'} size={16}/>
        </button>
        {sessionSecondsRemaining != null && <div className="session-timer"><Clock size={15}/><span>Session</span><strong>{sessionTimer}</strong></div>}
      </div>
    </aside>
    <main className="main-area">
      <section className="page-content"><Outlet /></section>
    </main>
    {showSessionToast && <div className="session-toast" role="status"><Clock size={17}/><span>Your session expires soon.</span><strong>{sessionTimer}</strong></div>}
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
    {encryptionDialogOpen && <div className="dialog-backdrop" onMouseDown={event => { if (event.target === event.currentTarget) closeEncryptionDialog(); }}>
      <section className="password-dialog encryption-dialog" role="dialog" aria-modal="true" aria-labelledby="encryption-dialog-title">
        <div className="dialog-heading"><h2 id="encryption-dialog-title">Encryption key</h2><button className="dialog-close" aria-label="Close" onClick={closeEncryptionDialog}><X size={18}/></button></div>
        <form onSubmit={saveEncryptionKeys}>
          <label>Public key<textarea required rows={5} spellCheck="false" value={encryptionKeys.publicKey} onChange={event => setEncryptionKeys(value => ({ ...value, publicKey: event.target.value }))}/></label>
          <label>Private key<textarea required rows={7} spellCheck="false" value={encryptionKeys.privateKey} onChange={event => setEncryptionKeys(value => ({ ...value, privateKey: event.target.value }))}/></label>
          {encryptionError && <div className="form-error" role="alert">{encryptionError}</div>}
          {encryptionSuccess && <div className="form-success" role="status">{encryptionSuccess}</div>}
          <div className="dialog-actions encryption-actions">
            <input ref={encryptionImportRef} className="file-input-hidden" type="file" accept="application/json,.json" onChange={importEncryptionKeys}/>
            <button type="button" className="secondary-btn" onClick={() => encryptionImportRef.current?.click()}><Upload size={15}/>Import JSON</button>
            <button type="button" className="secondary-btn" onClick={exportEncryptionKeys}><Download size={15}/>Export JSON</button>
            <button type="button" className="secondary-btn" onClick={clearEncryptionKeys}>Clear</button>
            <button type="button" className="secondary-btn" disabled={encryptionGenerating} onClick={generateEncryptionKeys}>{encryptionGenerating ? 'Generating…' : 'Generate pair'}</button>
            <button className="primary-btn">Save</button>
          </div>
        </form>
      </section>
    </div>}
  </div>;
}
