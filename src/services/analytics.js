/**
 * Cashflow IA - Análisis en cliente (Fase D1/D2)
 *
 * Cálculos deterministas y sin coste de LLM: proyección de fin de mes (D1)
 * y alertas tempranas de presupuesto (D2). El LLM solo redacta.
 */

const monthKey = (dateStr) => (dateStr || '').slice(0, 7);

function currentMonthContext(now = new Date()) {
  const y = now.getFullYear();
  const m = now.getMonth();
  return {
    key: `${y}-${String(m + 1).padStart(2, '0')}`,
    day: now.getDate(),
    daysInMonth: new Date(y, m + 1, 0).getDate()
  };
}

function prevMonthKey(now = new Date()) {
  const y = now.getFullYear();
  const m = now.getMonth() - 1;
  return `${y}-${String(((m % 12) + 12) % 12 + 1).padStart(2, '0')}`;
}

const sum = (arr) => arr.reduce((s, t) => s + (t.amount || 0), 0);

/**
 * D1 - Proyección de fin de mes.
 * Estima gasto/ingreso total al cerrar el mes según el promedio diario real.
 */
export function projectMonthEnd(transactions, now = new Date()) {
  const ctx = currentMonthContext(now);
  const monthTx = transactions.filter(t => monthKey(t.date) === ctx.key);
  const spent = sum(monthTx.filter(t => t.type === 'expense'));
  const earned = sum(monthTx.filter(t => t.type === 'income'));

  const daysElapsed = Math.max(ctx.day, 1);
  const dailyExpense = spent / daysElapsed;
  const dailyIncome = earned / daysElapsed;

  const projectedExpense = dailyExpense * ctx.daysInMonth;
  const projectedIncome = dailyIncome * ctx.daysInMonth;

  return {
    monthKey: ctx.key,
    daysElapsed,
    daysInMonth: ctx.daysInMonth,
    daysLeft: Math.max(ctx.daysInMonth - ctx.day, 0),
    spent,
    earned,
    dailyExpense,
    dailyIncome,
    projectedExpense,
    projectedIncome,
    projectedBalance: projectedIncome - projectedExpense
  };
}

/**
 * D2 - Alertas tempranas de presupuesto por categoría.
 *  status: 'ok' | 'caution' | 'warning' | 'over'
 *  - warning: al ritmo actual superará el presupuesto antes de fin de mes.
 *  - over: ya superó el presupuesto.
 */
export function budgetAlerts(transactions, budgets = {}, now = new Date()) {
  const ctx = currentMonthContext(now);
  const monthTx = transactions.filter(t => t.type === 'expense' && monthKey(t.date) === ctx.key);

  const byCat = {};
  monthTx.forEach(t => { byCat[t.category] = (byCat[t.category] || 0) + (t.amount || 0); });

  const daysElapsed = Math.max(ctx.day, 1);
  const results = [];

  Object.entries(budgets).forEach(([category, budget]) => {
    const amount = Number(budget) || 0;
    if (amount <= 0) return;
    const spent = byCat[category] || 0;
    const projected = (spent / daysElapsed) * ctx.daysInMonth;
    const pct = Math.round((spent / amount) * 100);
    const projectedPct = Math.round((projected / amount) * 100);

    let status = 'ok';
    if (spent > amount) status = 'over';
    else if (projected >= amount) status = 'warning';
    else if (projectedPct >= 80) status = 'caution';

    results.push({ category, budget: amount, spent, projected, pct, projectedPct, status });
  });

  return results.sort((a, b) => {
    const rank = { over: 0, warning: 1, caution: 2, ok: 3 };
    return rank[a.status] - rank[b.status] || b.projectedPct - a.projectedPct;
  });
}

/**
 * D1 - Tendencias por categoría: gasto de este mes vs mes anterior.
 * Devuelve solo categorías con movimiento en alguno de los dos meses.
 */
export function categoryTrends(transactions, now = new Date()) {
  const cur = currentMonthContext(now).key;
  const prev = prevMonthKey(now);
  const map = {};
  transactions.forEach(t => {
    if (t.type !== 'expense') return;
    const k = monthKey(t.date);
    if (k !== cur && k !== prev) return;
    if (!map[t.category]) map[t.category] = { category: t.category, current: 0, previous: 0 };
    if (k === cur) map[t.category].current += t.amount || 0;
    else map[t.category].previous += t.amount || 0;
  });
  return Object.values(map).map(({ category, current, previous }) => ({
    category,
    current,
    previous,
    delta: previous > 0 ? ((current - previous) / previous) * 100 : (current > 0 ? null : 0)
  })).sort((a, b) => b.current - a.current);
}

export function formatMoney(n, currency) {
  return `${currency} ${Number(n || 0).toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}
