import React, { useState } from 'react';
import { Target, AlertTriangle, CheckCircle, Edit2 } from 'lucide-react';
import { useFinance } from '../../context/FinanceContext';

export default function BudgetManager() {
  const { transactions, budgets, currency, setCategoryBudget } = useFinance();
  const [editingCategory, setEditingCategory] = useState(null);
  const [tempBudget, setTempBudget] = useState('');

  // Calculate current month's expenses per category
  const now = new Date();
  const currentMonthExpenses = transactions
    .filter(t => {
      if (t.type !== 'expense') return false;
      const d = new Date(t.date);
      return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
    })
    .reduce((acc, t) => {
      acc[t.category] = (acc[t.category] || 0) + t.amount;
      return acc;
    }, {});

  const handleEdit = (category, currentLimit) => {
    setEditingCategory(category);
    setTempBudget(currentLimit);
  };

  const handleSave = (category) => {
    setCategoryBudget(category, tempBudget);
    setEditingCategory(null);
  };

  return (
    <div className="neo-card" style={{ padding: '26px', marginBottom: '28px' }}>

      {/* Header */}
      <div className="section-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <span className="icon-chip icon-chip-ia">
            <Target size={22} />
          </span>
          <div>
            <h2 style={{ fontSize: '1.2rem', fontWeight: 800, color: 'var(--text-main)' }}>Presupuestos por Categoría</h2>
            <p className="metric-hint">
              Límites de gasto para el mes de {now.toLocaleString('es-PE', { month: 'long', year: 'numeric' })}
            </p>
          </div>
        </div>
      </div>

      {/* Categories Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(270px, 1fr))', gap: '18px' }}>
        {Object.entries(budgets).map(([category, limit]) => {
          const spent = currentMonthExpenses[category] || 0;
          const percent = limit > 0 ? Math.min(100, Math.round((spent / limit) * 100)) : 0;
          const isOver = spent > limit && limit > 0;
          const isWarning = percent >= 80 && !isOver;

          const stateColor = isOver ? 'var(--negative)' : isWarning ? 'var(--ia)' : 'var(--positive)';

          return (
            <div key={category} className="neo-card" style={{ padding: '18px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '10px', gap: '8px' }}>
                <h3 style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--text-main)', flex: 1 }}>{category}</h3>
                {isOver ? (
                  <span className="badge badge-negative" style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <AlertTriangle size={12} /> Excedido
                  </span>
                ) : (
                  <span className="badge badge-neutral" style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <CheckCircle size={12} /> En orden
                  </span>
                )}
              </div>

              {/* Amount Progress */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '8px', gap: '8px' }}>
                <span style={{ fontSize: '1.25rem', fontWeight: 800, color: stateColor }}>
                  {currency} {spent.toFixed(2)}
                </span>

                {editingCategory === category ? (
                  <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                    <input
                      type="number"
                      value={tempBudget}
                      onChange={(e) => setTempBudget(e.target.value)}
                      className="input-field"
                      style={{ width: '90px', padding: '8px 10px', minHeight: '42px', fontSize: '0.9rem' }}
                    />
                    <button
                      onClick={() => handleSave(category)}
                      className="btn-primary"
                      style={{ minHeight: '42px', minWidth: '42px', padding: '0 10px', fontSize: '0.9rem' }}
                      aria-label="Guardar presupuesto"
                    >
                      ✓
                    </button>
                  </div>
                ) : (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <span className="metric-hint">de {currency} {limit.toFixed(0)}</span>
                    <button
                      onClick={() => handleEdit(category, limit)}
                      className="btn-icon"
                      style={{ minHeight: '36px', minWidth: '36px', padding: '6px' }}
                      aria-label={`Editar presupuesto de ${category}`}
                      title="Editar presupuesto"
                    >
                      <Edit2 size={14} />
                    </button>
                  </div>
                )}
              </div>

              {/* Progress bar */}
              <div className="progress-track">
                <div
                  className="progress-fill"
                  style={{
                    width: `${percent}%`,
                    background: isOver
                      ? 'linear-gradient(90deg, var(--negative), #d64541)'
                      : isWarning
                      ? 'linear-gradient(90deg, var(--ia), #d9a407)'
                      : 'linear-gradient(90deg, var(--positive), var(--mint))'
                  }}
                />
              </div>
            </div>
          );
        })}
      </div>

    </div>
  );
}
