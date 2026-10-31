import { useEffect, useId, useRef, useState } from 'react';
import { ArrowDown, ArrowUp, ArrowUpDown, Check, ChevronDown, ChevronLeft, ChevronRight, Copy, Eye, EyeOff, Pencil, Plus, Search, Tags, Trash2, X } from 'lucide-react';
import { passwordsApi } from '../services/api';
import { decryptWithStoredPrivateKey, encryptWithStoredPublicKey } from '../services/encryption';
import useAutoPageSize from '../hooks/useAutoPageSize';

const TYPES = ['personal', 'work'];
const TYPE_LABELS = { personal: 'Personal', work: 'Work' };
const FORM_DEFAULTS = { type: 'personal', name: '', website: '', id: '', password: '' };
const idValue = value => typeof value === 'object' && value !== null ? value.$oid || idValue(value._id) : String(value || '');
const entryFromResponse = response => response?.data && !Array.isArray(response.data) ? response.data : response;

const formatDate = (value) => {
  if (!value) return '—';
  const rawValue = typeof value === 'object' && value ? value.$date || value.date || value.value : value;
  const date = new Date(rawValue);
  if (Number.isNaN(date.getTime())) return '—';
  const parts = new Intl.DateTimeFormat('en-US', { day: '2-digit', month: 'short', year: 'numeric' }).formatToParts(date);
  return `${parts.find(part => part.type === 'day')?.value} ${parts.find(part => part.type === 'month')?.value} ${parts.find(part => part.type === 'year')?.value}`;
};

function TypeDropdown({ value, onChange }) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef(null);
  const triggerRef = useRef(null);
  const listId = useId();
  const selectedType = TYPES.find(type => type === value) || TYPES[0];

  useEffect(() => {
    if (!open) return undefined;
    const closeOnOutsideClick = (event) => {
      if (!rootRef.current?.contains(event.target)) setOpen(false);
    };
    document.addEventListener('mousedown', closeOnOutsideClick);
    return () => document.removeEventListener('mousedown', closeOnOutsideClick);
  }, [open]);

  const chooseType = (type) => {
    onChange(type);
    setOpen(false);
    triggerRef.current?.focus();
  };

  return <div className="lookup-dropdown" ref={rootRef}>
    <button
      ref={triggerRef}
      type="button"
      className="lookup-dropdown-trigger"
      role="combobox"
      aria-label="Type"
      aria-required="true"
      aria-haspopup="listbox"
      aria-expanded={open}
      aria-controls={listId}
      onClick={() => setOpen(current => !current)}
      onKeyDown={event => {
        if (event.key === 'Escape') setOpen(false);
        if ((event.key === 'Enter' || event.key === ' ') && !open) {
          event.preventDefault();
          setOpen(true);
        }
      }}
    >
      <span>{TYPE_LABELS[selectedType]}</span>
      <ChevronDown className={open ? 'open' : ''} size={16}/>
    </button>
    {open && <div className="lookup-dropdown-menu" id={listId} role="listbox" aria-label="Type">
      {TYPES.map(type => <div
        key={type}
        role="option"
        aria-selected={type === value}
        className={`lookup-dropdown-option ${type === value ? 'selected' : ''}`}
        onMouseDown={event => event.preventDefault()}
        onClick={() => chooseType(type)}
      >
        <span>{TYPE_LABELS[type]}</span>{type === value && <Check size={15}/>}
      </div>)}
    </div>}
  </div>;
}

export default function Passwords() {
  const [result, setResult] = useState({ pagination: {}, data: [] });
  const [search, setSearch] = useState('');
  const [query, setQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');
  const [typeMenuOpen, setTypeMenuOpen] = useState(false);
  const [sortBy, setSortBy] = useState('_created_on');
  const [sortOrder, setSortOrder] = useState('desc');
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [dialogError, setDialogError] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingPassword, setEditingPassword] = useState(null);
  const [form, setForm] = useState(FORM_DEFAULTS);
  const [formPasswordVisible, setFormPasswordVisible] = useState(false);
  const [visiblePasswords, setVisiblePasswords] = useState({});
  const [copiedId, setCopiedId] = useState('');
  const requestId = useRef(0);
  const [tableWrapRef, rowsPerPage] = useAutoPageSize();

  const load = async (targetPage = page, selectedQuery = query, selectedType = typeFilter) => {
    const currentRequestId = ++requestId.current;
    const params = { page: targetPage, size: rowsPerPage, search: selectedQuery, sortBy, sortOrder };
    if (selectedType !== 'all') params.type = selectedType;
    setLoading(true);
    setError('');
    try {
      const response = await passwordsApi.list(params);
      if (currentRequestId !== requestId.current) return;
      const pageSize = Number(response.pagination?.size) || rowsPerPage;
      const totalPages = Math.max(1, Math.ceil((Number(response.pagination?.total) || 0) / pageSize));
      if (targetPage > totalPages) setPage(totalPages);
      else setResult(response);
    } catch (requestError) {
      if (currentRequestId === requestId.current) setError(requestError.message);
    } finally {
      if (currentRequestId === requestId.current) setLoading(false);
    }
  };

  useEffect(() => {
    const timeout = window.setTimeout(() => setQuery(search), 450);
    return () => window.clearTimeout(timeout);
  }, [search]);

  useEffect(() => {
    if (!dialogOpen) return undefined;
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') closeDialog();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [dialogOpen]);

  useEffect(() => { load(page, query, typeFilter); }, [page, query, typeFilter, sortBy, sortOrder, rowsPerPage]);

  const openCreateDialog = () => {
    setEditingPassword(null);
    setForm(FORM_DEFAULTS);
    setFormPasswordVisible(false);
    setDialogError('');
    setDialogOpen(true);
  };

  const openEditDialog = async (entry) => {
    setEditingPassword(entry);
    setForm({ type: entry.type || 'personal', name: entry.name || '', website: entry.website || '', id: entry.id || '', password: '' });
    setFormPasswordVisible(false);
    setDialogError('');
    setDialogOpen(true);
    try {
      const freshEntry = entryFromResponse(await passwordsApi.get(idValue(entry._id)));
      setEditingPassword(freshEntry || entry);
      setForm({
        type: freshEntry?.type || entry.type || 'personal',
        name: freshEntry?.name || entry.name || '',
        website: freshEntry?.website || entry.website || '',
        id: freshEntry?.id || entry.id || '',
        password: ''
      });
    } catch {
      setForm(current => ({ ...current, password: '' }));
    }
  };

  const closeDialog = () => {
    setDialogOpen(false);
    setDialogError('');
  };

  const submitPassword = async (event) => {
    event.preventDefault();
    const payload = {
      type: form.type,
      name: form.name.trim(),
      website: form.website.trim(),
      id: form.id.trim()
    };
    if (!payload.name || !payload.id || (!editingPassword && !form.password)) {
      setDialogError('Complete all password fields.');
      return;
    }
    setSaving(true);
    setDialogError('');
    try {
      payload.website || delete payload.website;
      if (form.password) payload.password = await encryptWithStoredPublicKey(form.password);
      if (editingPassword) await passwordsApi.update(idValue(editingPassword._id), payload);
      else await passwordsApi.create(payload);
      closeDialog();
      await load();
    } catch (requestError) {
      setDialogError(requestError.message);
    } finally {
      setSaving(false);
    }
  };

  const deletePassword = async (entry) => {
    if (!window.confirm(`Deactivate ${entry.name || 'this password entry'}?`)) return;
    setError('');
    try {
      await passwordsApi.remove(idValue(entry._id));
      await load();
    } catch (requestError) {
      setError(requestError.message);
    }
  };

  const togglePasswordVisibility = async (entry) => {
    const entryId = idValue(entry._id);
    if (visiblePasswords[entryId]) {
      setVisiblePasswords(current => ({ ...current, [entryId]: '' }));
      return;
    }
    try {
      const freshEntry = entry.password ? entry : entryFromResponse(await passwordsApi.get(entryId));
      if (!freshEntry?.password) throw new Error('Password is not available.');
      const decryptedPassword = await decryptWithStoredPrivateKey(freshEntry.password);
      setVisiblePasswords(current => ({ ...current, [entryId]: decryptedPassword }));
    } catch (requestError) {
      setError(requestError.message);
    }
  };

  const copyPassword = async (entry) => {
    const entryId = idValue(entry._id);
    try {
      const freshEntry = entry.password ? entry : entryFromResponse(await passwordsApi.get(entryId));
      if (!freshEntry?.password) throw new Error('Password is not available.');
      const decryptedPassword = await decryptWithStoredPrivateKey(freshEntry.password);
      await navigator.clipboard.writeText(decryptedPassword);
      setCopiedId(entryId);
      window.setTimeout(() => setCopiedId(''), 1800);
    } catch (requestError) {
      setError(requestError.message);
    }
  };

  const selectType = (type) => {
    setTypeFilter(type);
    setPage(1);
    setTypeMenuOpen(false);
  };

  const changeSort = (field) => {
    if (sortBy === field) setSortOrder(order => order === 'asc' ? 'desc' : 'asc');
    else {
      setSortBy(field);
      setSortOrder(field === '_created_on' || field === '_updated_on' ? 'desc' : 'asc');
    }
    setPage(1);
  };

  const sortIcon = (field) => sortBy !== field
    ? <ArrowUpDown size={14}/>
    : sortOrder === 'asc' ? <ArrowUp size={14}/> : <ArrowDown size={14}/>;
  const sortLabel = (field) => sortBy === field && sortOrder === 'desc' ? 'descending' : 'ascending';

  const total = Number(result.pagination?.total) || 0;
  const pageSize = Number(result.pagination?.size) || rowsPerPage;
  const currentPage = Number(result.pagination?.page) || page;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const firstResult = total ? (currentPage - 1) * pageSize + 1 : 0;
  const lastResult = Math.min(currentPage * pageSize, total);
  const filterLabel = typeFilter === 'all' ? 'All types' : TYPE_LABELS[typeFilter];

  return <div className="passwords-page">
    <div className="page-heading">
      <div><h1>Passwords</h1><p>Store and manage personal and work credentials.</p></div>
      <button className="primary-btn compact" onClick={openCreateDialog}><Plus size={16}/>Add password</button>
    </div>
    <div className="passwords-toolbar">
      <div className="users-search"><Search size={17} aria-hidden="true"/><input value={search} onChange={event => { setSearch(event.target.value); setPage(1); }} placeholder="Search passwords…" aria-label="Search passwords"/></div>
      <div className="status-filter" onBlur={event => { if (!event.currentTarget.contains(event.relatedTarget)) setTypeMenuOpen(false); }}>
        <button type="button" className="status-filter-trigger" aria-haspopup="menu" aria-expanded={typeMenuOpen} onClick={() => setTypeMenuOpen(value => !value)}><Tags size={16}/><span>{filterLabel}</span><ChevronDown size={15}/></button>
        {typeMenuOpen && <div className="status-filter-menu" role="menu" aria-label="Filter passwords by type">
          <button type="button" role="menuitemradio" aria-checked={typeFilter === 'all'} className={`status-filter-option ${typeFilter === 'all' ? 'selected' : ''}`} onClick={() => selectType('all')}><Tags size={16}/><span>All types</span>{typeFilter === 'all' && <Check size={15}/>}</button>
          {TYPES.map(type => <button key={type} type="button" role="menuitemradio" aria-checked={typeFilter === type} className={`status-filter-option ${typeFilter === type ? 'selected' : ''}`} onClick={() => selectType(type)}><span>{TYPE_LABELS[type]}</span>{typeFilter === type && <Check size={15}/>}</button>)}
        </div>}
      </div>
    </div>
    {error && <div className="inline-error users-error" role="alert">{error}</div>}
    <div className="table-card password-table-card">
      <div className="table-wrap" ref={tableWrapRef}><table>
        <thead><tr>
          <th aria-sort={sortBy === 'name' ? sortOrder === 'asc' ? 'ascending' : 'descending' : 'none'}><button type="button" className="table-sort" aria-label={`Sort by name ${sortLabel('name')}`} onClick={() => changeSort('name')}><span>Name</span>{sortIcon('name')}</button></th>
          <th>Type</th><th>Website</th><th>User ID</th><th>Password</th>
          <th aria-sort={sortBy === '_updated_on' ? sortOrder === 'asc' ? 'ascending' : 'descending' : 'none'}><button type="button" className="table-sort" aria-label={`Sort by updated ${sortLabel('_updated_on')}`} onClick={() => changeSort('_updated_on')}><span>Updated</span>{sortIcon('_updated_on')}</button></th>
          <th>Actions</th>
        </tr></thead>
        {!loading && result.data?.length ? <tbody>{result.data.map(entry => {
          const entryId = idValue(entry._id);
          const visiblePassword = visiblePasswords[entryId];
          return <tr key={entryId}>
            <td title={entry.name || '—'}><strong className="password-name">{entry.name || '—'}</strong></td>
            <td title={TYPE_LABELS[entry.type] || entry.type || '—'}><span className="lookup-type">{TYPE_LABELS[entry.type] || entry.type || '—'}</span></td>
            <td title={entry.website || '—'}>{entry.website ? <a className="password-link" href={entry.website} target="_blank" rel="noreferrer">{entry.website}</a> : '—'}</td>
            <td title={entry.id || '—'}>{entry.id || '—'}</td>
            <td title={visiblePassword || 'Password hidden'}><span className="password-mask">{visiblePassword || '••••••••••'}</span></td>
            <td title={formatDate(entry._updated_on || entry._created_on)}>{formatDate(entry._updated_on || entry._created_on)}</td>
            <td className="password-actions">
              <button className="icon-btn lookup-action-edit" title="Edit password" aria-label={`Edit ${entry.name || 'password'}`} onClick={() => openEditDialog(entry)}><Pencil size={16}/></button>
              <button className="icon-btn" title={visiblePassword ? 'Hide password' : 'Show password'} aria-label={`${visiblePassword ? 'Hide' : 'Show'} ${entry.name || 'password'}`} onClick={() => togglePasswordVisibility(entry)}>{visiblePassword ? <EyeOff size={16}/> : <Eye size={16}/>}</button>
              <button className="icon-btn" title={copiedId === entryId ? 'Copied' : 'Copy password'} aria-label={`Copy ${entry.name || 'password'}`} onClick={() => copyPassword(entry)}><Copy size={16}/></button>
              {entry.is_active !== false && <button className="icon-btn lookup-action-delete" title="Deactivate password" aria-label={`Deactivate ${entry.name || 'password'}`} onClick={() => deletePassword(entry)}><Trash2 size={16}/></button>}
            </td>
          </tr>;
        })}</tbody> : null}
      </table>{loading
        ? <div className="lookup-empty-state" role="status">Loading…</div>
        : !result.data?.length && <div className="lookup-empty-state" role="status">No passwords found.</div>}</div>
      {totalPages > 1 && <div className="pagination-bar">
        <span className="pagination-summary">Showing {firstResult}-{lastResult} of {total} passwords</span>
        <div className="pagination-controls"><span>Page {currentPage} of {totalPages}</span><button className="icon-btn" aria-label="Previous page" title="Previous page" disabled={loading || currentPage <= 1} onClick={() => setPage(value => Math.max(1, value - 1))}><ChevronLeft size={17}/></button><button className="icon-btn" aria-label="Next page" title="Next page" disabled={loading || currentPage >= totalPages} onClick={() => setPage(value => Math.min(totalPages, value + 1))}><ChevronRight size={17}/></button></div>
      </div>}
    </div>
    {dialogOpen && <div className="dialog-backdrop" onMouseDown={event => { if (event.target === event.currentTarget) closeDialog(); }}>
      <section className="user-dialog password-entry-dialog" role="dialog" aria-modal="true" aria-labelledby="password-dialog-title">
        <div className="dialog-heading"><h2 id="password-dialog-title">{editingPassword ? 'Edit password' : 'Add password'}</h2><button className="dialog-close" aria-label="Close" onClick={closeDialog}><X size={18}/></button></div>
        <form onSubmit={submitPassword}>
          <div className="lookup-dialog-field"><span className="lookup-dialog-label">Type</span><TypeDropdown value={form.type} onChange={type => setForm(value => ({ ...value, type }))}/></div>
          <label>Name<input required maxLength={255} pattern="[A-Za-z][A-Za-z0-9 _()[\]-]*" title="Start with a letter. Use letters, digits, spaces, underscores, brackets, or hyphens." value={form.name} onChange={event => setForm(value => ({ ...value, name: event.target.value }))}/></label>
          <label>Website<input type="url" maxLength={255} value={form.website} onChange={event => setForm(value => ({ ...value, website: event.target.value }))}/></label>
          <label>User ID<input required maxLength={255} autoComplete="username" value={form.id} onChange={event => setForm(value => ({ ...value, id: event.target.value }))}/></label>
          <label>Password<div className="password-input-wrap"><input type={formPasswordVisible ? 'text' : 'password'} required={!editingPassword} maxLength={255} autoComplete="new-password" placeholder={editingPassword ? 'Leave blank to keep current password' : ''} value={form.password} onChange={event => setForm(value => ({ ...value, password: event.target.value }))}/><button type="button" className="password-input-toggle" title={formPasswordVisible ? 'Hide password' : 'Show password'} aria-label={formPasswordVisible ? 'Hide typed password' : 'Show typed password'} onClick={() => setFormPasswordVisible(visible => !visible)}>{formPasswordVisible ? <EyeOff size={16}/> : <Eye size={16}/>}</button></div></label>
          {dialogError && <div className="form-error" role="alert">{dialogError}</div>}
          <div className="dialog-actions"><button className="primary-btn" disabled={saving}>{saving ? 'Saving…' : <><Check size={16}/>{editingPassword ? 'Save changes' : 'Create password'}</>}</button></div>
        </form>
      </section>
    </div>}
  </div>;
}
