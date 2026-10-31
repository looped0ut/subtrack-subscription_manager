import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api, { errorMessage, rupees } from '../api.js';

const BADGE = {
  DRAFT: 'bg-slate-200 text-slate-700',
  QUOTATION: 'bg-amber-100 text-amber-800',
  CONFIRMED: 'bg-blue-100 text-blue-800',
  ACTIVE: 'bg-green-100 text-green-800',
  PAUSED: 'bg-orange-100 text-orange-800',
  CLOSED: 'bg-red-100 text-red-800',
};

// Which buttons each status shows: [apiAction, label]
const ACTIONS = {
  DRAFT: [['send-quote', 'Send quote']],
  QUOTATION: [['confirm', 'Confirm']],
  CONFIRMED: [['activate', 'Activate']],
  ACTIVE: [['pause', 'Pause'], ['close', 'Close']],
  PAUSED: [['resume', 'Resume'], ['close', 'Close']],
  CLOSED: [],
};

export default function Subscriptions() {
  const navigate = useNavigate();
  const user = JSON.parse(localStorage.getItem('user') || 'null');
  const isCustomer = user?.role === 'CUSTOMER';

  const [rows, setRows] = useState([]);
  const [status, setStatus] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busyId, setBusyId] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const { data } = await api.get('/subscriptions', {
        params: { limit: 50, status: status || undefined },
      });
      setRows(data.data);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [status]);

  useEffect(() => {
    if (!isCustomer) load();
  }, [isCustomer, load]);

  async function runAction(sub, action, label) {
    if (action === 'close' && !window.confirm(`Close ${sub.number}?`)) return;
    setBusyId(sub.id);
    setNotice('');
    try {
      await api.post(`/subscriptions/${sub.id}/${action}`, action === 'close' ? {} : undefined);
      setNotice(`${sub.number}: ${label} done`);
      await load();
    } catch (err) {
      // The server enforces the plan rules and explains any refusal
      setNotice(`${sub.number}: ${errorMessage(err)}`);
    } finally {
      setBusyId(null);
    }
  }

  function logout() {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    navigate('/login');
  }

  return (
    <div className="min-h-screen bg-slate-100">
      <header className="bg-white shadow-sm">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
          <h1 className="text-xl font-bold text-indigo-600">SubTrack</h1>
          <div className="flex items-center gap-3 text-sm text-slate-600">
            <span>
              {user?.name} <span className="rounded bg-indigo-100 px-2 py-0.5 text-indigo-700">{user?.role}</span>
            </span>
            <button onClick={logout} className="rounded-lg border border-slate-300 px-3 py-1 hover:bg-slate-50">
              Log out
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl p-4">
        {isCustomer ? (
          <div className="rounded-xl bg-white p-8 text-center text-slate-600 shadow">
            The customer portal (My subscriptions and My invoices) is coming next.
          </div>
        ) : (
          <>
            <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-lg font-semibold text-slate-800">Subscriptions</h2>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value)}
                className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm"
              >
                <option value="">All statuses</option>
                {Object.keys(BADGE).map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>

            {notice && (
              <div className="mb-3 rounded-lg border border-indigo-200 bg-indigo-50 px-4 py-2 text-sm text-indigo-800">
                {notice}
              </div>
            )}

            <div className="overflow-x-auto rounded-xl bg-white shadow">
              {loading ? (
                <p className="p-6 text-slate-500">Loading subscriptions...</p>
              ) : error ? (
                <p className="p-6 text-red-600">{error}</p>
              ) : rows.length === 0 ? (
                <p className="p-6 text-slate-500">No subscriptions found.</p>
              ) : (
                <table className="min-w-full text-left text-sm">
                  <thead className="bg-slate-50 text-slate-500">
                    <tr>
                      <th className="px-4 py-3">Number</th>
                      <th className="px-4 py-3">Customer</th>
                      <th className="px-4 py-3">Plan</th>
                      <th className="px-4 py-3">Status</th>
                      <th className="px-4 py-3">Expiry</th>
                      <th className="px-4 py-3 text-right">Total / cycle</th>
                      <th className="px-4 py-3">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((sub) => (
                      <tr key={sub.id} className="border-t border-slate-100">
                        <td className="px-4 py-3 font-medium">{sub.number}</td>
                        <td className="px-4 py-3">{sub.customer.name}</td>
                        <td className="px-4 py-3">{sub.plan.name}</td>
                        <td className="px-4 py-3">
                          <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${BADGE[sub.status]}`}>
                            {sub.status}
                          </span>
                        </td>
                        <td className="px-4 py-3">{sub.expiryDate.slice(0, 10)}</td>
                        <td className="px-4 py-3 text-right">{rupees(sub.totalAmount)}</td>
                        <td className="px-4 py-3">
                          <div className="flex gap-2">
                            {ACTIONS[sub.status].map(([action, label]) => (
                              <button
                                key={action}
                                disabled={busyId === sub.id}
                                onClick={() => runAction(sub, action, label)}
                                className="rounded-lg bg-indigo-600 px-3 py-1 text-xs font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
                              >
                                {label}
                              </button>
                            ))}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </>
        )}
      </main>
    </div>
  );
}