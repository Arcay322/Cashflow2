/**
 * Cashflow IA - Motor de IA (DeepSeek + fallback local)
 *
 * El LLM "entiende" (clasifica intención y extrae entidades) y devuelve un JSON
 * estricto. La ejecución de acciones y los cálculos de consultas se hacen en el
 * cliente (deterministas, sin coste).
 */

export const DEFAULT_CATEGORIES = [
  "Alimentación y Comida",
  "Transporte y Gasolina",
  "Servicios (Luz, Agua, Internet)",
  "Entretenimiento y Ocio",
  "Salud y Medicinas",
  "Educación y Cursos",
  "Hogar y Compras",
  "Ingreso (Sueldo/Trabajo)",
  "Otros"
];

export const CURRENCIES = ['S/.', '$', '€'];

function formatMoney(n, currency) {
  const value = Number(n || 0);
  return `${currency} ${value.toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

// ---------------------------------------------------------------- DeepSeek
async function callDeepSeek(messages, temperature = 0.1, response_format) {
  const apiKey = import.meta.env.VITE_DEEPSEEK_API_KEY;
  const proxyUrl = import.meta.env.VITE_DEEPSEEK_PROXY_URL || '/api/deepseek';

  const body = { model: 'deepseek-chat', messages, temperature };
  if (response_format) body.response_format = response_format;

  if (apiKey && apiKey !== 'sk-tu_api_key_de_deepseek') {
    const response = await fetch('https://api.deepseek.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey.trim()}` },
      body: JSON.stringify(body)
    });
    if (!response.ok) {
      const data = await response.json().catch(() => null);
      throw new Error(data?.error?.message || `DeepSeek API error (${response.status})`);
    }
    return response.json();
  }

  const response = await fetch(proxyUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
  if (!response.ok) {
    const data = await response.json().catch(() => null);
    throw new Error(data?.error || `Proxy error (${response.status})`);
  }
  return response.json();
}

function SYSTEM_PROMPT(categories, currency) {
  return `
Eres el motor de comandos de la app de finanzas "Cashflow IA". Clasifica la intención
del mensaje del usuario (en español) y llena los campos correspondientes.
Devuelve ÚNICAMENTE un objeto JSON válido, sin texto extra.

INTENCIONES (campo "intent"):
- "register": registrar una o más transacciones (gastos/ingresos).
- "query": pregunta por cifras con filtro (cuánto gasté/gané este mes/semana/hoy, por categoría, comparativas).
- "action": ejecutar una acción (borrar/editar, ajustar presupuesto, cambiar moneda, exportar CSV).
- "advice": pide consejo/asesoría financiera abierta (cómo ahorrar, recomendación, qué hacer).
- "unknown": no se entiende o conversación casual.

Según el intent llena el campo correspondiente:

1. register -> "transactions": array de { "type":"expense"|"income", "amount":number,
   "category":"nombre exacto de la lista", "description":"texto corto, mayúscula inicial",
   "date":"YYYY-MM-DD" (fecha relativa: hoy/ayer/anteayer, default hoy),
   "recurring":bool (true si dice "cada mes", "mensual", "cada semana") }. Si menciona varias transacciones, devuelve varias.

2. query -> "query": { "kind":"expense"|"income"|"balance"|"comparison"|"category",
   "category":string|null, "period":"today"|"week"|"month"|"prev_month"|"prev_week"|"all",
   "type":"expense"|"income"|null }.
   - "comparison" para comparativas con el periodo anterior.
   - Si pregunta "cuanto gaste en transporte": kind "category", category nombre exacto, period "month".
   - Si pregunta saldo/balance: kind "balance", period "month".
   - Si pregunta cuánto me depositaron: kind "income".

3. action -> "action": { "type":"delete"|"update"|"budget"|"currency"|"export",
   "target":{ "type"?, "category"?, "description"?, "scope":"last"|"all" },
   "amount":number (solo para "update": el nuevo monto),
   "budget": { "category":"...", "amount":number },
   "currency":"S/."|"$"|"€" }.

4. advice -> "advice":true.

CONTEXTO PREVIO: recibe los últimos mensajes de la conversación. Úsalos para entender referencias:
- Si el usuario corrige algo dicho antes ("no era 30, era 40", "me equivoqué", "era 20 no 10"), devuelve intent "action" con type "update", target {scope:"last"} y amount con el nuevo monto.
- Si continúa agregando gastos ("y 10 en refrescos", "además 5 en pan"), devuelve intent "register" SOLO con la nueva transacción, sin repetir las anteriores.
- Si responde "sí"/"no" a tu confirmación, devuelve intent "unknown" (el botón se encarga), o repite la acción con needsConfirmation false.

OTROS CAMPOS:
- "needsConfirmation": true si NO estás seguro del monto/categoría/destino, o la acción es destructiva (delete/update).
- "message": mensaje breve en español para mostrar al usuario.

CATEGORÍAS: [${categories.join(', ')}]
MONEDA: ${currency}
FECHA ACTUAL: ${new Date().toISOString().split('T')[0]}

PRECAUCIÓN: NUNCA inventes montos ni categorías inexistentes. Si un dato falta, deja campos vacíos/null y pon "needsConfirmation":true.
`;
}

/**
 * Analiza un comando de voz/texto y devuelve el plan estructurado.
 */
export async function analyzeCommand(text, ctx = {}) {
  const categories = ctx.categories || DEFAULT_CATEGORIES;
  const currency = ctx.currency || 'S/.';
  const memory = Array.isArray(ctx.memory) ? ctx.memory.slice(-4) : [];
  try {
    const data = await callDeepSeek([
      { role: 'system', content: SYSTEM_PROMPT(categories, currency) },
      ...memory.map(m => ({ role: m.role === 'assistant' ? 'assistant' : 'user', content: String(m.content || '').slice(0, 300) })),
      { role: 'user', content: text }
    ], 0.1, { type: 'json_object' });
    const content = data.choices?.[0]?.message?.content;
    if (content) {
      return normalizeAnalysis(JSON.parse(content), categories);
    }
  } catch (err) {
    console.warn('DeepSeek analyze notice, usando motor local:', err);
  }
  return fallbackAnalyze(text, categories, currency);
}

const INTENTS = ['register', 'query', 'action', 'advice', 'unknown'];
const KINDS = ['expense', 'income', 'balance', 'comparison', 'category'];
const PERIODS = ['today', 'week', 'month', 'prev_month', 'prev_week', 'all'];
const ACTION_TYPES = ['delete', 'update', 'budget', 'currency', 'export'];

function normalizeAnalysis(raw, categories) {
  const a = { ...raw };
  a.intent = INTENTS.includes(a.intent) ? a.intent : 'unknown';
  a.needsConfirmation = !!a.needsConfirmation;

  if (a.intent === 'register') {
    a.transactions = Array.isArray(a.transactions)
      ? a.transactions
          .map(t => ({
            type: t.type === 'income' ? 'income' : 'expense',
            amount: typeof t.amount === 'number' && t.amount > 0 ? t.amount : null,
            category: categories.includes(t.category) ? t.category : (t.category || 'Otros'),
            description: (t.description || '').trim() || 'Gasto registrado',
            date: /^\d{4}-\d{2}-\d{2}$/.test(t.date || '') ? t.date : new Date().toISOString().split('T')[0],
            recurring: !!t.recurring
          }))
          .filter(t => t.amount != null)
      : [];
    if (a.transactions.length === 0) a.needsConfirmation = true;
  } else if (a.intent === 'query') {
    const q = a.query || {};
    a.query = {
      kind: KINDS.includes(q.kind) ? q.kind : 'expense',
      category: q.category || null,
      period: PERIODS.includes(q.period) ? q.period : 'month',
      type: (q.type === 'income' || q.type === 'expense') ? q.type : null
    };
  } else if (a.intent === 'action') {
    const ac = a.action || {};
    const type = ACTION_TYPES.includes(ac.type) ? ac.type : 'unknown';
    a.action = {
      type,
      target: ac.target || {},
      amount: typeof ac.amount === 'number' && ac.amount > 0 ? ac.amount : null,
      budget: (ac.budget && ac.budget.category && typeof ac.budget.amount === 'number') ? { category: ac.budget.category, amount: ac.budget.amount } : null,
      currency: ac.currency && CURRENCIES.includes(ac.currency) ? ac.currency : null
    };
    if (type !== 'unknown') a.needsConfirmation = true;
  }
  return a;
}

// ---------------------------------------------------------------- Fallback local (A4)
function categoryFromLower(lower) {
  const map = [
    [/(gallet|comida|almuerzo|cena|desayuno|pan|snack|restaurante|mercado|supermercado)/, 'Alimentación y Comida'],
    [/(taxi|bus|gasolina|pasaje|combustible|uber|transporte|moto)/, 'Transporte y Gasolina'],
    [/(luz|agua|internet|servicio|cable|tel(e)?fono|recibos|gas)/, 'Servicios (Luz, Agua, Internet)'],
    [/(cine|juego|fiesta|cerveza|regalo|netflix|spotify|entret|ocio)/, 'Entretenimiento y Ocio'],
    [/(medic|farmaci|doctor|salud|pastilla)/, 'Salud y Medicinas'],
    [/(curso|libro|pensi(o)n|universida|colegio)/, 'Educación y Cursos'],
    [/(casa|alquiler|compras|limpieza|hoga)/, 'Hogar y Compras'],
    [/(sueldo|salario|trabajo|ingreso)/, 'Ingreso (Sueldo/Trabajo)']
  ];
  for (const [re, name] of map) if (re.test(lower)) return name;
  return null;
}

const todayISO = () => new Date().toISOString().split('T')[0];

function simpleQuery(text) {
  const lower = text.toLowerCase();
  const q = { kind: 'expense', category: null, period: 'month', type: null };
  if (/(balance|saldo|ahorro)/.test(lower)) { q.kind = 'balance'; q.type = null; }
  else if (/(ingreso|sueldo|gan|deposito|recibi)/.test(lower)) q.type = 'income';

  if (/(ayer|hoy)/.test(lower)) q.period = 'today';
  else if (/(mes pasad|anterior)/.test(lower)) q.period = 'prev_month';
  else if (/(semana)/.test(lower)) q.period = 'week';
  else if (/(pasado)/.test(lower)) q.period = 'prev_month';

  const cat = categoryFromLower(lower);
  if (cat) { q.kind = cat === 'Ingreso (Sueldo/Trabajo)' ? 'income' : 'category'; q.category = cat; if (q.kind === 'income') q.type = 'income'; }
  return q;
}

export function fallbackAnalyze(text, _categories, currency) {
  const lower = text.toLowerCase().trim();

  if (/(borra|borrar|elimina|eliminar|quita|quitar)/.test(lower)) {
    const target = { scope: /(ultimo|último|anterior|reciente|última|anterior)/.test(lower) ? 'last' : 'all' };
    if (/(gasto|gaste|compra)/.test(lower)) target.type = 'expense';
    if (/(ingreso|cobre|deposito)/.test(lower)) target.type = 'income';
    return { intent: 'action', action: { type: 'delete', target }, needsConfirmation: true, message: '' };
  }

  if (/(cambia|cambiar).*(soles|sol|dolares|dólares|euros|usd|eur)/.test(lower)) {
    let currency = 'S/.';
    if (/(dolares|dólares|usd|\$)/.test(lower)) currency = '$';
    if (/(euros|euro|eur|€)/.test(lower)) currency = '€';
    return { intent: 'action', action: { type: 'currency', currency }, needsConfirmation: false, message: '' };
  }

  const allNumbers = lower.match(/\d+(?:[.,]\d{1,2})?/g);
  const lastNumber = allNumbers ? allNumbers[allNumbers.length - 1] : null;
  if (/(no era|me equivoqu[eé]|era |corrige|corregir|corrijo)/.test(lower) && lastNumber && !/(presupuesto|moneda|borra|elimina)/.test(lower)) {
    return { intent: 'action', action: { type: 'update', target: { scope: 'last' }, amount: parseFloat(lastNumber.replace(',', '.')) }, needsConfirmation: false, message: '' };
  }

  const budgetMatch = lower.match(/(\d+(?:[.,]\d{1,2})?)/);
  if (/(presupuesto|ponle|pon)\b/.test(lower) && budgetMatch) {
    const category = categoryFromLower(lower) || 'Otros';
    return { intent: 'action', action: { type: 'budget', budget: { category, amount: parseFloat(budgetMatch[1].replace(',', '.')) } }, needsConfirmation: false, message: '' };
  }

  if (/(c(u|ü)anto|que|como|balance|saldo|ahorro|gaste|gast[eé]|presup)|(presupuesto)\b/.test(lower)) {
    return { intent: 'query', query: simpleQuery(lower), needsConfirmation: false, message: '' };
  }

  const amountMatch = lower.match(/(\d+(?:[.,]\d{1,2})?)\s*(?:soles|sol|s\/\.?|\$|dolares|dólares|euros)?/i) ||
                      lower.match(/(?:gasto|gaste|pague|pagué|ingreso|cobre|deposito|gane|cobr)\s*(\d+(?:[.,]\d{1,2})?)/i);
  if (amountMatch) {
    const amount = parseFloat(amountMatch[1].replace(',', '.'));
    const type = /(ingreso|sueldo|gane|gana?|deposito)/.test(lower) ? 'income' : 'expense';

    let date = todayISO();
    if (lower.includes('ayer')) { const d = new Date(); d.setDate(d.getDate() - 1); date = d.toISOString().split('T')[0]; }
    else if (lower.includes('anteayer')) { const d = new Date(); d.setDate(d.getDate() - 2); date = d.toISOString().split('T')[0]; }

    const cat = type === 'income' ? 'Ingreso (Sueldo/Trabajo)' : (categoryFromLower(lower) || 'Otros');
    const recurring = /(cada mes|por mes|mensual|cada semana|semanal|recurrente)/.test(lower);

    let description = text.replace(/reg[íi]strame|reg[íi]st[ao]|gasto de|gaste|gasté|pagué|pag[aá]?|un gasto|ingreso de|ingres[eo]|cada mes|mensual|recurrente|del|me depositaron|depositar[on]?|cobre|cobr[aé]?|gane|gan[aé]?|recib[ií]|\d+(?:[.,]\d{1,2})?|soles|sol\b|s\/\.?|dolares|dólares|euros/gi, '').trim();
    description = description.replace(/^(?:(?:ayer|hoy|anteayer|me|de|en|por|el|la|un|una)\s+)+/gi, '').trim();
    if (!description || description.length < 2) description = cat.split(' ')[0];
    description = description.charAt(0).toUpperCase() + description.slice(1);

    return {
      intent: 'register',
      transactions: [{ type, amount: amount || 10, category: cat, description, date, recurring }],
      needsConfirmation: false,
      message: `He registrado un ${type === 'income' ? 'ingreso' : 'gasto'} de ${formatMoney(amount || 10, currency)} en "${cat}"${recurring ? ' (mensual)' : ''}.`
    };
  }

  return { intent: 'advice', needsConfirmation: false, message: '' };
}

// ---------------------------------------------------------------- Consultas locales (C1-C3)
function periodRange(period, now = new Date()) {
  const iso = d => d.toISOString().split('T')[0];
  const today = iso(now);
  switch (period) {
    case 'today': return { from: today, to: today };
    case 'prev_month':
      return { from: iso(new Date(now.getFullYear(), now.getMonth() - 1, 1)), to: iso(new Date(now.getFullYear(), now.getMonth(), 0)) };
    case 'week':
      return { from: iso(new Date(now.getTime() - 7 * 86400000)), to: today };
    case 'prev_week':
      return { from: iso(new Date(now.getTime() - 14 * 86400000)), to: iso(new Date(now.getTime() - 7 * 86400000)) };
    case 'all': return { from: '0000-01-01', to: today };
    default:
      return { from: iso(new Date(now.getFullYear(), now.getMonth(), 1)), to: today };
  }
}

function prevRange(range) {
  const f = new Date(range.from + 'T00:00:00');
  const t = new Date(range.to + 'T00:00:00');
  const dur = (t - f) + 86400000;
  return {
    from: new Date(f.getTime() - dur).toISOString().split('T')[0],
    to: new Date(f.getTime() - 86400000).toISOString().split('T')[0]
  };
}

export function resolveQuery(query, transactions, currency = 'S/.') {
  const range = periodRange(query.period);
  const inRange = transactions.filter(t => t.date && t.date >= range.from && t.date <= range.to);
  const income = inRange.filter(t => t.type === 'income');
  const expense = inRange.filter(t => t.type === 'expense');
  const sum = arr => arr.reduce((s, t) => s + (t.amount || 0), 0);
  const fmt = n => formatMoney(n, currency);

  const label = { today: 'hoy', week: 'esta semana', month: 'este mes', prev_month: 'el mes anterior', prev_week: 'la semana anterior', all: 'en total' }[query.period] || '';

  if (query.kind === 'balance') {
    return `Balance ${label}: ingresos ${fmt(sum(income))}, gastos ${fmt(sum(expense))}, saldo ${fmt(sum(income) - sum(expense))}.`;
  }
  if (query.kind === 'income') {
    return `Ingresos ${label}: ${fmt(sum(income))}.`;
  }
  if (query.kind === 'comparison') {
    const prev = prevRange(range);
    const before = sum(transactions.filter(t => t.type === 'expense' && t.date && t.date >= prev.from && t.date <= prev.to));
    const cur = sum(expense);
    const pct = before > 0 ? Math.round(((cur - before) / before) * 100) : null;
    const ctx = pct === null ? 'sin comparación anterior' : (pct >= 0 ? `un ${pct}% más que el periodo anterior` : `un ${Math.abs(pct)}% menos que el periodo anterior`);
    return `Gastos ${label}: ${fmt(cur)} (${ctx}).`;
  }
  const total = query.type === 'income' ? sum(income) : sum(expense);
  if (query.kind === 'category' && query.category) {
    return `${query.category} ${label}: ${fmt(sum(expense.filter(t => t.category === query.category)))}.`;
  }
  const byCat = {};
  expense.forEach(t => { byCat[t.category] = (byCat[t.category] || 0) + (t.amount || 0); });
  const top = Object.entries(byCat).sort((a, b) => b[1] - a[1])[0];
  const line = top ? ` El mayor es ${top[0]} con ${fmt(top[1])}.` : '';
  return `Gasto ${label}: ${fmt(total)}.${line}`;
}

// ---------------------------------------------------------------- Asesor financiero
export async function askFinancialAdvisor(question, transactions, summary) {
  try {
    const data = await callDeepSeek([
      {
        role: 'system',
        content: `Eres el asesor financiero de "Cashflow IA". Responde en español, conciso (máximo 3 párrafos cortos).
RESUMEN ACTUAL:
- Total Ingresos: S/. ${summary.totalIncome.toFixed(2)}
- Total Gastos: S/. ${summary.totalExpense.toFixed(2)}
- Balance: S/. ${summary.netBalance.toFixed(2)}
- Registros: ${transactions.length}
ÚLTIMAS TRANSACCIONES:
${JSON.stringify(transactions.slice(0, 10), null, 2)}`
      },
      { role: 'user', content: question }
    ], 0.7);
    return data.choices?.[0]?.message?.content || 'No hay respuesta del asesor.';
  } catch (err) {
    console.warn('DeepSeek notice:', err);
    return 'El asesor IA no está disponible ahora. Inténtalo más tarde.';
  }
}