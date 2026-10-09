import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import { ArrowDown, ArrowUp, ArrowUpDown, BarChart3, Check, ChevronDown, ChevronLeft, ChevronRight, Filter, List, Pencil, Plus, Search, Trash2, X } from 'lucide-react';
import { lookupsApi, transactionsApi } from '../services/api';

const LOOKUP_TYPES = ['account', 'type', 'category', 'sub_category', 'payment_mode'];
const FILTERS = [['account', 'Account'], ['type', 'Type'], ['category', 'Category'], ['payment_mode', 'Payment mode']];
const FORM_DEFAULTS = { date: '', description: '', account: '', type: '', category: '', sub_category: '', payment_mode: '', amount: '' };
const FILTER_DEFAULTS = { account: [], type: '', category: [], payment_mode: [] };
const SUMMARY_GROUPS = [
  ['year', 'Year'],
  ['year_type', 'Year and type'],
  ['month', 'Month'],
  ['month_type', 'Month and type'],
  ['type', 'Type'],
  ['type_account', 'Type and account'],
  ['type_payment_mode', 'Type and payment mode'],
  ['category', 'Category'],
  ['sub_category', 'Sub-category'],
  ['payment_mode', 'Payment mode']
];
const SUMMARY_COLUMNS = {
  year: [['year', 'Year']],
  year_type: [['year', 'Year'], ['type', 'Type']],
  month: [['year', 'Year'], ['month', 'Month']],
  month_type: [['year', 'Year'], ['month', 'Month'], ['type', 'Type']],
  type: [['type', 'Type']],
  type_account: [['type', 'Type'], ['account', 'Account']],
  type_payment_mode: [['type', 'Type'], ['payment_mode', 'Payment mode']],
  category: [['category', 'Category']],
  sub_category: [['sub_category', 'Sub-category']],
  payment_mode: [['payment_mode', 'Payment mode']]
};
const SUMMARY_DEFAULTS = { group_by: 'year', account: '', type: '', category: '', sub_category: '', payment_mode: '', year: '', month: '', start_date: '', end_date: '' };
const YEAR_REQUIRED_GROUPS = new Set(['month', 'month_type', 'type', 'type_payment_mode', 'category', 'sub_category', 'payment_mode']);
const SUMMARY_LOOKUP_FILTERS = ['account', 'type', 'category', 'sub_category', 'payment_mode'];
const MONGO_ID_REGEX = /^[a-f\d]{24}$/i;
const MONTHS = [
  ['1', 'January'], ['2', 'February'], ['3', 'March'], ['4', 'April'], ['5', 'May'], ['6', 'June'],
  ['7', 'July'], ['8', 'August'], ['9', 'September'], ['10', 'October'], ['11', 'November'], ['12', 'December']
];
const idValue = value => {
  if (typeof value !== 'object' || !value) return String(value || '');
  return value.$oid || idValue(value._id);
};
const name = value => typeof value === 'object' && value ? value.name || '—' : value || '—';
const allLabel = label => `All ${label === 'Category' ? 'categories' : `${label.toLowerCase()}s`}`;
const cloneFilters = filters => ({ ...filters, account: [...filters.account], category: [...filters.category], payment_mode: [...filters.payment_mode] });

const formatDate = (value) => {
  if (!value) return '—';
  const rawValue = typeof value === 'object' && value ? value.$date || value.date || value.value : value;
  const transactionDate = new Date(typeof rawValue === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(rawValue) ? `${rawValue}T00:00:00` : rawValue);
  if (Number.isNaN(transactionDate.getTime())) return '—';
  const parts = new Intl.DateTimeFormat('en-US', { day: '2-digit', month: 'short', year: 'numeric' }).formatToParts(transactionDate);
  const day = parts.find(part => part.type === 'day')?.value;
  const month = parts.find(part => part.type === 'month')?.value;
  const year = parts.find(part => part.type === 'year')?.value;
  return `${day} ${month} ${year}`;
};

const formatCurrency = (value) => Number(value || 0).toLocaleString('en-IN', { style: 'currency', currency: 'INR' });

const formatMonth = (value) => {
  const month = Number(value);
  return MONTHS.find(([monthValue]) => Number(monthValue) === month)?.[1] || value || '—';
};

const isValidCalendarDate = (value) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsedDate = new Date(value);
  return !Number.isNaN(parsedDate.getTime()) && parsedDate.toISOString().slice(0, 10) === value;
};

const validateSummaryFilters = (filters) => {
  if (!SUMMARY_GROUPS.some(([value]) => value === filters.group_by)) return 'Choose a valid summary type.';
  for (const key of SUMMARY_LOOKUP_FILTERS) {
    if (filters[key] && !MONGO_ID_REGEX.test(filters[key])) return `Choose a valid ${key.replace('_', ' ')}.`;
  }
  if (YEAR_REQUIRED_GROUPS.has(filters.group_by) && !filters.year) return 'Enter a year for this summary.';
  if (filters.year && (!/^\d+$/.test(String(filters.year)) || Number(filters.year) < 1900 || Number(filters.year) > 2100)) return 'Year must be between 1900 and 2100.';
  if (filters.month && (!/^\d+$/.test(String(filters.month)) || Number(filters.month) < 1 || Number(filters.month) > 12)) return 'Choose a valid month.';
  if (filters.start_date && !isValidCalendarDate(filters.start_date)) return 'Enter a valid start date.';
  if (filters.end_date && !isValidCalendarDate(filters.end_date)) return 'Enter a valid end date.';
  if (filters.start_date && filters.end_date && filters.start_date > filters.end_date) return 'Start date must be before end date.';
  return '';
};

const inputDate = value => {
  if (!value) return '';
  const rawValue = typeof value === 'object' && value ? value.$date || value.date || value.value : value;
  if (typeof rawValue === 'string' && /^\d{4}-\d{2}-\d{2}/.test(rawValue)) return rawValue.slice(0, 10);
  const parsedDate = new Date(rawValue);
  return Number.isNaN(parsedDate.getTime()) ? '' : parsedDate.toISOString().slice(0, 10);
};

const lookupOptions = (options, key, parentId = '') => {
  const values = options[key] || [];
  if (!parentId) return values;
  return values.filter(option => idValue(option.parent_id) === parentId);
};

const lookupIdFromValue = (options, key, value) => {
  const values = lookupOptions(options, key);
  if (typeof value === 'object' && value) {
    const directId = idValue(value);
    if (directId) return directId;
  }
  const primitiveValue = typeof value === 'object' ? '' : String(value || '');
  const matchedId = values.find(item => idValue(item._id) === primitiveValue);
  if (matchedId) return idValue(matchedId._id);
  const lookupName = name(value);
  if (lookupName === '—') return '';
  const option = values.find(item => item.name === lookupName);
  return option ? idValue(option._id) : '';
};

function TransactionDropdown({ label, value, options, placeholder, emptyLabel = '', disabled = false, required = false, onChange }) {
  const [open, setOpen] = useState(false);
  const [opensUp, setOpensUp] = useState(false);
  const rootRef = useRef(null);
  const triggerRef = useRef(null);
  const menuRef = useRef(null);
  const listId = useId();
  const selectedOption = options.find(option => option.value === value);
  const menuOptions = emptyLabel ? [{ value: '', label: emptyLabel }, ...options] : options;

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
      const boundary = rootRef.current?.closest('.transaction-dialog, .summary-more-menu, .transaction-filter-menu');
      const bounds = boundary?.getBoundingClientRect() || { top: 0, bottom: window.innerHeight };
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

  const chooseOption = (optionValue) => {
    onChange(optionValue);
    setOpen(false);
    triggerRef.current?.focus();
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
      disabled={disabled}
      onClick={() => setOpen(current => !current)}
      onKeyDown={event => {
        if (event.key === 'Escape') setOpen(false);
        if ((event.key === 'Enter' || event.key === ' ') && !open) {
          event.preventDefault();
          setOpen(true);
        }
      }}
    >
      <span className={selectedOption ? '' : 'placeholder'}>{selectedOption?.label || placeholder}</span>
      <ChevronDown className={open ? 'open' : ''} size={16}/>
    </button>
    {open && <div ref={menuRef} className={`lookup-dropdown-menu ${opensUp ? 'opens-up' : ''}`} id={listId} role="listbox" aria-label={label}>
      {menuOptions.length ? menuOptions.map(option => <div
        key={option.value || '__empty'}
        role="option"
        aria-selected={option.value === value}
        className={`lookup-dropdown-option ${option.value === value ? 'selected' : ''}`}
        onMouseDown={event => event.preventDefault()}
        onClick={() => chooseOption(option.value)}
      >
        <span>{option.label}</span>{option.value === value && <Check size={15}/>}
      </div>) : <div className="lookup-dropdown-option disabled" role="option" aria-disabled="true" aria-selected="false">No options available</div>}
    </div>}
  </div>;
}

export default function Transactions() {
  const [view, setView] = useState('list');
  const [result, setResult] = useState({ pagination: {}, data: [] });
  const [summaryRows, setSummaryRows] = useState([]);
  const [summaryFilters, setSummaryFilters] = useState(SUMMARY_DEFAULTS);
  const [activeSummaryGroup, setActiveSummaryGroup] = useState('year');
  const [options, setOptions] = useState({});
  const [filters, setFilters] = useState(FILTER_DEFAULTS);
  const [draftFilters, setDraftFilters] = useState(FILTER_DEFAULTS);
  const [search, setSearch] = useState('');
  const [query, setQuery] = useState('');
  const [listFiltersOpen, setListFiltersOpen] = useState(false);
  const [summaryMoreOpen, setSummaryMoreOpen] = useState(false);
  const [sortBy, setSortBy] = useState('date');
  const [sortOrder, setSortOrder] = useState('desc');
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [summaryError, setSummaryError] = useState('');
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [dialogError, setDialogError] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingTransaction, setEditingTransaction] = useState(null);
  const [form, setForm] = useState(FORM_DEFAULTS);
  const requestId = useRef(0);
  const summaryRequestId = useRef(0);
  const size = 10;

  const loadLookupOptions = async () => {
    const values = await Promise.all(LOOKUP_TYPES.map(async (key) => {
      try {
        const response = await lookupsApi.list({ page: 1, size: 100, 'type[]': key, sortBy: 'name', sortOrder: 'asc' });
        return [key, response.data || []];
      } catch {
        return [key, []];
      }
    }));
    setOptions(Object.fromEntries(values));
  };

  const load = async (targetPage = page, selectedFilters = filters, selectedQuery = query) => {
    const current = ++requestId.current;
    const params = { page: targetPage, size, is_active: 1, sortBy, sortOrder };
    if (selectedQuery.trim()) params.search = selectedQuery.trim();
    if (selectedFilters.type) params.type = selectedFilters.type;
    ['account', 'category', 'payment_mode'].forEach(key => {
      if (selectedFilters[key]?.length) params[key] = selectedFilters[key];
    });
    setLoading(true);
    setError('');
    try {
      const response = await transactionsApi.list(params);
      if (current !== requestId.current) return;
      const totalPages = Math.max(1, Math.ceil((Number(response.pagination?.total) || 0) / (Number(response.pagination?.size) || size)));
      if (targetPage > totalPages) setPage(totalPages);
      else setResult(response);
    } catch (requestError) {
      if (current === requestId.current) setError(requestError.message);
    } finally {
      if (current === requestId.current) setLoading(false);
    }
  };

  const loadSummary = async (selectedFilters = summaryFilters) => {
    const validationError = validateSummaryFilters(selectedFilters);
    if (validationError) {
      setSummaryError(validationError);
      return;
    }
    const current = ++summaryRequestId.current;
    const payload = { group_by: selectedFilters.group_by };
    SUMMARY_LOOKUP_FILTERS.forEach(key => {
      if (selectedFilters[key]) payload[key] = selectedFilters[key];
    });
    if (selectedFilters.year) payload.year = Number(selectedFilters.year);
    if (selectedFilters.month) payload.month = Number(selectedFilters.month);
    if (selectedFilters.start_date) payload.start_date = selectedFilters.start_date;
    if (selectedFilters.end_date) payload.end_date = selectedFilters.end_date;
    setSummaryLoading(true);
    setSummaryError('');
    try {
      const response = await transactionsApi.summary(payload);
      if (current === summaryRequestId.current) {
        setActiveSummaryGroup(selectedFilters.group_by);
        setSummaryRows(Array.isArray(response) ? response : []);
      }
    } catch (requestError) {
      if (current === summaryRequestId.current) setSummaryError(requestError.message);
    } finally {
      if (current === summaryRequestId.current) setSummaryLoading(false);
    }
  };

  useEffect(() => { const timer = setTimeout(() => setQuery(search), 450); return () => clearTimeout(timer); }, [search]);
  useEffect(() => {
    let active = true;
    Promise.all(LOOKUP_TYPES.map(async (key) => {
      try {
        const response = await lookupsApi.list({ page: 1, size: 100, 'type[]': key, sortBy: 'name', sortOrder: 'asc' });
        return [key, response.data || []];
      } catch {
        return [key, []];
      }
    })).then(values => { if (active) setOptions(Object.fromEntries(values)); });
    return () => { active = false; };
  }, []);
  useEffect(() => {
    if (!dialogOpen) return undefined;
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') closeDialog();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [dialogOpen]);
  useEffect(() => {
    load(page, filters, query);
  }, [page, query, filters, sortBy, sortOrder]);

  const openCreateDialog = () => {
    setEditingTransaction(null);
    setForm(FORM_DEFAULTS);
    setDialogError('');
    setDialogOpen(true);
    loadLookupOptions();
  };

  const openEditDialog = (transaction) => {
    setEditingTransaction(transaction);
    setForm({
      date: inputDate(transaction.date),
      description: transaction.description || '',
      account: lookupIdFromValue(options, 'account', transaction.account),
      type: lookupIdFromValue(options, 'type', transaction.type),
      category: lookupIdFromValue(options, 'category', transaction.category),
      sub_category: lookupIdFromValue(options, 'sub_category', transaction.sub_category),
      payment_mode: lookupIdFromValue(options, 'payment_mode', transaction.payment_mode),
      amount: transaction.amount ?? ''
    });
    setDialogError('');
    setDialogOpen(true);
    loadLookupOptions();
  };

  const closeDialog = () => {
    setDialogOpen(false);
    setDialogError('');
  };

  const updateForm = (key, value) => {
    setForm(current => ({
      ...current,
      [key]: value,
      ...(key === 'type' ? { category: '', sub_category: '' } : {}),
      ...(key === 'category' ? { sub_category: '' } : {})
    }));
  };

  const submitTransaction = async (event) => {
    event.preventDefault();
    const amount = Number(form.amount);
    if (!form.date || !form.description.trim() || !form.account || !form.type || !Number.isFinite(amount) || amount <= 0) {
      setDialogError('Complete all required transaction fields.');
      return;
    }
    if (form.sub_category && !form.category) {
      setDialogError('Choose a category before choosing a sub-category.');
      return;
    }
    setSaving(true);
    setDialogError('');
    const payload = {
      date: form.date,
      description: form.description.trim(),
      account: form.account,
      type: form.type,
      amount
    };
    if (form.category) payload.category = form.category;
    if (form.sub_category) payload.sub_category = form.sub_category;
    if (form.payment_mode) payload.payment_mode = form.payment_mode;
    try {
      if (editingTransaction) await transactionsApi.update(idValue(editingTransaction._id), payload);
      else await transactionsApi.create(payload);
      closeDialog();
      await load();
    } catch (requestError) {
      setDialogError(requestError.message);
    } finally {
      setSaving(false);
    }
  };

  const deleteTransaction = async (transaction) => {
    if (!window.confirm(`Delete ${transaction.description || 'this transaction'}?`)) return;
    setError('');
    try {
      await transactionsApi.remove(idValue(transaction._id));
      await load();
    } catch (requestError) {
      setError(requestError.message);
    }
  };

  const changeSort = (field) => {
    if (sortBy === field) setSortOrder(order => order === 'asc' ? 'desc' : 'asc');
    else {
      setSortBy(field);
      setSortOrder(field === 'date' ? 'desc' : 'asc');
    }
    setPage(1);
  };

  const openSummary = () => {
    setView('summary');
    loadSummary();
  };

  const openList = () => {
    setView('list');
    setSummaryError('');
  };

  const changeSummaryGroup = (groupBy) => {
    const now = new Date();
    const nextFilters = {
      ...summaryFilters,
      group_by: groupBy,
      year: YEAR_REQUIRED_GROUPS.has(groupBy) && !summaryFilters.year ? String(now.getFullYear()) : summaryFilters.year
    };
    setSummaryFilters(nextFilters);
    loadSummary(nextFilters);
  };

  const updateSummaryFilter = (key, value) => setSummaryFilters(current => ({
      ...current,
      [key]: value,
      ...(key === 'type' ? { category: '', sub_category: '' } : {}),
      ...(key === 'category' ? { sub_category: '' } : {})
    }));

  const submitSummaryFilters = (event) => {
    event.preventDefault();
    loadSummary(summaryFilters);
  };

  const clearSummaryFilters = () => {
    const nextFilters = SUMMARY_DEFAULTS;
    setSummaryFilters(nextFilters);
    loadSummary(nextFilters);
  };

  const sortIcon = (field) => sortBy !== field
    ? <ArrowUpDown size={14}/>
    : sortOrder === 'asc' ? <ArrowUp size={14}/> : <ArrowDown size={14}/>;
  const sortLabel = (field) => sortBy === field && sortOrder === 'desc' ? 'descending' : 'ascending';

  const total = Number(result.pagination?.total) || 0;
  const pageSize = Number(result.pagination?.size) || size;
  const currentPage = Number(result.pagination?.page) || page;
  const pages = Math.max(1, Math.ceil(total / pageSize));
  const firstResult = total ? (currentPage - 1) * pageSize + 1 : 0;
  const lastResult = Math.min(currentPage * pageSize, total);
  const updateDraftFilter = (key, value) => {
    setDraftFilters(current => ({
      ...current,
      [key]: value,
      ...(key === 'type' ? { category: [] } : {})
    }));
  };
  const applyListFilters = () => {
    setFilters(cloneFilters(draftFilters));
    setPage(1);
    setListFiltersOpen(false);
  };
  const resetListFilters = () => {
    const nextFilters = cloneFilters(FILTER_DEFAULTS);
    setDraftFilters(nextFilters);
    setFilters(nextFilters);
    setPage(1);
    setListFiltersOpen(false);
  };
  const draftFilterOptions = (key) => {
    if (key === 'category') return lookupOptions(options, key, draftFilters.type);
    return lookupOptions(options, key);
  };
  const formCategoryOptions = lookupOptions(options, 'category', form.type);
  const formSubCategoryOptions = lookupOptions(options, 'sub_category', form.category);
  const accountOptions = lookupOptions(options, 'account').map(option => ({ value: idValue(option._id), label: option.name }));
  const typeOptions = lookupOptions(options, 'type').map(option => ({ value: idValue(option._id), label: option.name }));
  const categoryOptions = formCategoryOptions.map(option => ({ value: idValue(option._id), label: option.name }));
  const subCategoryOptions = formSubCategoryOptions.map(option => ({ value: idValue(option._id), label: option.name }));
  const paymentModeOptions = lookupOptions(options, 'payment_mode').map(option => ({ value: idValue(option._id), label: option.name }));
  const summaryCategoryOptions = lookupOptions(options, 'category', summaryFilters.type).map(option => ({ value: idValue(option._id), label: option.name }));
  const summarySubCategoryOptions = lookupOptions(options, 'sub_category', summaryFilters.category).map(option => ({ value: idValue(option._id), label: option.name }));
  const listFilterCount = (filters.account?.length || 0) + (filters.category?.length || 0) + (filters.payment_mode?.length || 0) + (filters.type ? 1 : 0);
  const summaryFilterCount = ['year', 'start_date', 'end_date', 'month', 'account', 'type', 'category', 'sub_category', 'payment_mode'].filter(key => summaryFilters[key]).length;
  const summaryColumns = SUMMARY_COLUMNS[activeSummaryGroup] || SUMMARY_COLUMNS.year;
  const summaryTotal = summaryRows.reduce((totalAmount, row) => totalAmount + (Number(row.total_amount) || 0), 0);
  const summaryCount = summaryRows.reduce((totalCount, row) => totalCount + (Number(row.count) || 0), 0);
  const summaryValue = (row, key) => key === 'month' ? formatMonth(row[key]) : name(row[key]);
  const summaryChartRows = summaryRows
    .map((row, index) => {
      const amount = Number(row.total_amount) || 0;
      const label = summaryColumns.map(([key]) => summaryValue(row, key)).filter(Boolean).join(' / ') || 'Unknown';
      return {
        key: `${activeSummaryGroup}-${index}`,
        label,
        amount,
        count: Number(row.count) || 0,
        share: summaryTotal ? (amount / summaryTotal) * 100 : 0
      };
    })
    .sort((left, right) => right.amount - left.amount);
  const summaryMaxAmount = Math.max(...summaryChartRows.map(row => row.amount), 1);
  const summaryGroupOptions = SUMMARY_GROUPS.map(([value, label]) => ({ value, label }));
  const summaryMonthOptions = MONTHS.map(([value, label]) => ({ value, label }));
  const pageTitle = view === 'summary' ? 'Transaction Summary' : 'Transactions';
  const pageDescription = view === 'summary' ? 'Review grouped totals and trends across your transactions.' : 'Track and manage your income and expenses.';

  return <div className="transactions-page">
    <div className="page-heading">
      <div><h1>{pageTitle}</h1><p>{pageDescription}</p></div>
      <div className="page-actions">
        <button className="secondary-btn compact" onClick={view === 'summary' ? openList : openSummary}>{view === 'summary' ? <List size={16}/> : <BarChart3 size={16}/>}{view === 'summary' ? 'Show list' : 'Show summary'}</button>
        <button className="primary-btn compact" onClick={openCreateDialog}><Plus size={16}/>Add transaction</button>
      </div>
    </div>
    {view === 'summary' ? <form className="summary-toolbar" onSubmit={submitSummaryFilters}>
      <div className="summary-toolbar-field"><span>Summary type</span><TransactionDropdown label="Summary type" value={summaryFilters.group_by} placeholder="Choose summary type" options={summaryGroupOptions} onChange={changeSummaryGroup}/></div>
      <div className="summary-more" onBlur={event => { if (!event.currentTarget.contains(event.relatedTarget)) setSummaryMoreOpen(false); }}>
        <button className="status-filter-trigger summary-more-trigger" type="button" aria-haspopup="menu" aria-expanded={summaryMoreOpen} onClick={() => setSummaryMoreOpen(open => !open)}><Filter size={16}/><span>{summaryFilterCount ? `Filters (${summaryFilterCount})` : 'Filters'}</span><ChevronDown size={15}/></button>
        {summaryMoreOpen && <div className="summary-more-menu" role="menu" aria-label="Summary filters">
          <label>Year<input type="number" min="1900" max="2100" placeholder="Year" value={summaryFilters.year} onChange={event => updateSummaryFilter('year', event.target.value)}/></label>
          <label>Start date<input type="date" value={summaryFilters.start_date} onChange={event => updateSummaryFilter('start_date', event.target.value)}/></label>
          <label>End date<input type="date" value={summaryFilters.end_date} onChange={event => updateSummaryFilter('end_date', event.target.value)}/></label>
          <div className="summary-toolbar-field"><span>Month</span><TransactionDropdown label="Month" value={summaryFilters.month} placeholder="All months" emptyLabel="All months" options={summaryMonthOptions} onChange={value => updateSummaryFilter('month', value)}/></div>
          <div className="summary-toolbar-field"><span>Account</span><TransactionDropdown label="Account" value={summaryFilters.account} placeholder="All accounts" emptyLabel="All accounts" options={accountOptions} onChange={value => updateSummaryFilter('account', value)}/></div>
          <div className="summary-toolbar-field"><span>Type</span><TransactionDropdown label="Type" value={summaryFilters.type} placeholder="All types" emptyLabel="All types" options={typeOptions} onChange={value => updateSummaryFilter('type', value)}/></div>
          <div className="summary-toolbar-field"><span>Category</span><TransactionDropdown label="Category" value={summaryFilters.category} placeholder="All categories" emptyLabel="All categories" options={summaryCategoryOptions} onChange={value => updateSummaryFilter('category', value)}/></div>
          <div className="summary-toolbar-field"><span>Sub-category</span><TransactionDropdown label="Sub-category" value={summaryFilters.sub_category} placeholder="All sub-categories" emptyLabel="All sub-categories" options={summarySubCategoryOptions} disabled={!summaryFilters.category && summarySubCategoryOptions.length === 0} onChange={value => updateSummaryFilter('sub_category', value)}/></div>
          <div className="summary-toolbar-field"><span>Payment mode</span><TransactionDropdown label="Payment mode" value={summaryFilters.payment_mode} placeholder="All payment modes" emptyLabel="All payment modes" options={paymentModeOptions} onChange={value => updateSummaryFilter('payment_mode', value)}/></div>
          <div className="summary-toolbar-actions"><button className="secondary-btn compact" type="button" onClick={clearSummaryFilters}>Reset</button><button className="primary-btn compact" disabled={summaryLoading}><Filter size={16}/>{summaryLoading ? 'Loading...' : 'Apply'}</button></div>
        </div>}
      </div>
    </form> : <div className="transactions-toolbar">
      <div className="users-search"><Search size={17} aria-hidden="true"/><input value={search} onChange={event => { setSearch(event.target.value); setPage(1); }} placeholder="Search transactions…" aria-label="Search transactions"/></div>
      <div className="transaction-filters" onBlur={event => { if (!event.currentTarget.contains(event.relatedTarget)) setListFiltersOpen(false); }}>
        <button type="button" className="status-filter-trigger transaction-filter-trigger" aria-haspopup="menu" aria-expanded={listFiltersOpen} onClick={() => { setDraftFilters(cloneFilters(filters)); setListFiltersOpen(open => !open); }}><Filter size={16}/><span>{listFilterCount ? `Filters (${listFilterCount})` : 'Filters'}</span><ChevronDown size={15}/></button>
        {listFiltersOpen && <div className="transaction-filter-menu" role="menu" aria-label="Transaction filters">
          {FILTERS.map(([key, label]) => <div key={key} className="transaction-filter-section">
            <span>{label}</span>
            {Array.isArray(draftFilters[key])
              ? <TransactionDropdown label={label} value={draftFilters[key][0] || ''} placeholder={allLabel(label)} emptyLabel={allLabel(label)} options={draftFilterOptions(key).map(option => ({ value: idValue(option._id), label: option.name }))} onChange={value => updateDraftFilter(key, value ? [value] : [])}/>
              : <TransactionDropdown label={label} value={draftFilters[key]} placeholder={allLabel(label)} emptyLabel={allLabel(label)} options={draftFilterOptions(key).map(option => ({ value: idValue(option._id), label: option.name }))} onChange={value => updateDraftFilter(key, value)}/>}
          </div>)}
          <div className="summary-toolbar-actions transaction-filter-actions"><button className="secondary-btn compact" type="button" onClick={resetListFilters}>Reset</button><button className="primary-btn compact" type="button" onClick={applyListFilters}>Apply</button></div>
        </div>}
      </div>
    </div>}
    {view === 'summary' && summaryError && <div className="inline-error users-error" role="alert">{summaryError}</div>}
    {view === 'list' && error && <div className="inline-error users-error" role="alert">{error}</div>}
    {view === 'summary' ? <div className="table-card transaction-table-card">
      <div className="home-summary-heading"><div><BarChart3 size={18}/><span>Transaction Summary</span></div><span>{formatCurrency(summaryTotal)} across {summaryCount} transactions</span></div>
      <div className="summary-chart-wrap">{summaryLoading
        ? <div className="lookup-empty-state" role="status">Loading…</div>
        : summaryChartRows.length ? <div className="summary-chart" role="list" aria-label="Transaction summary chart">
          {summaryChartRows.map((row, index) => <div className="summary-chart-row" role="listitem" key={row.key}>
            <div className="summary-chart-label"><span>{row.label}</span><small>{row.count} transactions</small></div>
            <div className="summary-chart-bar-track" aria-label={`${row.label}: ${formatCurrency(row.amount)}, ${row.count} transactions`}>
              <div className={`summary-chart-bar color-${index % 6}`} style={{ width: `${Math.max((row.amount / summaryMaxAmount) * 100, 2)}%` }}/>
            </div>
            <div className="summary-chart-value"><strong>{formatCurrency(row.amount)}</strong><span>{row.share.toFixed(1)}%</span></div>
          </div>)}
        </div> : <div className="lookup-empty-state" role="status">No summary data found.</div>}</div>
    </div> : <div className="table-card transaction-table-card">
      <div className="table-wrap"><table>
        <thead><tr>
          <th aria-sort={sortBy === 'date' ? sortOrder === 'asc' ? 'ascending' : 'descending' : 'none'}><button type="button" className="table-sort" aria-label={`Sort by date ${sortLabel('date')}`} onClick={() => changeSort('date')}><span>Date</span>{sortIcon('date')}</button></th>
          <th>Description</th>
          <th aria-sort={sortBy === 'account' ? sortOrder === 'asc' ? 'ascending' : 'descending' : 'none'}><button type="button" className="table-sort" aria-label={`Sort by account ${sortLabel('account')}`} onClick={() => changeSort('account')}><span>Account</span>{sortIcon('account')}</button></th>
          <th aria-sort={sortBy === 'type' ? sortOrder === 'asc' ? 'ascending' : 'descending' : 'none'}><button type="button" className="table-sort" aria-label={`Sort by type ${sortLabel('type')}`} onClick={() => changeSort('type')}><span>Type</span>{sortIcon('type')}</button></th>
          <th>Category</th><th>Sub-category</th>
          <th aria-sort={sortBy === 'payment_mode' ? sortOrder === 'asc' ? 'ascending' : 'descending' : 'none'}><button type="button" className="table-sort" aria-label={`Sort by payment mode ${sortLabel('payment_mode')}`} onClick={() => changeSort('payment_mode')}><span>Payment mode</span>{sortIcon('payment_mode')}</button></th>
          <th className="amount-cell" aria-sort={sortBy === 'amount' ? sortOrder === 'asc' ? 'ascending' : 'descending' : 'none'}><button type="button" className="table-sort amount-sort" aria-label={`Sort by amount ${sortLabel('amount')}`} onClick={() => changeSort('amount')}><span>Amount</span>{sortIcon('amount')}</button></th>
          <th>Actions</th>
        </tr></thead>
        {!loading && result.data?.length ? <tbody>{result.data.map(transaction => <tr key={idValue(transaction._id)}>
          <td>{formatDate(transaction.date)}</td>
          <td><strong className="transaction-description">{transaction.description || '—'}</strong></td>
          <td>{name(transaction.account)}</td>
          <td><span className="lookup-type">{name(transaction.type)}</span></td>
          <td>{name(transaction.category)}</td>
          <td>{name(transaction.sub_category)}</td>
          <td><span className="lookup-type">{name(transaction.payment_mode)}</span></td>
          <td className="amount-cell">{Number(transaction.amount || 0).toLocaleString('en-IN', { style: 'currency', currency: 'INR' })}</td>
          <td className="transaction-actions">
            <button className="icon-btn lookup-action-edit" title="Edit transaction" aria-label={`Edit ${transaction.description || 'transaction'}`} onClick={() => openEditDialog(transaction)}><Pencil size={16}/></button>
            <button className="icon-btn lookup-action-delete" title="Delete transaction" aria-label={`Delete ${transaction.description || 'transaction'}`} onClick={() => deleteTransaction(transaction)}><Trash2 size={16}/></button>
          </td>
        </tr>)}</tbody> : null}
      </table>{loading
        ? <div className="lookup-empty-state" role="status">Loading…</div>
        : !result.data?.length && <div className="lookup-empty-state" role="status">No transactions found.</div>}</div>
      {pages > 1 && <div className="pagination-bar">
        <span className="pagination-summary">Showing {firstResult}-{lastResult} of {total} transactions</span>
        <div className="pagination-controls"><span>Page {currentPage} of {pages}</span><button className="icon-btn" aria-label="Previous page" title="Previous page" disabled={loading || currentPage <= 1} onClick={() => setPage(value => Math.max(1, value - 1))}><ChevronLeft size={17}/></button><button className="icon-btn" aria-label="Next page" title="Next page" disabled={loading || currentPage >= pages} onClick={() => setPage(value => Math.min(pages, value + 1))}><ChevronRight size={17}/></button></div>
      </div>}
    </div>}
    {dialogOpen && <div className="dialog-backdrop" onMouseDown={event => { if (event.target === event.currentTarget) closeDialog(); }}>
      <section className="user-dialog transaction-dialog" role="dialog" aria-modal="true" aria-labelledby="transaction-dialog-title">
        <div className="dialog-heading"><h2 id="transaction-dialog-title">{editingTransaction ? 'Edit transaction' : 'Add transaction'}</h2><button className="dialog-close" aria-label="Close" onClick={closeDialog}><X size={18}/></button></div>
        <form onSubmit={submitTransaction}>
          <label>Date<input type="date" required value={form.date} onChange={event => updateForm('date', event.target.value)}/></label>
          <label>Description<input required maxLength={255} pattern="[A-Za-z][A-Za-z0-9 _()[\]-]{0,254}" title="Start with a letter. Use letters, digits, spaces, underscores, brackets, or hyphens." value={form.description} onChange={event => updateForm('description', event.target.value)}/></label>
          <div className="transaction-dialog-grid">
            <div className="transaction-dialog-field"><span className="lookup-dialog-label">Account</span><TransactionDropdown label="Account" required value={form.account} placeholder="Choose account" options={accountOptions} disabled={accountOptions.length === 0} onChange={value => updateForm('account', value)}/></div>
            <div className="transaction-dialog-field"><span className="lookup-dialog-label">Type</span><TransactionDropdown label="Type" required value={form.type} placeholder="Choose type" options={typeOptions} disabled={typeOptions.length === 0} onChange={value => updateForm('type', value)}/></div>
            <div className="transaction-dialog-field"><span className="lookup-dialog-label">Category</span><TransactionDropdown label="Category" value={form.category} placeholder={form.type ? 'Choose category' : 'Choose type first'} emptyLabel="No category" options={categoryOptions} disabled={!form.type || categoryOptions.length === 0} onChange={value => updateForm('category', value)}/></div>
            <div className="transaction-dialog-field"><span className="lookup-dialog-label">Sub-category</span><TransactionDropdown label="Sub-category" value={form.sub_category} placeholder={form.category ? 'Choose sub-category' : 'Choose category first'} emptyLabel="No sub-category" options={subCategoryOptions} disabled={!form.category || subCategoryOptions.length === 0} onChange={value => updateForm('sub_category', value)}/></div>
            <div className="transaction-dialog-field"><span className="lookup-dialog-label">Payment mode</span><TransactionDropdown label="Payment mode" value={form.payment_mode} placeholder="Choose payment mode" emptyLabel="No payment mode" options={paymentModeOptions} disabled={paymentModeOptions.length === 0} onChange={value => updateForm('payment_mode', value)}/></div>
            <label>Amount<input type="number" required min="0.01" step="0.01" value={form.amount} onChange={event => updateForm('amount', event.target.value)}/></label>
          </div>
          {dialogError && <div className="form-error" role="alert">{dialogError}</div>}
          <div className="dialog-actions"><button className="primary-btn" disabled={saving}>{saving ? 'Saving…' : <><Check size={16}/>{editingTransaction ? 'Save changes' : 'Create transaction'}</>}</button></div>
        </form>
      </section>
    </div>}
  </div>;
}
