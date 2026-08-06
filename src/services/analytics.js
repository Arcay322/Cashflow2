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

export function formatMoney(n, currency = 'S/.') {
  return `${currency} ${Number(n || 0).toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

/**
 * D4 - Recomendaciones de ahorro personalizadas.
 * Basadas solo en datos locales: categoría dominante, sobrepresupuesto y recurrentes.
 */
export function savingsRecommendations(transactions, budgets = {}, now = new Date()) {
  const cur = currentMonthContext(now);
  const monthTx = transactions.filter(t => t.type === 'expense' && monthKey(t.date) === cur.key);
  const byCat = {};
  monthTx.forEach(t => { byCat[t.category] = (byCat[t.category] || 0) + (t.amount || 0); });
  const recs = [];

  const top = Object.entries(byCat).sort((a, b) => b[1] - a[1])[0];
  if (top) {
    const cut = top[1] * 0.15;
    if (cut >= 10) {
      recs.push({ type: 'dominant', savings: cut, message: `Recortar un 15% en "${top[0]}" (${formatMoney(top[1])} este mes) te ahorraría ~${formatMoney(cut)} al mes.` });
    }
  }

  Object.entries(budgets).forEach(([category, budget]) => {
    const spent = byCat[category] || 0;
    if (Number(budget) > 0 && spent > Number(budget)) {
      recs.push({ type: 'over_budget', savings: spent - Number(budget), message: `"${category}" excedió su presupuesto en ${formatMoney(spent - Number(budget))} (${formatMoney(spent)} vs ${formatMoney(Number(budget))}).` });
    }
  });

  const recurringMonthly = {};
  transactions.filter(t => t.recurring && t.type === 'expense').forEach(t => {
    recurringMonthly[t.category] = (recurringMonthly[t.category] || 0) + (t.amount || 0);
  });
  Object.entries(recurringMonthly).forEach(([category, total]) => {
    if (total >= 50) {
      recs.push({ type: 'recurring', savings: total, message: `Tienes ${formatMoney(total)} en suscripciones recurrentes de "${category}". Revisa si realmente las usas todas.` });
    }
  });

  return recs.sort((a, b) => b.savings - a.savings);
}

const toISO = (d) => d.toISOString().split('T')[0];

/**
 * D5 - Resumen diario/semanal generado en cliente (sin LLM).
 */
export function generateSummary(transactions, period = 'day', currency = 'S/.', now = new Date()) {
  const todayISO = toISO(now);
  let tx;
  let label;
  if (period === 'day') {
    tx = transactions.filter(t => (t.date || '') === todayISO);
    label = 'Hoy';
  } else {
    const from = toISO(new Date(now.getTime() - 6 * 86400000));
    tx = transactions.filter(t => t.date && t.date >= from && t.date <= todayISO);
    label = 'Esta semana';
  }

  const income = sum(tx.filter(t => t.type === 'income'));
  const expense = sum(tx.filter(t => t.type === 'expense'));
  const nIncome = tx.filter(t => t.type === 'income').length;
  const nExpense = tx.filter(t => t.type === 'expense').length;

  let text = `${label}: ${nExpense} gasto(s) por ${formatMoney(expense, currency)} y ${nIncome} ingreso(s) por ${formatMoney(income, currency)}. Balance: ${formatMoney(income - expense, currency)}.`;
  if (expense > 0) {
    const byCat = {};
    tx.filter(t => t.type === 'expense').forEach(t => { byCat[t.category] = (byCat[t.category] || 0) + (t.amount || 0); });
    const top = Object.entries(byCat).sort((a, b) => b[1] - a[1])[0];
    if (top) text += ` Mayor gasto en "${top[0]}" (${formatMoney(top[1], currency)}).`;
  }
  return text;
}

const toDate = (str) => new Date((str || '1970-01-01') + 'T00:00:00').getTime();
const dayDiff = (a, b) => Math.round((toDate(a) - toDate(b)) / 86400000);

/**
 * D3 - Anomalías.
 * Detecta: gastos duplicados, saltos inusuales por categoría y recurrentes omitidos.
 * Devuelve [{ type, severity, message, count? }] ordenados por gravedad.
 */
export function detectAnomalies(transactions, now = new Date()) {
  const anomalies = [];
  const cur = currentMonthContext(now);
  const todayISO = `${cur.key}-${String(cur.day).padStart(2, '0')}`;

  // 1) Duplicados: mismo tipo, categoría y monto en días cercanos.
  const groups = {};
  transactions.forEach((t) => {
    const key = `${t.type}|${t.category}|${Number(t.amount).toFixed(2)}`;
    (groups[key] = groups[key] || []).push(t);
  });
  Object.values(groups).forEach((list) => {
    if (list.length < 2) return;
    list.sort((a, b) => (a.date < b.date ? -1 : 1));
    let cluster = [list[0]];
    for (let i = 1; i < list.length; i += 1) {
      if (dayDiff(list[i].date, cluster[0].date) <= 2) {
        cluster.push(list[i]);
      } else {
        if (cluster.length >= 2) {
          const label = `${cluster[0].type === 'income' ? 'ingresos' : 'gastos'} de ${formatMoney(cluster[0].amount)} en "${cluster[0].category}"`;
          anomalies.push({ type: 'duplicate', severity: 'medium', count: cluster.length, message: `Posible duplicado: ${cluster.length} ${label} registrados en fechas cercanas (${cluster[0].date} y ${cluster[cluster.length - 1].date}).` });
        }
        cluster = [list[i]];
      }
    }
    if (cluster.length >= 2) {
      const label = `${cluster[0].type === 'income' ? 'ingresos' : 'gastos'} de ${formatMoney(cluster[0].amount)} en "${cluster[0].category}"`;
      anomalies.push({ type: 'duplicate', severity: 'medium', count: cluster.length, message: `Posible duplicado: ${cluster.length} ${label} registrados en fechas cercanas (${cluster[0].date} y ${cluster[cluster.length - 1].date}).` });
    }
  });

  // 2) Salto inusual: gasto actual de una categoría muy por encima de su promedio mensual previo.
  const prevKeys = [];
  for (let i = 1; i <= 3; i += 1) {
    const d = new Date(cur.key + '-01');
    d.setMonth(d.getMonth() - i);
    prevKeys.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
  }
  const monthly = {};
  transactions.forEach((t) => {
    if (t.type !== 'expense') return;
    const k = monthKey(t.date);
    const bucket = monthly[t.category] = monthly[t.category] || { current: 0, prev: {} };
    if (k === cur.key) bucket.current += t.amount || 0;
    else if (prevKeys.includes(k)) bucket.prev[k] = (bucket.prev[k] || 0) + (t.amount || 0);
  });
  Object.entries(monthly).forEach(([category, b]) => {
    const prevMonths = Object.values(b.prev);
    if (prevMonths.length === 0 || b.current === 0) return;
    const avgPrev = prevMonths.reduce((s, v) => s + v, 0) / prevMonths.length;
    if (avgPrev > 0 && b.current > avgPrev * 2.5) {
      anomalies.push({
        type: 'spike',
        severity: 'high',
        message: `Salto inusual: ya gastaste ${formatMoney(b.current)} en "${category}", un ${Math.round((b.current / avgPrev) * 100)}% de tu promedio mensual (${formatMoney(avgPrev)}).`
      });
    }
  });

  // 3) Recurrente omitido: ocurrencia esperada este mes sin registrar.
  const existingOcc = new Set(transactions.filter(t => t.source).map(t => `${t.source}|${t.date}`));
  transactions.forEach((t) => {
    if (!t.recurring || !t.date) return;
    const [by, bm, bd] = t.date.split('-').map(Number);
    if (!by || !bm || !bd) return;
    const expectedDay = Math.min(bd, new Date(Number(cur.key.split('-')[0]), Number(cur.key.split('-')[1]), 0).getDate());
    const expectedDate = `${cur.key}-${String(expectedDay).padStart(2, '0')}`;
    const sourceId = t.source || t.id;
    if (expectedDate <= todayISO && !existingOcc.has(`${sourceId}|${expectedDate}`)) {
      anomalies.push({
        type: 'missed_recurring',
        severity: 'low',
        message: `Recurrente omitido: se esperaba "${t.description}" de ${formatMoney(t.amount)} el ${expectedDate} y no está registrado.`
      });
    }
  });

  const rank = { high: 0, medium: 1, low: 2 };
  return anomalies.sort((a, b) => rank[a.severity] - rank[b.severity]);
}
