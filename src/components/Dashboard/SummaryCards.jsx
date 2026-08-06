import React from 'react';
import { ArrowUpCircle, ArrowDownCircle, Wallet, PiggyBank } from 'lucide-react';
import { useFinance } from '../../context/FinanceContext';

export default function SummaryCards() {
  const { summary, currency } = useFinance();

  const balancePositive = summary.netBalance >= 0;
  const fmt = (n) => n.toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  return (
    <div className="grid-dashboard">

      {/* Net Balance Card */}
      <div className="neo-card" style={{ padding: '24px', position: 'relative', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', right: '-12px', bottom: '-12px', opacity: 0.07 }}>
          <Wallet size={130} color={balancePositive ? 'var(--positive)' : 'var(--negative)'} />
        </div>
        <div className="section-header" style={{ marginBottom: '14px' }}>
          <span className="metric-label" style={{ marginBottom: 0 }}>Balance Neto</span>
          <span className={`icon-chip ${balancePositive ? 'icon-chip-positive' : 'icon-chip-negative'}`}>
            <Wallet size={20} />
          </span>
        </div>
        <h3 className="metric-value" style={{ color: balancePositive ? 'var(--positive)' : 'var(--negative)' }}>
          {currency} {fmt(summary.netBalance)}
        </h3>
        <p className="metric-hint">
          {balancePositive
            ? '🟢 Balance positivo en tus finanzas'
            : '🔴 Tus gastos superan tus ingresos'}
        </p>
      </div>

      {/* Total Income Card */}
      <div className="neo-card" style={{ padding: '24px' }}>
        <div className="section-header" style={{ marginBottom: '14px' }}>
          <span className="metric-label" style={{ marginBottom: 0 }}>Ingresos Totales</span>
          <span className="icon-chip icon-chip-positive">
            <ArrowUpCircle size={20} />
          </span>
        </div>
        <h3 className="metric-value" style={{ color: 'var(--positive)' }}>
          + {currency} {fmt(summary.totalIncome)}
        </h3>
        <p className="metric-hint">Entradas totales registradas</p>
      </div>

      {/* Total Expenses Card */}
      <div className="neo-card" style={{ padding: '24px' }}>
        <div className="section-header" style={{ marginBottom: '14px' }}>
          <span className="metric-label" style={{ marginBottom: 0 }}>Gastos Totales</span>
          <span className="icon-chip icon-chip-negative">
            <ArrowDownCircle size={20} />
          </span>
        </div>
        <h3 className="metric-value" style={{ color: 'var(--negative)' }}>
          - {currency} {fmt(summary.totalExpense)}
        </h3>
        <p className="metric-hint">Salidas totales de dinero</p>
      </div>

      {/* Savings Rate Card */}
      <div className="neo-card" style={{ padding: '24px' }}>
        <div className="section-header" style={{ marginBottom: '14px' }}>
          <span className="metric-label" style={{ marginBottom: 0 }}>Tasa de Ahorro</span>
          <span className="icon-chip icon-chip-ia">
            <PiggyBank size={20} />
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px' }}>
          <h3 className="metric-value" style={{ color: 'var(--ia)' }}>
            {summary.savingsRate}%
          </h3>
          <span className="metric-hint" style={{ marginTop: 0 }}>de tus ingresos</span>
        </div>
        <div className="progress-track" style={{ marginTop: '12px' }}>
          <div
            className="progress-fill"
            style={{ width: `${Math.min(100, summary.savingsRate)}%`, background: 'linear-gradient(90deg, var(--positive), var(--mint))' }}
          />
        </div>
      </div>

    </div>
  );
}
