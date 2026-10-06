import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import { ArrowDown, ArrowUp, ArrowUpDown, Check, ChevronDown, ChevronLeft, ChevronRight, Filter, Pencil, Plus, Search, Tags, Trash2, X } from 'lucide-react';
import { lookupsApi } from '../services/api';

const LOOKUP_TYPES = ['account', 'type', 'category', 'sub_category', 'payment_mode'];
const TYPE_LABELS = {
  account: 'Account',
  type: 'Type',
  category: 'Category',
  sub_category: 'Sub-category',
  payment_mode: 'Payment mode'
};
const parentTypeFor = (type) => type === 'category' ? 'type' : type === 'sub_category' ? 'category' : '';
const idValue = (value) => typeof value === 'object' && value !== null ? value.$oid || value.toString() : String(value || '');

const formatDate = (value) => {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  const parts = new Intl.DateTimeFormat('en-US', { day: '2-digit', month: 'short', year: 'numeric' }).formatToParts(date);
  return `${parts.find(part => part.type === 'day')?.value} ${parts.find(part => part.type === 'month')?.value} ${parts.find(part => part.type === 'year')?.value}`;
};

function LookupDropdown({ label, value, options, onChange, placeholder, disabled = false, required = false }) {
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const [opensUp, setOpensUp] = useState(false);
  const rootRef = useRef(null);
  const triggerRef = useRef(null);
  const menuRef = useRef(null);
  const listId = useId();
  const selectedIndex = options.findIndex(option => option.value === value);
  const selectedOption = options[selectedIndex];

  useEffect(() => {
    if (open) setActiveIndex(selectedIndex >= 0 ? selectedIndex : 0);
  }, [open, selectedIndex]);

  useEffect(() => {
    if (!open) return undefined;
    const closeOnOutsideClick = (event) => {
      if (!rootRef.current?.contains(event.target)) setOpen(false);
    };
    document.addEventListener('mousedown', closeOnOutsideClick);
    return () => document.removeEventListener('mousedown', closeOnOutsideClick);
  }, [open]);

  useLayoutEffect(() => {
    if (!open) return undefined;
    const updatePlacement = () => {
      const trigger = triggerRef.current;
      const menu = menuRef.current;
      if (!trigger || !menu) return;
      const dialog = rootRef.current?.closest('.lookup-dialog');
      const bounds = dialog?.getBoundingClientRect() || { top: 0, bottom: window.innerHeight };
      const triggerBounds = trigger.getBoundingClientRect();
      const availableMenuHeight = Math.min(menu.scrollHeight, 220, window.innerHeight * .35);
      const spaceBelow = bounds.bottom - triggerBounds.bottom;
      const spaceAbove = triggerBounds.top - bounds.top;
      setOpensUp(spaceBelow < availableMenuHeight + 6 && spaceAbove > spaceBelow);
    };
    updatePlacement();
    window.addEventListener('resize', updatePlacement);
    window.addEventListener('scroll', updatePlacement, true);
    return () => {
      window.removeEventListener('resize', updatePlacement);
      window.removeEventListener('scroll', updatePlacement, true);
    };
  }, [open, options.length]);

  const chooseOption = (index) => {
    const option = options[index];
    if (!option) return;
    onChange(option.value);
    setOpen(false);
    triggerRef.current?.focus();
  };

  const handleKeyDown = (event) => {
    if (event.key === 'Escape' && open) {
      event.preventDefault();
      event.stopPropagation();
      setOpen(false);
      return;
    }
    if (event.key === 'Tab' && open) {
      setOpen(false);
      return;
    }
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      if (!open) {
        setOpen(true);
        setActiveIndex(selectedIndex >= 0 ? selectedIndex : 0);
      } else {
        const direction = event.key === 'ArrowDown' ? 1 : -1;
        setActiveIndex(index => Math.max(0, Math.min(options.length - 1, index + direction)));
      }
      return;
    }
    if (open && event.key === 'Home') {
      event.preventDefault();
      setActiveIndex(0);
      return;
    }
    if (open && event.key === 'End') {
      event.preventDefault();
      setActiveIndex(options.length - 1);
      return;
    }
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      if (open) chooseOption(activeIndex);
      else setOpen(true);
    }
  };

  return <div className="lookup-dropdown" ref={rootRef}>
    <button
      ref={triggerRef}
      type="button"
      className="lookup-dropdown-trigger"
      role="combobox"
      aria-label={label}
      aria-required={required}
      aria-haspopup="listbox"
      aria-expanded={open}
      aria-controls={listId}
      aria-activedescendant={open && options.length ? `${listId}-option-${activeIndex}` : undefined}
      disabled={disabled}
      onClick={() => setOpen(current => !current)}
      onKeyDown={handleKeyDown}
    >
      <span className={selectedOption ? '' : 'placeholder'}>{selectedOption?.label || placeholder}</span>
      <ChevronDown className={open ? 'open' : ''} size={16}/>
    </button>
    {open && <div ref={menuRef} className={`lookup-dropdown-menu ${opensUp ? 'opens-up' : ''}`} id={listId} role="listbox" aria-label={label}>
      {options.map((option, index) => <div
        id={`${listId}-option-${index}`}
        key={option.value}
        role="option"
        aria-selected={option.value === value}
        className={`lookup-dropdown-option ${index === activeIndex ? 'active' : ''} ${option.value === value ? 'selected' : ''}`}
        onMouseDown={event => event.preventDefault()}
        onMouseEnter={() => setActiveIndex(index)}
        onClick={() => chooseOption(index)}
      >
        <span>{option.label}</span>{option.value === value && <Check size={15}/ >}
      </div>)}
    </div>}
  </div>;
}

export default function Lookups() {
  const [data, setData] = useState({ pagination: {}, data: [] });
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');
  const [sortBy, setSortBy] = useState('name');
  const [sortOrder, setSortOrder] = useState('asc');
  const [lookupPath, setLookupPath] = useState([]);
  const [typeMenuOpen, setTypeMenuOpen] = useState(false);
  const [page, setPage] = useState(1);
  const rowsPerPage = 10;
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [dialogError, setDialogError] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingLookup, setEditingLookup] = useState(null);
  const [form, setForm] = useState({ type: 'account', name: '', parent_id: '' });
  const [parentOptions, setParentOptions] = useState([]);
  const [parentLoading, setParentLoading] = useState(false);
  const [parentError, setParentError] = useState('');
  const requestId = useRef(0);
  const requiredParentType = parentTypeFor(form.type);
  const parentContext = lookupPath[lookupPath.length - 1];

  const load = async (query = debouncedSearch, selectedType = typeFilter, targetPage = page, selectedParent = parentContext) => {
    const currentRequestId = ++requestId.current;
    setLoading(true);
    setError('');
    const params = {
      page: targetPage,
      size: rowsPerPage,
      search: query,
      sortBy: sortBy === 'updated' ? '_updated_on' : 'name',
      sortOrder
    };
    if (selectedType !== 'all') params['type[]'] = selectedType;
    if (selectedParent) params.parent_id = selectedParent.id;
    try {
      const result = await lookupsApi.list(params);
      if (currentRequestId === requestId.current) {
        const responsePageSize = Number(result.pagination?.size) || rowsPerPage;
        const totalPages = Math.max(1, Math.ceil((Number(result.pagination?.total) || 0) / responsePageSize));
        if (targetPage > totalPages) setPage(totalPages);
        else setData(result);
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
      if (event.key === 'Escape') closeDialog();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [dialogOpen]);

  useEffect(() => { load(debouncedSearch, typeFilter, page, parentContext); }, [debouncedSearch, typeFilter, sortBy, sortOrder, page, parentContext]);

  useEffect(() => {
    if (!dialogOpen || !requiredParentType) {
      setParentOptions([]);
      setParentError('');
      return undefined;
    }
    let active = true;
    setParentLoading(true);
    setParentError('');
    lookupsApi.list({ page: 1, size: 100, 'type[]': requiredParentType, sortBy: 'name', sortOrder: 'asc' })
      .then(result => { if (active) setParentOptions(result.data || []); })
      .catch(requestError => { if (active) setParentError(requestError.message); })
      .finally(() => { if (active) setParentLoading(false); });
    return () => { active = false; };
  }, [dialogOpen, requiredParentType]);

  const openCreateDialog = () => {
    setEditingLookup(null);
    setForm({ type: 'account', name: '', parent_id: '' });
    setDialogError('');
    setDialogOpen(true);
  };

  const openEditDialog = (lookup) => {
    setEditingLookup(lookup);
    setForm({ type: lookup.type, name: lookup.name || '', parent_id: idValue(lookup.parent_id) });
    setDialogError('');
    setDialogOpen(true);
  };

  const closeDialog = () => {
    setDialogOpen(false);
    setDialogError('');
    setParentError('');
  };

  const submitLookup = async (event) => {
    event.preventDefault();
    if (!form.name.trim()) {
      setDialogError(form.type === 'type' ? 'Choose a transaction type.' : 'Name is required.');
      return;
    }
    if (requiredParentType && !form.parent_id) {
      setDialogError(`Choose a ${TYPE_LABELS[requiredParentType].toLowerCase()}.`);
      return;
    }
    setSaving(true);
    setDialogError('');
    const payload = { name: form.name.trim() };
    if (requiredParentType) payload.parent_id = form.parent_id;
    try {
      if (editingLookup) await lookupsApi.update(editingLookup._id, payload);
      else await lookupsApi.create({ ...payload, type: form.type });
      closeDialog();
      await load();
    } catch (requestError) {
      setDialogError(requestError.message);
    } finally {
      setSaving(false);
    }
  };

  const deleteLookup = async (lookup) => {
    const relatedWarning = lookup.type === 'type'
      ? ' Its categories and sub-categories will also be deactivated.'
      : lookup.type === 'category' ? ' Its sub-categories will also be deactivated.' : '';
    if (!window.confirm(`Delete ${lookup.name}?${relatedWarning}`)) return;
    setError('');
    try {
      await lookupsApi.remove(lookup._id);
      await load();
    } catch (requestError) {
      setError(requestError.message);
    }
  };

  const selectType = (type) => {
    setTypeFilter(type);
    setLookupPath([]);
    setPage(1);
    setTypeMenuOpen(false);
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

  const openChildren = (lookup) => {
    const childType = lookup.type === 'type' ? 'category' : lookup.type === 'category' ? 'sub_category' : '';
    if (!childType) return;
    setLookupPath(path => [...path, {
      id: idValue(lookup._id),
      name: lookup.name,
      type: lookup.type,
      childType,
      previousType: typeFilter
    }]);
    setTypeFilter(childType);
    setSearch('');
    setDebouncedSearch('');
    setPage(1);
  };

  const goBack = () => {
    const previousContext = lookupPath[lookupPath.length - 1];
    setLookupPath(path => path.slice(0, -1));
    setTypeFilter(previousContext?.previousType || 'all');
    setSearch('');
    setDebouncedSearch('');
    setPage(1);
  };

  const total = Number(data.pagination?.total) || 0;
  const pageSize = Number(data.pagination?.size) || rowsPerPage;
  const currentPage = Number(data.pagination?.page) || page;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const firstResult = total ? (currentPage - 1) * pageSize + 1 : 0;
  const lastResult = Math.min(currentPage * pageSize, total);
  const filterLabel = typeFilter === 'all' ? 'All lookup types' : TYPE_LABELS[typeFilter];

  return <div className="lookups-page">
    <div className="page-heading">
      <div><h1>Lookup Management</h1><p>Manage accounts, types, categories, sub-categories, and payment modes.</p></div>
      <button className="primary-btn compact" onClick={openCreateDialog}><Plus size={16}/>Add lookup</button>
    </div>
    {lookupPath.length > 0 && <div className="lookup-breadcrumb"><button type="button" onClick={goBack}><ChevronLeft size={16}/><span>Back</span></button><span>{lookupPath.map(item => item.name).join(' / ')}</span></div>}
    <div className="lookups-toolbar">
      <div className="users-search"><Search size={17} aria-hidden="true"/><input value={search} onChange={event => { setSearch(event.target.value); setPage(1); }} placeholder="Search lookups…" aria-label="Search lookups"/></div>
      <div className="status-filter" onBlur={event => { if (!event.currentTarget.contains(event.relatedTarget)) setTypeMenuOpen(false); }}>
        <button type="button" className="status-filter-trigger" aria-haspopup="menu" aria-expanded={typeMenuOpen} onClick={() => setTypeMenuOpen(value => !value)}><Tags size={16}/><span>{filterLabel}</span><ChevronDown size={15}/></button>
        {typeMenuOpen && <div className="status-filter-menu" role="menu" aria-label="Filter lookups by type">
          <button type="button" role="menuitemradio" aria-checked={typeFilter === 'all'} className={`status-filter-option ${typeFilter === 'all' ? 'selected' : ''}`} onClick={() => selectType('all')}><Tags size={16}/><span>All lookup types</span>{typeFilter === 'all' && <Check size={15}/>}</button>
          {LOOKUP_TYPES.map(type => <button key={type} type="button" role="menuitemradio" aria-checked={typeFilter === type} className={`status-filter-option ${typeFilter === type ? 'selected' : ''}`} onClick={() => selectType(type)}><span>{TYPE_LABELS[type]}</span>{typeFilter === type && <Check size={15}/>}</button>)}
        </div>}
      </div>
    </div>
    {error && <div className="inline-error users-error" role="alert">{error}</div>}
    <div className="table-card">
      <div className="table-wrap"><table>
        <thead><tr>
          <th aria-sort={sortBy === 'name' ? sortOrder === 'asc' ? 'ascending' : 'descending' : 'none'}><button type="button" className="table-sort" aria-label={`Sort by name ${sortLabel('name')}`} onClick={() => changeSort('name')}><span>Name</span>{sortIcon('name')}</button></th>
          <th>Type</th>
          <th aria-sort={sortBy === 'updated' ? sortOrder === 'asc' ? 'ascending' : 'descending' : 'none'}><button type="button" className="table-sort" aria-label={`Sort by updated ${sortLabel('updated')}`} onClick={() => changeSort('updated')}><span>Updated</span>{sortIcon('updated')}</button></th>
          <th>Actions</th>
        </tr></thead>
        {!loading && data.data?.length ? <tbody>{data.data.map(lookup => <tr key={lookup._id}>
            <td>{lookup.type === 'type' || lookup.type === 'category'
              ? <button type="button" className="lookup-drilldown" aria-label={`Open ${TYPE_LABELS[lookup.type === 'type' ? 'category' : 'sub_category']} for ${lookup.name}`} onClick={() => openChildren(lookup)}><strong className="lookup-name">{lookup.name}</strong><ChevronRight size={15}/></button>
              : <strong className="lookup-name">{lookup.name}</strong>}</td>
            <td><span className="lookup-type">{TYPE_LABELS[lookup.type] || lookup.type}</span></td>
            <td>{formatDate(lookup._updated_on)}</td>
            <td className="lookup-actions">
              <button className="icon-btn lookup-action-edit" title="Edit lookup" aria-label={`Edit ${lookup.name}`} onClick={() => openEditDialog(lookup)}><Pencil size={16}/></button>
              <button className="icon-btn lookup-action-delete" title="Delete lookup" aria-label={`Delete ${lookup.name}`} onClick={() => deleteLookup(lookup)}><Trash2 size={16}/></button>
            </td>
          </tr>)}</tbody> : null}
      </table>{loading
        ? <div className="lookup-empty-state" role="status">Loading…</div>
        : !data.data?.length && <div className="lookup-empty-state" role="status">No lookups found.</div>}</div>
      {totalPages > 1 && <div className="pagination-bar">
        <span className="pagination-summary">Showing {firstResult}-{lastResult} of {total} lookups</span>
        <div className="pagination-controls"><span>Page {currentPage} of {totalPages}</span><button className="icon-btn" aria-label="Previous page" title="Previous page" disabled={loading || currentPage <= 1} onClick={() => setPage(value => Math.max(1, value - 1))}><ChevronLeft size={17}/></button><button className="icon-btn" aria-label="Next page" title="Next page" disabled={loading || currentPage >= totalPages} onClick={() => setPage(value => Math.min(totalPages, value + 1))}><ChevronRight size={17}/></button></div>
      </div>}
    </div>
    {dialogOpen && <div className="dialog-backdrop" onMouseDown={event => { if (event.target === event.currentTarget) closeDialog(); }}>
      <section className="user-dialog lookup-dialog" role="dialog" aria-modal="true" aria-labelledby="lookup-dialog-title">
        <div className="dialog-heading"><h2 id="lookup-dialog-title">{editingLookup ? 'Edit lookup' : 'Add lookup'}</h2><button className="dialog-close" aria-label="Close" onClick={closeDialog}><X size={18}/></button></div>
        <form onSubmit={submitLookup}>
          <div className="lookup-dialog-field"><span className="lookup-dialog-label">Type</span><LookupDropdown label="Type" required disabled={!!editingLookup} value={form.type} options={LOOKUP_TYPES.map(type => ({ value: type, label: TYPE_LABELS[type] }))} onChange={type => setForm(value => ({ ...value, type, name: '', parent_id: '' }))}/></div>
          {form.type === 'type'
            ? <div className="lookup-dialog-field"><span className="lookup-dialog-label">Transaction type</span><LookupDropdown label="Transaction type" required value={form.name} placeholder="Choose transaction type" options={[{ value: 'Expense', label: 'Expense' }, { value: 'Income', label: 'Income' }]} onChange={name => setForm(value => ({ ...value, name }))}/></div>
            : <label>Name<input required maxLength={255} value={form.name} onChange={event => setForm(value => ({ ...value, name: event.target.value }))}/></label>}
          {requiredParentType && <div className="lookup-dialog-field"><span className="lookup-dialog-label">Parent {TYPE_LABELS[requiredParentType]}</span><LookupDropdown label={`Parent ${TYPE_LABELS[requiredParentType]}`} required value={form.parent_id} placeholder={parentLoading ? 'Loading parents…' : `Choose ${TYPE_LABELS[requiredParentType].toLowerCase()}`} options={parentOptions.map(option => ({ value: idValue(option._id), label: option.name }))} disabled={parentLoading || parentOptions.length === 0} onChange={parent_id => setForm(value => ({ ...value, parent_id }))}/>{!parentLoading && !parentOptions.length && !parentError && <span className="lookup-help">No active parent lookups available.</span>}</div>}
          {parentError && <div className="form-error" role="alert">{parentError}</div>}
          {dialogError && <div className="form-error" role="alert">{dialogError}</div>}
          <div className="dialog-actions"><button className="primary-btn" disabled={saving || parentLoading || !!parentError || (!!requiredParentType && !parentOptions.length)}>{saving ? 'Saving…' : <><Check size={16}/>{editingLookup ? 'Save changes' : 'Create lookup'}</>}</button></div>
        </form>
      </section>
    </div>}
  </div>;
}
