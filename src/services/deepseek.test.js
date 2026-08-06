import { describe, expect, it, vi, afterEach } from 'vitest';
import { analyzeCommand, fallbackAnalyze, resolveQuery, DEFAULT_CATEGORIES } from './deepseek';

const iso = (d) => d.toISOString().split('T')[0];
const daysAgo = (n) => iso(new Date(Date.now() - n * 86400000));
const firstOfMonth = () => iso(new Date(new Date().getFullYear(), new Date().getMonth(), 1));
const prevMonthLast = () => iso(new Date(new Date().getFullYear(), new Date().getMonth(), 0));

describe('fallbackAnalyze - registro', () => {
  it('registra un gasto con categoría detectada', () => {
    const r = fallbackAnalyze('regístrame 20 soles en galletas', DEFAULT_CATEGORIES, 'S/.');
    expect(r.intent).toBe('register');
    expect(r.transactions[0]).toMatchObject({ type: 'expense', amount: 20, category: 'Alimentación y Comida' });
  });

  it('registra un ingreso', () => {
    const r = fallbackAnalyze('me depositaron 1500 de sueldo', DEFAULT_CATEGORIES, 'S/.');
    expect(r.transactions[0].type).toBe('income');
    expect(r.transactions[0].amount).toBe(1500);
    expect(r.transactions[0].category).toBe('Ingreso (Sueldo/Trabajo)');
  });

  it('detecta fecha relativa "ayer"', () => {
    const r = fallbackAnalyze('ayer pagué 45.50 de luz', DEFAULT_CATEGORIES, 'S/.');
    expect(r.transactions[0].date).toBe(daysAgo(1));
  });

  it('detecta recurrente', () => {
    const r = fallbackAnalyze('cada mes 20 soles en netflix', DEFAULT_CATEGORIES, 'S/.');
    expect(r.transactions[0].recurring).toBe(true);
  });
});

describe('fallbackAnalyze - consultas', () => {
  it('consulta por categoría y mes', () => {
    const r = fallbackAnalyze('cuánto gasté en transporte este mes', DEFAULT_CATEGORIES, 'S/.');
    expect(r.intent).toBe('query');
    expect(r.query).toMatchObject({ kind: 'category', category: 'Transporte y Gasolina', period: 'month' });
  });

  it('consulta el balance', () => {
    const r = fallbackAnalyze('balance de este mes', DEFAULT_CATEGORIES, 'S/.');
    expect(r.query.kind).toBe('balance');
  });
});

describe('fallbackAnalyze - acciones', () => {
  it('borra el último gasto con confirmación', () => {
    const r = fallbackAnalyze('borra el último gasto', DEFAULT_CATEGORIES, 'S/.');
    expect(r.intent).toBe('action');
    expect(r.action).toMatchObject({ type: 'delete', target: { scope: 'last', type: 'expense' } });
    expect(r.needsConfirmation).toBe(true);
  });

  it('cambia la moneda a dólares', () => {
    const r = fallbackAnalyze('cambia la moneda a dólares', DEFAULT_CATEGORIES, 'S/.');
    expect(r.action).toMatchObject({ type: 'currency', currency: '$' });
  });

  it('ajusta presupuesto de una categoría', () => {
    const r = fallbackAnalyze('ponle 400 a transporte', DEFAULT_CATEGORIES, 'S/.');
    expect(r.action).toMatchObject({ type: 'budget', budget: { category: 'Transporte y Gasolina', amount: 400 } });
  });

  it('corrige usando el último número (E2)', () => {
    const r = fallbackAnalyze('no era 30, era 40', DEFAULT_CATEGORIES, 'S/.');
    expect(r.action).toMatchObject({ type: 'update', amount: 40, target: { scope: 'last' } });
  });
});

describe('resolveQuery (C1-C3)', () => {
  const tx = [
    { type: 'income', amount: 1500, category: 'Ingreso (Sueldo/Trabajo)', date: firstOfMonth() },
    { type: 'expense', amount: 30, category: 'Transporte y Gasolina', date: daysAgo(1) },
    { type: 'expense', amount: 75.5, category: 'Servicios (Luz, Agua, Internet)', date: daysAgo(2) },
    { type: 'expense', amount: 50, category: 'Transporte y Gasolina', date: prevMonthLast() }
  ];

  it('calcula el balance del mes', () => {
    const out = resolveQuery({ kind: 'balance', period: 'month' }, tx, 'S/.');
    expect(out).toContain('ingresos S/. 1,500.00');
    expect(out).toContain('gastos S/. 105.50');
    expect(out).toContain('saldo S/. 1,394.50');
  });

  it('filtra por categoría', () => {
    const out = resolveQuery({ kind: 'category', category: 'Transporte y Gasolina', period: 'month' }, tx, 'S/.');
    expect(out).toBe('Transporte y Gasolina este mes: S/. 30.00.');
  });

  it('compara con el mes anterior', () => {
    const out = resolveQuery({ kind: 'comparison', period: 'month' }, tx, 'S/.');
    expect(out).toContain('un 111% más que el periodo anterior');
  });

  it('resume el gasto del mes', () => {
    const out = resolveQuery({ kind: 'expense', period: 'month' }, tx, 'S/.');
    expect(out).toContain('Gasto este mes: S/. 105.50');
  });
});

describe('analyzeCommand - fallback offline', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('cae al motor local si DeepSeek no responde', async () => {
    vi.stubGlobal('fetch', vi.fn(() => Promise.reject(new Error('offline'))));
    const r = await analyzeCommand('regístrame 20 soles en galletas', { categories: DEFAULT_CATEGORIES, currency: 'S/.' });
    expect(r.intent).toBe('register');
    expect(r.transactions[0].amount).toBe(20);
  });
});
