import React, { useState } from 'react';
import { TrendingUp, TrendingDown, Sparkles, Loader2, AlertTriangle, PiggyBank } from 'lucide-react';
import { useFinance } from '../../context/FinanceContext';
import { askFinancialAdvisor } from '../../services/deepseek';

export default function Insights() {
  const { transactions, currency, summary } = useFinance();
  const [advice, setAdvice] = useState(null);
  const [loading, setLoading] = useState(false);

  const now = new Date();
  const thisMonth = now.toISOString().slice(0, 7);
  const prevMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString().slice(0, 7);
  const monthLabel = now.toLocaleDateString('es-ES', { month: 'long', year: 'numeric' });

  const spendIn = (m) =>
    transactions
      .filter((t) => t.type === 'expense' && (t.date || '').slice(0, 7) === m)
      .reduce((s, t) => s + (t.amount || 0), 0);

  const thisSpend = spendIn(thisMonth);
  const prevSpend = spendIn(prevMonth);
  const delta = prevSpend > 0 ? ((thisSpend - prevSpend) / prevSpend) * 100 : null;

  const topCatMap = {};
  transactions
    .filter((t) => t.type === 'expense' && (t.date || '').slice(0, 7) === thisMonth)
    .forEach((t) => { topCatMap[t.category] = (topCatMap[t.category] || 0) + (t.amount || 0); });
  const topCat = Object.entries(topCatMap).sort((a, b) => b[1] - a[1])[0];

  const savings = summary.savingsRate;

  const getAdvice = async () => {
    setLoading(true);
    setAdvice(null);
    const res = await askFinancialAdvisor(
      'Dame un consejo claro, breve y muy concreto (máximo 3 líneas) para mejorar mis finanzas este mes.',
      transactions,
      summary
    );
    setAdvice(res);
    setLoading(false);
  };

  const fmt = (n) => `${currency} ${Number(n || 0).toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  return (
    <div className="neo-card" style={{ padding: '20px', marginBottom: '26px' }}>
      <div className="section-header" style={{ marginBottom: '14px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <span className="icon-chip icon-chip-ia" style={{ width: '44px', height: '44px' }}>
            <Sparkles size={22} />
          </span>
          <div>
            <h3 style={{ fontSize: '1.05rem', fontWeight: 800, color: 'var(--text-main)' }}>Tus Insights</h3>
            <p className="metric-hint" style={{ textTransform: 'capitalize' }}>{monthLabel}</p>
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '12px', marginBottom: '14px' }}>
        <div className="neo-inset" style={{ padding: '14px' }}>
          <span className="metric-hint" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            Gasto del mes
            {delta !== null && (delta > 0
              ? <TrendingUp size={14} color="var(--negative)" />
              : <TrendingDown size={14} color="var(--positive)" />)}
          </span>
          <span style={{ fontSize: '1.15rem', fontWeight: 800, color: 'var(--text-main)', display: 'block', marginTop: '4px' }}>
            {fmt(thisSpend)}
          </span>
          {delta !== null && (
            <span style={{ fontSize: '0.78rem', fontWeight: 700, color: delta > 0 ? 'var(--negative)' : 'var(--positive)' }}>
              {Math.abs(delta).toFixed(0)}% {delta > 0 ? 'más' : 'menos'} que el mes anterior
            </span>
          )}
        </div>

        <div className="neo-inset" style={{ padding: '14px' }}>
          <span className="metric-hint">Categoría con más gasto</span>
          <span style={{ fontSize: '1rem', fontWeight: 800, color: 'var(--text-main)', display: 'block', marginTop: '4px' }}>
            {topCat ? topCat[0] : '—'}
          </span>
          {topCat && <span className="metric-hint">{fmt(topCat[1])}</span>}
        </div>

        <div className="neo-inset" style={{ padding: '14px' }}>
          <span className="metric-hint" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <PiggyBank size={14} color="var(--positive)" /> Tasa de ahorro
          </span>
          <span style={{ fontSize: '1.15rem', fontWeight: 800, color: 'var(--positive)', display: 'block', marginTop: '4px' }}>
            {savings}%
          </span>
          {savings <= 10 && (
            <span style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--ia)', display: 'flex', alignItems: 'center', gap: '4px' }}>
              <AlertTriangle size={12} /> Busca ahorrar más
            </span>
          )}
        </div>
      </div>

      <button
        onClick={getAdvice}
        disabled={loading}
        className="btn btn-ghost"
        style={{ width: '100%' }}
      >
        {loading ? <Loader2 size={17} className="animate-spin" /> : <Sparkles size={17} />}
        {loading ? 'Pensando…' : 'Obtener consejo de IA'}
      </button>

      {advice && (
        <div className="toast toast-info" style={{ marginTop: '12px' }}>
          <Sparkles size={18} style={{ marginTop: '2px', flexShrink: 0 }} color="var(--ia)" />
          <div style={{ flex: 1 }}>
            <span className="toast-title">Consejo de tu asesor IA</span>
            <p className="toast-text">{advice}</p>
          </div>
        </div>
      )}
    </div>
  );
}
