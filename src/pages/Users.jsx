import { useEffect, useRef, useState } from 'react';
import { ArrowDown, ArrowUp, ArrowUpDown, Check, ChevronDown, ChevronLeft, ChevronRight, Filter, Pencil, Plus, Search, UserRound, UserRoundCheck, UserX, X } from 'lucide-react';
import { usersApi } from '../services/api';

const formatDate = (value) => {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  const parts = new Intl.DateTimeFormat('en-US', { day: '2-digit', month: 'short', year: 'numeric' }).formatToParts(date);
  const day = parts.find(part => part.type === 'day')?.value;
  const month = parts.find(part => part.type === 'month')?.value;
  const year = parts.find(part => part.type === 'year')?.value;
  return `${day} ${month} ${year}`;
};

export default function Users() {
  const [data, setData] = useState({ pagination: {}, data: [] });
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('active');
  const [statusMenuOpen, setStatusMenuOpen] = useState(false);
  const [sortBy, setSortBy] = useState('name');
  const [sortOrder, setSortOrder] = useState('asc');
  const [page, setPage] = useState(1);
  const rowsPerPage = 10;
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [dialogError, setDialogError] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [form, setForm] = useState({ name: '', email: '', password: '' });
  const requestId = useRef(0);

  const load = async (query = debouncedSearch, status = statusFilter, targetPage = page) => {
    const currentRequestId = ++requestId.current;
    setLoading(true);
    setError('');
    try {
      const result = await usersApi.list({ page: targetPage, size: rowsPerPage, search: query, is_active: status === 'deactivated' ? 0 : 1, exclude_system: true, sortBy: sortBy === 'updated' ? '_updated_on' : 'name', sortOrder });
      if (currentRequestId === requestId.current) {
        const responsePageSize = Number(result.pagination?.size) || rowsPerPage;
        const totalPages = Math.max(1, Math.ceil((Number(result.pagination?.total) || 0) / responsePageSize));
        if (targetPage > totalPages) {
          setPage(totalPages);
        } else {
          setData(result);
        }
      }
    } catch (requestError) {
      if (currentRequestId === requestId.current) setError(requestError.message);
    } finally {
      if (currentRequestId === requestId.current) setLoading(false);
    }
  };

  useEffect(() => {
    const timeout = window.setTimeout(() => setDebouncedSearch(search), 450);
    return () => window.clearTimeout(timeout);
  }, [search]);

  useEffect(() => {
    if (!dialogOpen) return undefined;
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') setDialogOpen(false);
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [dialogOpen]);

  useEffect(() => { load(debouncedSearch, statusFilter, page); }, [debouncedSearch, statusFilter, sortBy, sortOrder, page]);

  const openCreateDialog = () => {
    setEditingUser(null);
    setForm({ name: '', email: '', password: '' });
    setDialogError('');
    setDialogOpen(true);
  };

  const openEditDialog = (user) => {
    setEditingUser(user);
    setForm({ name: user.name || user.user_name || '', email: user.email || '', password: '' });
    setDialogError('');
    setDialogOpen(true);
  };

  const submitUser = async (event) => {
    event.preventDefault();
    setSaving(true);
    setDialogError('');
    try {
      if (editingUser) {
        await usersApi.update(editingUser._id, { name: form.name, email: form.email });
      } else {
        await usersApi.create({ name: form.name, email: form.email, password: form.password });
      }
      setDialogOpen(false);
      await load();
    } catch (requestError) {
      setDialogError(requestError.message);
    } finally {
      setSaving(false);
    }
  };

  const deactivateUser = async (user) => {
    if (!window.confirm(`Deactivate ${user.name || user.user_name || user.email}?`)) return;
    setError('');
    try {
      await usersApi.status(user._id, false);
      await load();
    } catch (requestError) {
      setError(requestError.message);
    }
  };

  const reactivateUser = async (user) => {
    setError('');
    try {
      await usersApi.status(user._id, true);
      await load();
    } catch (requestError) {
      setError(requestError.message);
    }
  };

  const selectStatus = (status) => {
    setStatusFilter(status);
    setPage(1);
    setStatusMenuOpen(false);
  };

  const changeSort = (field) => {
    if (sortBy === field) setSortOrder(order => order === 'asc' ? 'desc' : 'asc');
    else {
      setSortBy(field);
      setSortOrder('asc');
    }
    setPage(1);
  };

  const sortIcon = (field) => sortBy !== field
    ? <ArrowUpDown size={14}/>
    : sortOrder === 'asc' ? <ArrowUp size={14}/> : <ArrowDown size={14}/>;
  const sortLabel = (field) => sortBy === field && sortOrder === 'desc' ? 'descending' : 'ascending';

  const total = Number(data.pagination?.total) || 0;
  const pageSize = Number(data.pagination?.size) || 10;
  const currentPage = Number(data.pagination?.page) || page;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const firstResult = total ? (currentPage - 1) * pageSize + 1 : 0;
  const lastResult = Math.min(currentPage * pageSize, total);
  const statusLabel = statusFilter === 'active' ? 'Active users' : 'Deactivated users';

  return <div className="users-page">
    <div className="page-heading">
      <div><h1>User Management</h1><p>Manage system users and access.</p></div>
      <button className="primary-btn compact" onClick={openCreateDialog}><Plus size={16}/>Add user</button>
    </div>
    <div className="users-toolbar">
      <div className="users-search"><Search size={17} aria-hidden="true"/><input value={search} onChange={event => { setSearch(event.target.value); setPage(1); }} placeholder="Search name or email…" aria-label="Search name or email"/></div>
      <div className="status-filter" onBlur={event => { if (!event.currentTarget.contains(event.relatedTarget)) setStatusMenuOpen(false); }}>
        <button type="button" className="status-filter-trigger" aria-haspopup="menu" aria-expanded={statusMenuOpen} onClick={() => setStatusMenuOpen(value => !value)}><Filter size={16}/><span>{statusLabel}</span><ChevronDown size={15}/></button>
        {statusMenuOpen && <div className="status-filter-menu" role="menu" aria-label="Filter users by status">
          <button type="button" role="menuitemradio" aria-checked={statusFilter === 'active'} className={`status-filter-option ${statusFilter === 'active' ? 'selected' : ''}`} onClick={() => selectStatus('active')}><UserRoundCheck size={16}/><span>Active users</span>{statusFilter === 'active' && <Check size={15}/>}</button>
          <button type="button" role="menuitemradio" aria-checked={statusFilter === 'deactivated'} className={`status-filter-option ${statusFilter === 'deactivated' ? 'selected' : ''}`} onClick={() => selectStatus('deactivated')}><UserX size={16}/><span>Deactivated users</span>{statusFilter === 'deactivated' && <Check size={15}/>}</button>
        </div>}
      </div>
    </div>
    {error && <div className="inline-error users-error" role="alert">{error}</div>}
    <div className="table-card">
      <div className="table-wrap"><table>
        <thead><tr>
          <th aria-sort={sortBy === 'name' ? sortOrder === 'asc' ? 'ascending' : 'descending' : 'none'}><button type="button" className="table-sort" aria-label={`Sort by name ${sortLabel('name')}`} onClick={() => changeSort('name')}><span>User</span>{sortIcon('name')}</button></th>
          <th>Email</th><th>Status</th>
          <th aria-sort={sortBy === 'updated' ? sortOrder === 'asc' ? 'ascending' : 'descending' : 'none'}><button type="button" className="table-sort" aria-label={`Sort by updated ${sortLabel('updated')}`} onClick={() => changeSort('updated')}><span>Updated</span>{sortIcon('updated')}</button></th>
          <th>Actions</th>
        </tr></thead>
        {!loading && data.data?.length ? <tbody>{data.data.map(user => <tr key={user._id}>
            <td><div className="user-cell"><span className="avatar small"><UserRound size={14}/></span><strong>{user.name || user.user_name || '—'}</strong></div></td>
            <td>{user.email || '—'}</td>
            <td><span className={`status ${user.is_active === false ? 'inactive' : 'active'}`}>{user.is_active === false ? 'Inactive' : 'Active'}</span></td>
            <td>{formatDate(user._updated_on)}</td>
            <td className="user-actions">
              <button className="icon-btn user-action-edit" title="Edit user" aria-label={`Edit ${user.name || user.email}`} onClick={() => openEditDialog(user)}><Pencil size={16}/></button>
              {user.is_active === false
                ? <button className="icon-btn user-action-reactivate" title="Reactivate user" aria-label={`Reactivate ${user.name || user.email}`} onClick={() => reactivateUser(user)}><UserRoundCheck size={16}/></button>
                : <button className="icon-btn user-action-deactivate" title="Deactivate user" aria-label={`Deactivate ${user.name || user.email}`} disabled={user.isSystem} onClick={() => deactivateUser(user)}><UserX size={16}/></button>}
            </td>
          </tr>)}</tbody> : null}
      </table>{loading
        ? <div className="users-empty-state" role="status">Loading…</div>
        : !data.data?.length && <div className="users-empty-state" role="status">No users found.</div>}</div>
      {totalPages > 1 && <div className="pagination-bar">
        <span className="pagination-summary">Showing {firstResult}-{lastResult} of {total} users</span>
        <div className="pagination-controls"><span>Page {currentPage} of {totalPages}</span><button className="icon-btn" aria-label="Previous page" title="Previous page" disabled={loading || currentPage <= 1} onClick={() => setPage(value => Math.max(1, value - 1))}><ChevronLeft size={17}/></button><button className="icon-btn" aria-label="Next page" title="Next page" disabled={loading || currentPage >= totalPages} onClick={() => setPage(value => Math.min(totalPages, value + 1))}><ChevronRight size={17}/></button></div>
      </div>}
    </div>
    {dialogOpen && <div className="dialog-backdrop" onMouseDown={event => { if (event.target === event.currentTarget) setDialogOpen(false); }}>
      <section className="user-dialog" role="dialog" aria-modal="true" aria-labelledby="user-dialog-title">
        <div className="dialog-heading"><h2 id="user-dialog-title">{editingUser ? 'Edit user' : 'Add user'}</h2><button className="dialog-close" aria-label="Close" onClick={() => setDialogOpen(false)}><X size={18}/></button></div>
        <form onSubmit={submitUser}>
          <label>Name<input required minLength={3} maxLength={60} pattern="[A-Za-z][A-Za-z0-9 ]{2,59}" title="Use 3-60 letters, digits, or spaces; start with a letter." value={form.name} onChange={event => setForm(value => ({ ...value, name: event.target.value }))}/></label>
          <label>Email<input type="email" required value={form.email} onChange={event => setForm(value => ({ ...value, email: event.target.value }))}/></label>
          {!editingUser && <label>Password<input type="password" required minLength={8} maxLength={128} autoComplete="new-password" value={form.password} onChange={event => setForm(value => ({ ...value, password: event.target.value }))}/></label>}
          {dialogError && <div className="form-error" role="alert">{dialogError}</div>}
          <div className="dialog-actions"><button type="button" className="secondary-btn" onClick={() => setDialogOpen(false)}><X size={15}/>Cancel</button><button className="primary-btn" disabled={saving}>{saving ? 'Saving…' : <><Check size={16}/>{editingUser ? 'Save changes' : 'Create user'}</>}</button></div>
        </form>
      </section>
    </div>}
  </div>;
}
