import React, { useEffect, useMemo, useState } from 'react'
import { createRoot } from 'react-dom/client'
import './style.css'

const getApiBaseUrl = () => {
  const envUrl = import.meta.env.VITE_API_URL
  if (envUrl && envUrl.trim() !== '') {
    const trimmed = envUrl.trim().replace(/\/+$/, '')
    return trimmed.endsWith('/api') ? trimmed : `${trimmed}/api`
  }
  return import.meta.env.DEV ? 'http://localhost:8080/api' : '/api'
}

const API = getApiBaseUrl()
const money = n => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(Number(n || 0))
const today = new Date().toISOString().slice(0, 10)

function App() {
  const [dashboard, setDashboard] = useState(null)
  const [transactions, setTransactions] = useState([])
  const [budgets, setBudgets] = useState([])
  const [goals, setGoals] = useState([])
  const [error, setError] = useState('')
  const [txn, setTxn] = useState({ title: '', amount: '', type: 'EXPENSE', category: 'Food', date: today })
  const [budget, setBudget] = useState({ category: 'Food', monthlyLimit: '' })
  const [goal, setGoal] = useState({ name: '', targetAmount: '' })

  async function request(path, options = {}) {
    const response = await fetch(`${API}${path}`, {
      headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
      ...options
    })
    if (!response.ok) {
      let message = `Request failed (${response.status})`
      try { const body = await response.json(); message = body.message || message } catch {}
      throw new Error(message)
    }
    if (response.status === 204) return null
    return response.json()
  }

  async function refresh() {
    try {
      const [d, t, b, g] = await Promise.all([
        request('/dashboard'), request('/transactions'), request('/budgets'), request('/goals')
      ])
      setDashboard(d); setTransactions(t); setBudgets(b); setGoals(g); setError('')
    } catch (e) { setError(`${e.message}. Unable to reach the backend API at ${API}.`) }
  }
  useEffect(() => { refresh() }, [])

  async function addTransaction(e) {
    e.preventDefault()
    try {
      await request('/transactions', { method: 'POST', body: JSON.stringify({ ...txn, amount: Number(txn.amount) }) })
      setTxn({ ...txn, title: '', amount: '' }); await refresh()
    } catch (e) { setError(e.message) }
  }
  async function saveBudget(e) {
    e.preventDefault()
    try {
      await request('/budgets', { method: 'POST', body: JSON.stringify({ ...budget, monthlyLimit: Number(budget.monthlyLimit) }) })
      setBudget({ ...budget, monthlyLimit: '' }); await refresh()
    } catch (e) { setError(e.message) }
  }
  async function addGoal(e) {
    e.preventDefault()
    try {
      await request('/goals', { method: 'POST', body: JSON.stringify({ ...goal, targetAmount: Number(goal.targetAmount) }) })
      setGoal({ name: '', targetAmount: '' }); await refresh()
    } catch (e) { setError(e.message) }
  }
  async function contribute(id) {
    const amount = window.prompt('How much would you like to save? (₹)')
    if (amount === null) return
    if (!Number.isFinite(Number(amount)) || Number(amount) <= 0) { setError('Enter a positive contribution amount.'); return }
    try { await request(`/goals/${id}/contribute?amount=${encodeURIComponent(amount)}`, { method: 'PATCH' }); await refresh() }
    catch (e) { setError(e.message) }
  }
  async function deleteTransaction(id) {
    try { await request(`/transactions/${id}`, { method: 'DELETE' }); await refresh() }
    catch (e) { setError(e.message) }
  }

  const categorySpend = useMemo(() => dashboard?.categorySpend || [], [dashboard])
  return <div className="app-shell">
    <aside className="sidebar">
      <div className="brand"><div className="brand-mark">₹</div><div><b>Pennywise</b><small>PERSONAL FINANCE</small></div></div>
      <div className="nav-label">WORKSPACE</div>
      <a className="nav active" href="#overview">▦ <span>Overview</span></a>
      <a className="nav" href="#transactions">↕ <span>Transactions</span></a>
      <a className="nav" href="#budgets">◷ <span>Budgets</span></a>
      <a className="nav" href="#savings">◎ <span>Piggy Bank</span></a>
      <div className="sidebar-bottom"><div className="avatar">ST</div><div><b>Smart Tracker</b><small>Local workspace</small></div></div>
    </aside>
    <main className="main" id="overview">
      <header className="topbar"><div><div className="eyebrow">YOUR MONEY, IN FOCUS</div><h1>Financial overview</h1><p className="muted">A clearer picture of your spending and savings.</p></div><button className="outline-btn" onClick={refresh}>↻ Refresh data</button></header>
      {error && <div className="error">{error}<button onClick={() => setError('')}>×</button></div>}
      <section className="stats">
        <Stat label="TOTAL INCOME · THIS MONTH" value={money(dashboard?.income)} icon="↗" tone="green" />
        <Stat label="TOTAL EXPENSES · THIS MONTH" value={money(dashboard?.expenses)} icon="↘" tone="orange" />
        <Stat label="NET BALANCE · THIS MONTH" value={money(dashboard?.balance)} icon="₹" tone="purple" />
      </section>
      <section className="content-grid">
        <div className="panel" id="transactions">
          <div className="panel-head"><div><h2>Recent transactions</h2><p>Keep track of money coming in and going out.</p></div><span className="count">{transactions.length} records</span></div>
          <form className="form-grid" onSubmit={addTransaction}>
            <label>Description<input required maxLength="160" value={txn.title} onChange={e=>setTxn({...txn,title:e.target.value})} placeholder="e.g. Grocery shopping" /></label>
            <label>Amount (₹)<input required min="0.01" step="0.01" type="number" value={txn.amount} onChange={e=>setTxn({...txn,amount:e.target.value})} placeholder="0.00" /></label>
            <label>Type<select value={txn.type} onChange={e=>setTxn({...txn,type:e.target.value})}><option value="EXPENSE">Expense</option><option value="INCOME">Income</option></select></label>
            <label>Category<select value={txn.category} onChange={e=>setTxn({...txn,category:e.target.value})}>{['Food','Transport','Shopping','Bills','Health','Education','Salary','Other'].map(c=><option key={c}>{c}</option>)}</select></label>
            <label>Date<input required type="date" value={txn.date} onChange={e=>setTxn({...txn,date:e.target.value})} /></label>
            <button className="primary-btn add-btn" type="submit">＋ Add transaction</button>
          </form>
          <div className="table-wrap"><table><thead><tr><th>TRANSACTION</th><th>CATEGORY</th><th>DATE</th><th>AMOUNT</th><th></th></tr></thead><tbody>
            {transactions.slice(0,8).map(t=><tr key={t.ID ?? t.id}><td><div className="txn-title"><span className={`txn-icon ${String(t.TYPE ?? t.type).toLowerCase()}`}>{String(t.TYPE ?? t.type)==='INCOME'?'↙':'↗'}</span><b>{t.TITLE ?? t.title}</b></div></td><td><span className="category-pill">{t.CATEGORY ?? t.category}</span></td><td>{String(t.DATE ?? t.date).slice(0,10)}</td><td className={String(t.TYPE ?? t.type)==='INCOME'?'positive':'negative'}>{String(t.TYPE ?? t.type)==='INCOME'?'+':'−'}{money(t.AMOUNT ?? t.amount)}</td><td><button className="delete-btn" title="Delete transaction" onClick={()=>deleteTransaction(t.ID ?? t.id)}>×</button></td></tr>)}
            {!transactions.length && <tr><td colSpan="5" className="empty">No transactions yet. Add one above to get started.</td></tr>}
          </tbody></table></div>
        </div>
        <div className="panel" id="budgets">
          <div className="panel-head"><div><h2>Monthly budgets</h2><p>Spending against your category limits.</p></div></div>
          <form className="budget-form" onSubmit={saveBudget}>
            <label>Category<select value={budget.category} onChange={e=>setBudget({...budget,category:e.target.value})}>{['Food','Transport','Shopping','Bills','Health','Education','Other'].map(c=><option key={c}>{c}</option>)}</select></label>
            <label>Limit (₹)<input required min="1" step="1" type="number" value={budget.monthlyLimit} onChange={e=>setBudget({...budget,monthlyLimit:e.target.value})} placeholder="Monthly cap" /></label>
            <button className="primary-btn" type="submit">Save budget</button>
          </form>
          <div className="budget-list">{budgets.map(b=>{
            const category = b.CATEGORY ?? b.category, limit = Number(b.MONTHLYLIMIT ?? b.monthlyLimit ?? 0)
            const spend = Number(b.spent ?? categorySpend.find(s=>(s.CATEGORY ?? s.category)===category)?.SPENT ?? categorySpend.find(s=>(s.CATEGORY ?? s.category)===category)?.spent ?? 0)
            const over = spend > limit, pct = limit ? Math.min(100, spend / limit * 100) : 0
            return <div className="budget-item" key={b.ID ?? b.id}><div className="budget-line"><b>{category}</b><span className={over?'over':''}>{money(spend)} <small>/ {money(limit)}</small></span></div><div className="progress"><div className={over?'bar over-bar':'bar'} style={{width:`${pct}%`}} /></div>{over && <div className="warning">Over budget by {money(spend-limit)}</div>}</div>
          })}</div>
          <div className="spend-summary"><span className="dot"></span> Current month expense totals by category</div>
        </div>
      </section>
      <section className="panel savings-panel" id="savings">
        <div className="panel-head"><div><h2>🐷 Piggy Bank savings goals</h2><p>Small contributions today, bigger milestones tomorrow.</p></div></div>
        <form className="goal-form" onSubmit={addGoal}>
          <label>Goal name<input required maxLength="160" value={goal.name} onChange={e=>setGoal({...goal,name:e.target.value})} placeholder="e.g. Holiday fund" /></label>
          <label>Target amount (₹)<input required min="1" step="0.01" type="number" value={goal.targetAmount} onChange={e=>setGoal({...goal,targetAmount:e.target.value})} placeholder="Target savings" /></label>
          <button className="primary-btn" type="submit">＋ Create goal</button>
        </form>
        <div className="goals-grid">{goals.map(g=>{
          const target=Number(g.TARGETAMOUNT ?? g.targetAmount), saved=Number(g.SAVEDAMOUNT ?? g.savedAmount), pct=target?Math.min(100,saved/target*100):0
          return <div className="goal-card" key={g.ID ?? g.id}><div className="goal-top"><div className="goal-icon">◎</div><span className={pct>=100?'complete':''}>{pct>=100?'GOAL REACHED':`${Math.round(pct)}% SAVED`}</span></div><h3>{g.NAME ?? g.name}</h3><div className="goal-amount">{money(saved)} <small>of {money(target)}</small></div><div className="progress goal-progress"><div className="bar" style={{width:`${pct}%`}} /></div><div className="goal-bottom"><span>{money(Math.max(0,target-saved))} to go</span><button className="small-btn" onClick={()=>contribute(g.ID ?? g.id)}>＋ Add savings</button></div></div>
        })}{!goals.length && <div className="empty">Create a savings goal to start your Piggy Bank.</div>}</div>
      </section>
      <footer>SMART EXPENSE TRACKER <span>•</span> Built with React, Spring Boot & JDBC</footer>
    </main>
  </div>
}
function Stat({label,value,icon,tone}) { return <div className="stat-card"><div className="stat-label">{label}</div><div className="stat-row"><strong>{value ?? '—'}</strong><span className={`stat-icon ${tone}`}>{icon}</span></div><div className="stat-foot">Updated from your transactions</div></div> }
createRoot(document.getElementById('root')).render(<App />)
