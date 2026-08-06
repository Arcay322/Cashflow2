import React, { useState } from 'react';
import {
  TrendingUp,
  TrendingDown,
  Sparkles,
  Loader2,
  AlertTriangle,
  PiggyBank,
  CalendarClock,
  Wallet,
  Copy,
  CalendarX2
} from 'lucide-react';
import { useFinance } from '../../context/FinanceContext';
import { askFinancialAdvisor } from '../../services/deepseek';
import { projectMonthEnd, budgetAlerts, categoryTrends, detectAnomalies, savingsRecommendations, generateSummary, formatMoney } from '../../services/analytics';

export default function Insights() {
  const { transactions, currency, summary, budgets } = useFinance();
  const [advice, setAdvice] = useState(null);
  const [loading, setLoading] = useState(false);
  const [resumen, setResumen] = useState(null);

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

  const projection = projectMonthEnd(transactions);
  const alerts = budgetAlerts(transactions, budgets);
  const activeAlerts = alerts.filter((a) => a.status !== 'ok');
  const trends = categoryTrends(transactions).slice(0, 3);
  const anomalies = detectAnomalies(transactions);
  const savingsRecs = savingsRecommendations(transactions, budgets);

  const fmt = (n) => formatMoney(n, currency);
  const alertMeta = {
    over: { color: 'var(--negative)', label: 'Superó el presupuesto' },
    warning: { color: 'var(--ia)', label: 'Superará al fin de mes' },
    caution: { color: 'var(--ia)', label: 'Se acerca al límite' }
  };

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
          <span className="metric-hint" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <CalendarClock size={14} color="var(--ia)" /> Proyección fin de mes
          </span>
          <span style={{ fontSize: '1.15rem', fontWeight: 800, color: 'var(--text-main)', display: 'block', marginTop: '4px' }}>
            {fmt(projection.projectedExpense)}
          </span>
          <span style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-muted)' }}>
            {projection.daysLeft} día(s) restantes · ahorro estimado {fmt(projection.projectedBalance)}
          </span>
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

      {/* D2 - Alertas tempranas de presupuesto */}
      <div className="neo-inset" style={{ padding: '14px', marginBottom: '12px' }}>
        <span className="metric-hint" style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '8px' }}>
          <Wallet size={14} color="var(--ia)" /> Alertas de presupuesto
        </span>
        {activeAlerts.length === 0 ? (
          <p className="toast-text" style={{ color: 'var(--positive)', fontWeight: 700 }}>
            Todo bajo control: ninguna categoría cerca de superar su presupuesto.
          </p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {activeAlerts.slice(0, 5).map((a) => {
              const meta = alertMeta[a.status];
              const barPct = Math.min(a.projectedPct, 100);
              return (
                <div key={a.category}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                    <span style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--text-main)' }}>{a.category}</span>
                    <span style={{ fontSize: '0.76rem', fontWeight: 800, color: meta.color }}>
                      {fmt(a.spent)} / {fmt(a.budget)}
                    </span>
                  </div>
                  <div className="neo-inset" style={{ height: '8px', padding: 0, overflow: 'hidden', marginBottom: '4px' }}>
                    <div style={{ height: '100%', width: `${barPct}%`, background: meta.color, borderRadius: '6px' }} />
                  </div>
                  <span style={{ fontSize: '0.74rem', fontWeight: 700, color: meta.color }}>
                    {meta.label} ({a.status === 'over' ? `${a.pct}%` : `${a.projectedPct}% proyectado`})
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* D3 - Anomalías */}
      {anomalies.length > 0 && (
        <div className="neo-inset" style={{ padding: '14px', marginBottom: '12px' }}>
          <span className="metric-hint" style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '8px' }}>
            <AlertTriangle size={14} color="var(--negative)" /> Anomalías detectadas
          </span>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {anomalies.slice(0, 5).map((a, idx) => (
              <div key={idx} style={{ display: 'flex', alignItems: 'flex-start', gap: '8px' }}>
                {a.type === 'duplicate'
                  ? <Copy size={15} style={{ flexShrink: 0, marginTop: '2px' }} color="var(--ia)" />
                  : a.type === 'missed_recurring'
                    ? <CalendarX2 size={15} style={{ flexShrink: 0, marginTop: '2px' }} color="var(--ia)" />
                    : <AlertTriangle size={15} style={{ flexShrink: 0, marginTop: '2px' }} color="var(--negative)" />}
                <span style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', fontWeight: 600 }}>{a.message}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* D4 - Recomendaciones de ahorro */}
      {savingsRecs.length > 0 && (
        <div className="neo-inset" style={{ padding: '14px', marginBottom: '12px' }}>
          <span className="metric-hint" style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '8px' }}>
            <PiggyBank size={14} color="var(--positive)" /> Recomendaciones de ahorro
          </span>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {savingsRecs.slice(0, 3).map((r, idx) => (
              <div key={idx} style={{ display: 'flex', alignItems: 'flex-start', gap: '8px' }}>
                <PiggyBank size={15} style={{ flexShrink: 0, marginTop: '2px' }} color="var(--positive)" />
                <span style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', fontWeight: 600 }}>{r.message}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* D5 - Resumen diario/semanal */}
      <div className="neo-inset" style={{ padding: '14px', marginBottom: '12px' }}>
        <span className="metric-hint" style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '8px' }}>
          <CalendarClock size={14} color="var(--ia)" /> Resumen automático
        </span>
        <div style={{ display: 'flex', gap: '8px', marginBottom: resumen ? '10px' : 0 }}>
          <button className="btn btn-ghost" style={{ padding: '8px 14px', fontSize: '0.82rem' }} onClick={() => setResumen(generateSummary(transactions, 'day', currency))}>
            Resumen del día
          </button>
          <button className="btn btn-ghost" style={{ padding: '8px 14px', fontSize: '0.82rem' }} onClick={() => setResumen(generateSummary(transactions, 'week', currency))}>
            Resumen de la semana
          </button>
        </div>
        {resumen && (
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px' }}>
            <CalendarClock size={15} style={{ flexShrink: 0, marginTop: '2px' }} color="var(--ia)" />
            <p className="toast-text" style={{ margin: 0 }}>{resumen}</p>
          </div>
        )}
      </div>

      {/* D1 - Tendencias por categoría */}
      {trends.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '14px' }}>
          {trends.map((t) => {
            const up = t.delta !== null && t.delta > 0;
            return (
              <span key={t.category} className="badge" style={{ background: 'var(--surface-soft)' }}>
                {t.category}
                <span style={{ color: up ? 'var(--negative)' : 'var(--positive)', fontWeight: 800 }}>
                  {t.delta === null ? ' nuevo' : ` ${up ? '+' : ''}${Math.round(t.delta)}%`}
                </span>
              </span>
            );
          })}
        </div>
      )}

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
