import { useEffect, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, Search } from 'lucide-react';
import { lookupsApi, transactionsApi } from '../services/api';

const FILTERS = [['account', 'Account'], ['type', 'Type'], ['category', 'Category'], ['payment_mode', 'Payment mode']];
const id = value => typeof value === 'object' && value ? value.$oid || value._id || '' : String(value || '');
const name = value => typeof value === 'object' && value ? value.name || '—' : value || '—';
const date = value => value ? new Intl.DateTimeFormat('en-US', { day: '2-digit', month: 'short', year: 'numeric' }).format(new Date(`${value}T00:00:00`)) : '—';

export default function Transactions() {
  const [result, setResult] = useState({ pagination: {}, data: [] });
  const [options, setOptions] = useState({});
  const [filters, setFilters] = useState({ account: '', type: '', category: '', payment_mode: '' });
  const [search, setSearch] = useState('');
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const requestId = useRef(0);
  const size = 10;

  useEffect(() => { const timer = setTimeout(() => setQuery(search), 450); return () => clearTimeout(timer); }, [search]);
  useEffect(() => {
    let active = true;
    Promise.all(FILTERS.map(async ([key]) => [key, (await lookupsApi.list({ page: 1, size: 100, 'type[]': key, sortBy: 'name', sortOrder: 'asc' })).data || []]))
      .then(values => active && setOptions(Object.fromEntries(values))).catch(() => {});
    return () => { active = false; };
  }, []);
  useEffect(() => {
    const current = ++requestId.current;
    const params = { page, size, search: query, sortBy: 'date', sortOrder: 'desc' };
    Object.entries(filters).forEach(([key, value]) => { if (value) params[key] = value; });
    setLoading(true); setError('');
    transactionsApi.list(params).then(response => {
      if (current !== requestId.current) return;
      const totalPages = Math.max(1, Math.ceil((Number(response.pagination?.total) || 0) / (Number(response.pagination?.size) || size)));
      if (page > totalPages) setPage(totalPages); else setResult(response);
    }).catch(requestError => current === requestId.current && setError(requestError.message)).finally(() => current === requestId.current && setLoading(false));
  }, [page, query, filters]);

  const total = Number(result.pagination?.total) || 0;
  const pageSize = Number(result.pagination?.size) || size;
  const currentPage = Number(result.pagination?.page) || page;
  const pages = Math.max(1, Math.ceil(total / pageSize));
  const updateFilter = (key, value) => { setFilters(current => ({ ...current, [key]: value })); setPage(1); };
  return <div className="transactions-page">
    <div className="page-heading"><div><h1>Transactions</h1><p>Track and manage your income and expenses.</p></div></div>
    <div className="transactions-toolbar"><div className="users-search"><Search size={17}/><input value={search} onChange={event => { setSearch(event.target.value); setPage(1); }} placeholder="Search transactions…" aria-label="Search transactions"/></div><div className="transaction-filters">{FILTERS.map(([key, label]) => <select key={key} className="transaction-filter" value={filters[key]} onChange={event => updateFilter(key, event.target.value)} aria-label={`Filter by ${label}`}><option value="">All {label}s</option>{(options[key] || []).map(option => <option key={id(option._id)} value={id(option._id)}>{option.name}</option>)}</select>)}</div></div>
    {error && <div className="inline-error users-error" role="alert">{error}</div>}
    <div className="table-card transaction-table-card"><div className="table-wrap"><table><thead><tr><th>Date</th><th>Description</th><th>Account</th><th>Type</th><th>Category</th><th>Payment mode</th><th className="amount-cell">Amount</th></tr></thead>{!loading && result.data?.length ? <tbody>{result.data.map(transaction => <tr key={transaction._id}><td>{date(transaction.date)}</td><td><strong className="transaction-description">{transaction.description || '—'}</strong></td><td>{name(transaction.account)}</td><td>{name(transaction.type)}</td><td>{name(transaction.category)}</td><td>{name(transaction.payment_mode)}</td><td className="amount-cell">{Number(transaction.amount || 0).toLocaleString('en-IN', { style: 'currency', currency: 'INR' })}</td></tr>)}</tbody> : null}</table>{loading ? <div className="lookup-empty-state" role="status">Loading…</div> : !result.data?.length && <div className="lookup-empty-state" role="status">No transactions found.</div>}</div>{pages > 1 && <div className="pagination-bar"><span className="pagination-summary">Showing {total ? (currentPage - 1) * pageSize + 1 : 0}-{Math.min(currentPage * pageSize, total)} of {total} transactions</span><div className="pagination-controls"><span>Page {currentPage} of {pages}</span><button className="icon-btn" aria-label="Previous page" disabled={loading || currentPage <= 1} onClick={() => setPage(value => value - 1)}><ChevronLeft size={17}/></button><button className="icon-btn" aria-label="Next page" disabled={loading || currentPage >= pages} onClick={() => setPage(value => value + 1)}><ChevronRight size={17}/></button></div></div>}</div>
  </div>;
}
