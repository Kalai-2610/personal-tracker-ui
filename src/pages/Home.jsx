import { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowDownCircle, ArrowUpCircle, RefreshCw, Scale, WalletCards } from 'lucide-react';
import { transactionsApi } from '../services/api';

const formatCurrency = (value) => Number(value || 0).toLocaleString('en-IN', { style: 'currency', currency: 'INR' });

const normalizeType = (value) => String(value || '').trim().toLowerCase();

export default function Home() {
  const [summary, setSummary] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const requestId = useRef(0);

  const loadSummary = async (showRefreshing = false) => {
    const current = ++requestId.current;
    if (showRefreshing) setRefreshing(true);
    else setLoading(true);
    setError('');
    try {
      const result = await transactionsApi.summary({ group_by: 'type_account' });
      if (current === requestId.current) setSummary(Array.isArray(result) ? result : []);
    } catch (requestError) {
      if (current === requestId.current) setError(requestError.message);
    } finally {
      if (current === requestId.current) {
        setLoading(false);
        setRefreshing(false);
      }
    }
  };

  useEffect(() => { loadSummary(); }, []);

  const accounts = useMemo(() => {
    const grouped = new Map();
    summary.forEach(row => {
      const account = row.account || 'Unknown account';
      const current = grouped.get(account) || { account, income: 0, expense: 0, count: 0 };
      const amount = Number(row.total_amount) || 0;
      const type = normalizeType(row.type);
      if (type === 'income') current.income += amount;
      if (type === 'expense') current.expense += amount;
      current.count += Number(row.count) || 0;
      grouped.set(account, current);
    });
    return Array.from(grouped.values())
      .map(account => ({ ...account, balance: account.income - account.expense }))
      .sort((left, right) => left.account.localeCompare(right.account));
  }, [summary]);

  const totals = useMemo(() => accounts.reduce((total, account) => ({
    income: total.income + account.income,
    expense: total.expense + account.expense,
    balance: total.balance + account.balance,
    count: total.count + account.count
  }), { income: 0, expense: 0, balance: 0, count: 0 }), [accounts]);

  return <div className="home-page">
    <div className="page-heading">
      <div><h1>Accounts Summary</h1><p>Income, expense, and balance across your accounts.</p></div>
      <button className="secondary-btn compact" disabled={loading || refreshing} onClick={() => loadSummary(true)}><RefreshCw size={16}/>{refreshing ? 'Refreshing...' : 'Refresh'}</button>
    </div>
    {error && <div className="inline-error users-error" role="alert">{error}</div>}
    <div className="summary-metrics">
      <div className="summary-metric income"><span><ArrowUpCircle size={18}/>Income</span><strong>{formatCurrency(totals.income)}</strong></div>
      <div className="summary-metric expense"><span><ArrowDownCircle size={18}/>Expense</span><strong>{formatCurrency(totals.expense)}</strong></div>
      <div className={`summary-metric balance ${totals.balance < 0 ? 'negative' : 'positive'}`}><span><Scale size={18}/>Balance</span><strong>{formatCurrency(totals.balance)}</strong></div>
    </div>
    <div className="table-card home-summary-card">
      <div className="home-summary-heading"><div><WalletCards size={18}/><span>Account Summary</span></div><span>{totals.count} transactions</span></div>
      <div className="table-wrap"><table>
        <thead><tr><th>Account</th><th className="amount-cell">Income</th><th className="amount-cell">Expense</th><th className="amount-cell">Balance</th><th className="amount-cell">Transactions</th></tr></thead>
        {!loading && accounts.length ? <tbody>{accounts.map(account => <tr key={account.account}>
          <td><strong className="transaction-description">{account.account}</strong></td>
          <td className="amount-cell">{formatCurrency(account.income)}</td>
          <td className="amount-cell">{formatCurrency(account.expense)}</td>
          <td className={`amount-cell balance-value ${account.balance < 0 ? 'negative' : 'positive'}`}>{formatCurrency(account.balance)}</td>
          <td className="amount-cell">{account.count}</td>
        </tr>)}</tbody> : null}
      </table>{loading
        ? <div className="lookup-empty-state" role="status">Loading…</div>
        : !accounts.length && <div className="lookup-empty-state" role="status">No transaction summary found.</div>}</div>
    </div>
  </div>;
}
