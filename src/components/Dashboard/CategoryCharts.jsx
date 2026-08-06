import React from 'react';
import { PieChart as PieIcon, TrendingDown, Layers } from 'lucide-react';
import { useFinance } from '../../context/FinanceContext';

const CATEGORY_COLORS = {
  'Alimentación y Comida': '#2e9e6b',
  'Transporte y Gasolina': '#2c7a7b',
  'Servicios (Luz, Agua, Internet)': '#3b82c4',
  'Entretenimiento y Ocio': '#b8860b',
  'Salud y Medicinas': '#8e5fbf',
  'Educación y Cursos': '#d97706',
  'Hogar y Compras': '#c96a5e',
  'Otros': '#7a8a99'
};

export default function CategoryCharts() {
  const { transactions, currency } = useFinance();

  // Filter expenses
  const expenses = transactions.filter(t => t.type === 'expense');
  const totalExpense = expenses.reduce((sum, t) => sum + t.amount, 0);

  // Group expenses by category
  const categoryTotals = expenses.reduce((acc, t) => {
    acc[t.category] = (acc[t.category] || 0) + t.amount;
    return acc;
  }, {});

  // Sort categories by highest expense
  const sortedCategories = Object.entries(categoryTotals)
    .map(([cat, amt]) => ({
      category: cat,
      amount: amt,
      percentage: totalExpense > 0 ? Math.round((amt / totalExpense) * 100) : 0,
      color: CATEGORY_COLORS[cat] || '#7a8a99'
    }))
    .sort((a, b) => b.amount - a.amount);

  // Build SVG Donut Chart Paths
  let cumulativePercent = 0;
  const getCoordinatesForPercent = (percent) => {
    const x = Math.cos(2 * Math.PI * percent);
    const y = Math.sin(2 * Math.PI * percent);
    return [x, y];
  };

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '22px', marginBottom: '28px' }}>

      {/* Category Expense Breakdown */}
      <div className="neo-card" style={{ padding: '24px' }}>
        <div className="section-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span className="icon-chip icon-chip-negative">
              <PieIcon size={18} />
            </span>
            <h3 style={{ fontSize: '1.1rem', fontWeight: 800, color: 'var(--text-main)' }}>Gastos por Categoría</h3>
          </div>
          <span className="metric-hint">{sortedCategories.length} categorías</span>
        </div>

        {sortedCategories.length === 0 ? (
          <div style={{ padding: '40px 0', textAlign: 'center', color: 'var(--text-muted)' }}>
            <Layers size={36} style={{ opacity: 0.4, marginBottom: '8px' }} />
            <p style={{ fontSize: '0.95rem', fontWeight: 500 }}>No hay gastos registrados aún</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {sortedCategories.map((item, idx) => (
              <div key={idx}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px', fontSize: '0.92rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ width: '12px', height: '12px', borderRadius: '4px', background: item.color, flexShrink: 0 }} />
                    <span style={{ fontWeight: 600, color: 'var(--text-secondary)' }}>{item.category}</span>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <span style={{ fontWeight: 800, color: 'var(--text-main)' }}>{currency} {item.amount.toFixed(2)}</span>
                    <span className="metric-hint" style={{ marginLeft: '6px' }}>({item.percentage}%)</span>
                  </div>
                </div>
                <div className="progress-track">
                  <div className="progress-fill" style={{ width: `${item.percentage}%`, background: item.color }} />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* SVG Donut Visualizer */}
      <div className="neo-card" style={{ padding: '24px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '320px' }}>
        <h3 style={{
          fontSize: '1.1rem',
          fontWeight: 800,
          alignSelf: 'flex-start',
          marginBottom: '16px',
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          color: 'var(--text-main)'
        }}>
          <span className="icon-chip icon-chip-ia"><TrendingDown size={18} /></span>
          Distribución de Gastos
        </h3>

        {totalExpense === 0 ? (
          <p className="metric-hint">Registra un gasto por voz para ver el gráfico</p>
        ) : (
          <div style={{ position: 'relative', width: '200px', height: '200px', margin: 'auto' }}>
            <svg viewBox="-1 -1 2 2" style={{ transform: 'rotate(-90deg)', width: '100%', height: '100%' }}>
              {sortedCategories.map((slice, i) => {
                const startPercent = cumulativePercent;
                const slicePercent = slice.amount / totalExpense;
                cumulativePercent += slicePercent;

                const [startX, startY] = getCoordinatesForPercent(startPercent);
                const [endX, endY] = getCoordinatesForPercent(cumulativePercent);
                const largeArcFlag = slicePercent > 0.5 ? 1 : 0;

                const pathData = [
                  `M ${startX} ${startY}`,
                  `A 1 1 0 ${largeArcFlag} 1 ${endX} ${endY}`,
                  `L 0 0`,
                ].join(' ');

                return (
                  <path
                    key={i}
                    d={pathData}
                    fill={slice.color}
                    opacity="0.95"
                    style={{ transition: 'opacity 0.2s ease', cursor: 'pointer' }}
                  />
                );
              })}
              {/* Center hole for donut effect */}
              <circle cx="0" cy="0" r="0.65" fill="var(--surface)" />
            </svg>

            {/* Center label */}
            <div style={{
              position: 'absolute',
              top: '50%',
              left: '50%',
              transform: 'translate(-50%, -50%)',
              textAlign: 'center'
            }}>
              <span className="metric-hint" style={{ display: 'block' }}>Total Gastos</span>
              <span style={{ fontSize: '1.05rem', fontWeight: 800, color: 'var(--text-main)' }}>{currency} {totalExpense.toFixed(0)}</span>
            </div>
          </div>
        )}
      </div>

    </div>
  );
}
