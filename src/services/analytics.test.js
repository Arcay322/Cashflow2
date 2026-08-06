import { describe, expect, it } from 'vitest';
import {
  formatMoney,
  projectMonthEnd,
  budgetAlerts,
  categoryTrends,
  detectAnomalies,
  savingsRecommendations,
  generateSummary
} from './analytics';

const NOW = new Date(2026, 7, 6);

describe('formatMoney', () => {
  it('formatea con moneda y locale es-PE', () => {
    expect(formatMoney(1500, 'S/.')).toBe('S/. 1,500.00');
    expect(formatMoney(20.5)).toBe('S/. 20.50');
  });
});

describe('projectMonthEnd (D1)', () => {
  it('proyecta gasto e ingreso según el promedio diario', () => {
    const tx = [
      { type: 'expense', amount: 30, category: 'A', date: '2026-08-03' },
      { type: 'expense', amount: 45, category: 'B', date: '2026-08-05' },
      { type: 'income', amount: 1500, category: 'Ingreso (Sueldo/Trabajo)', date: '2026-08-01' }
    ];
    const p = projectMonthEnd(tx, NOW);
    expect(p.daysLeft).toBe(25);
    expect(p.spent).toBe(75);
    expect(p.earned).toBe(1500);
    expect(p.projectedExpense).toBeCloseTo(75 / 6 * 31);
    expect(p.projectedBalance).toBeCloseTo(1500 / 6 * 31 - 75 / 6 * 31);
  });
});

describe('budgetAlerts (D2)', () => {
  it('marca warning si al ritmo actual superará el presupuesto', () => {
    const tx = [
      { type: 'expense', amount: 500, category: 'Alimentación y Comida', date: '2026-08-03' },
      { type: 'expense', amount: 30, category: 'Transporte y Gasolina', date: '2026-08-04' }
    ];
    const budgets = { 'Alimentación y Comida': 800, 'Transporte y Gasolina': 300 };
    const alerts = budgetAlerts(tx, budgets, NOW);
    const alimentacion = alerts.find(a => a.category === 'Alimentación y Comida');
    const transporte = alerts.find(a => a.category === 'Transporte y Gasolina');
    expect(alimentacion.status).toBe('warning');
    expect(transporte.status).toBe('ok');
  });

  it('marca over si ya superó el presupuesto', () => {
    const tx = [{ type: 'expense', amount: 900, category: 'Alimentación y Comida', date: '2026-08-02' }];
    const alert = budgetAlerts(tx, { 'Alimentación y Comida': 800 }, NOW)[0];
    expect(alert.status).toBe('over');
  });
});

describe('categoryTrends (D1)', () => {
  it('compara gasto del mes con el mes anterior', () => {
    const tx = [
      { type: 'expense', amount: 100, category: 'A', date: '2026-08-03' },
      { type: 'expense', amount: 50, category: 'A', date: '2026-07-03' }
    ];
    const trends = categoryTrends(tx, NOW);
    const a = trends.find(t => t.category === 'A');
    expect(a.current).toBe(100);
    expect(a.previous).toBe(50);
    expect(a.delta).toBe(100);
  });
});

describe('detectAnomalies (D3)', () => {
  it('detecta duplicados en fechas cercanas', () => {
    const tx = [
      { type: 'expense', amount: 20, category: 'A', date: '2026-08-03' },
      { type: 'expense', amount: 20, category: 'A', date: '2026-08-04' }
    ];
    const anomalies = detectAnomalies(tx, NOW);
    expect(anomalies.some(a => a.type === 'duplicate')).toBe(true);
  });

  it('detecta saltos inusuales por categoría', () => {
    const tx = [
      { type: 'expense', amount: 10, category: 'B', date: '2026-06-05' },
      { type: 'expense', amount: 12, category: 'B', date: '2026-07-05' },
      { type: 'expense', amount: 400, category: 'B', date: '2026-08-02' }
    ];
    const anomalies = detectAnomalies(tx, NOW);
    expect(anomalies.some(a => a.type === 'spike')).toBe(true);
  });

  it('detecta recurrente omitido', () => {
    const tx = [
      { id: 'r1', type: 'expense', amount: 50, category: 'C', date: '2026-07-02', recurring: true }
    ];
    const anomalies = detectAnomalies(tx, NOW);
    expect(anomalies.some(a => a.type === 'missed_recurring')).toBe(true);
  });

  it('no marca omitido si la ocurrencia del mes ya existe', () => {
    const tx = [
      { id: 'r1', type: 'expense', amount: 50, category: 'C', date: '2026-07-02', recurring: true },
      { type: 'expense', amount: 50, category: 'C', date: '2026-08-02', source: 'r1' }
    ];
    const anomalies = detectAnomalies(tx, NOW);
    expect(anomalies.some(a => a.type === 'missed_recurring')).toBe(false);
  });
});

describe('savingsRecommendations (D4)', () => {
  it('recomienda recortar la categoría dominante', () => {
    const tx = [
      { type: 'expense', amount: 800, category: 'Alimentación y Comida', date: '2026-08-04' }
    ];
    const recs = savingsRecommendations(tx, {}, NOW);
    expect(recs[0].type).toBe('dominant');
    expect(recs[0].savings).toBeCloseTo(120);
  });

  it('sugiere revisar suscripciones recurrentes grandes', () => {
    const tx = [{ id: 'r1', type: 'expense', amount: 60, category: 'Entretenimiento y Ocio', date: '2026-07-10', recurring: true }];
    const recs = savingsRecommendations(tx, {}, NOW);
    expect(recs.some(r => r.type === 'recurring')).toBe(true);
  });
});

describe('generateSummary (D5)', () => {
  it('genera resumen diario en español', () => {
    const tx = [
      { type: 'income', amount: 1500, category: 'Ingreso (Sueldo/Trabajo)', date: '2026-08-06' },
      { type: 'expense', amount: 20, category: 'Alimentación y Comida', date: '2026-08-06' }
    ];
    const summary = generateSummary(tx, 'day', 'S/.', NOW);
    expect(summary).toContain('Balance: S/. 1,480.00');
    expect(summary).toContain('Mayor gasto en "Alimentación y Comida"');
  });
});
