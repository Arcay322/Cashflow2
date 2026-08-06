/**
 * DeepSeek integration for Cashflow IA
 * Connects securely to DeepSeek API using VITE_DEEPSEEK_API_KEY environment variable.
 */

const DEFAULT_CATEGORIES = [
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

async function callDeepSeek(messages, temperature = 0.1, response_format) {
  const apiKey = import.meta.env.VITE_DEEPSEEK_API_KEY;
  const proxyUrl = import.meta.env.VITE_DEEPSEEK_PROXY_URL || '/api/deepseek';

  const body = { 
    model: 'deepseek-chat',
    messages, 
    temperature 
  };
  if (response_format) body.response_format = response_format;

  // Direct DeepSeek API call if API Key is configured in .env
  if (apiKey && apiKey !== 'sk-tu_api_key_de_deepseek') {
    const response = await fetch('https://api.deepseek.com/v1/chat/completions', {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey.trim()}`
      },
      body: JSON.stringify(body)
    });

    if (!response.ok) {
      const data = await response.json().catch(() => null);
      throw new Error(data?.error?.message || `DeepSeek API error (${response.status})`);
    }
    return response.json();
  }

  // Fallback to proxy endpoint if configured
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

/**
 * Parses spoken text using the DeepSeek API or Local NLP Fallback Engine
 */
export async function parseVoiceCommand(spokenText, userCategories = DEFAULT_CATEGORIES, userCurrency = "S/.") {
  try {
    const data = await callDeepSeek([
      {
        role: 'system',
        content: `Eres el motor de análisis de comandos de voz para la app de finanzas Cashflow IA.
Tus tareas son:
1. Identificar si el usuario quiere REGISTRAR una o más transacciones, O si está haciendo una CONSULTA/PREGUNTA sobre sus finanzas.
2. Si es REGISTRO, extraer:
   - type: "expense" (gasto) o "income" (ingreso).
   - amount: número flotante positivo.
   - currency: "${userCurrency}".
   - category: seleccionar la mejor categoría de esta lista: [${userCategories.join(', ')}].
   - description: concepto breve en español con la primera letra mayúscula.
   - date: fecha en YYYY-MM-DD (calcula fechas relativas como "ayer", "anteayer", o usa la fecha actual si no se especifica).
3. Si es CONSULTA/PREGUNTA, responder amablemente con la clave "isQuery": true y "queryResponse": "mensaje breve".

FECHA ACTUAL: ${new Date().toISOString().split('T')[0]}

Devuelve ÚNICAMENTE un objeto JSON válido con esta estructura:
{
  "isQuery": false,
  "transactions": [
    {
      "type": "expense",
      "amount": 20.0,
      "category": "Alimentación y Comida",
      "description": "Galletas",
      "date": "2026-08-05"
    }
  ],
  "message": "He registrado un gasto de S/. 20.00 en Galletas"
}`
      },
      {
        role: 'user',
        content: spokenText
      }
    ], 0.1, { type: 'json_object' });

    const content = data.choices?.[0]?.message?.content;
    if (content) {
      return JSON.parse(content);
    }
  } catch (err) {
    console.warn("DeepSeek API notice, using local NLP engine:", err);
  }

  // Fallback Engine (Local Regex NLP)
  return fallbackLocalNLP(spokenText, userCategories, userCurrency);
}

/**
 * Local regex engine for offline or fallback instant testing
 */
function fallbackLocalNLP(text, userCategories, userCurrency) {
  const lower = text.toLowerCase().trim();

  // Check if it's a question
  if (lower.startsWith('cuánto') || lower.startsWith('cuanto') || lower.includes('¿') || lower.startsWith('qué') || lower.startsWith('que')) {
    return {
      isQuery: true,
      queryResponse: `He procesado tu consulta: "${text}".`,
      transactions: []
    };
  }

  // Extract amount
  // Matches "20 soles", "20.50", "S/ 50", "50 PEN", "100"
  const amountMatch = lower.match(/(\d+(?:[.,]\d{1,2})?)\s*(?:soles|sol|pen|s\/\.?|\$|dolares|dólares)?/i) ||
                      lower.match(/(?:gasto|gaste|pague|pagué|ingreso|cobre|cobré|deposito|monto de)\s*(\d+(?:[.,]\d{1,2})?)/i);

  let amount = 0;
  if (amountMatch) {
    amount = parseFloat(amountMatch[1].replace(',', '.'));
  }

  // Determine type: Income or Expense
  let type = "expense";
  if (lower.includes("ingreso") || lower.includes("sueldo") || lower.includes("pago de") || lower.includes("me pagaron") || lower.includes("cobre") || lower.includes("cobré") || lower.includes("gané") || lower.includes("gane")) {
    type = "income";
  }

  // Detect Date
  let date = new Date().toISOString().split('T')[0];
  if (lower.includes("ayer")) {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    date = yesterday.toISOString().split('T')[0];
  } else if (lower.includes("anteayer")) {
    const d = new Date();
    d.setDate(d.getDate() - 2);
    date = d.toISOString().split('T')[0];
  }

  // Category matching
  let category = type === "income" ? "Ingreso (Sueldo/Trabajo)" : "Otros";
  if (lower.includes("galleta") || lower.includes("comida") || lower.includes("almuerzo") || lower.includes("cena") || lower.includes("desayuno") || lower.includes("pan") || lower.includes("snack") || lower.includes("restaurante")) {
    category = "Alimentación y Comida";
  } else if (lower.includes("taxi") || lower.includes("bus") || lower.includes("gasolina") || lower.includes("pasaje") || lower.includes("combustible") || lower.includes("uber")) {
    category = "Transporte y Gasolina";
  } else if (lower.includes("luz") || lower.includes("agua") || lower.includes("internet") || lower.includes("servicio") || lower.includes("cable") || lower.includes("telefono") || lower.includes("teléfono")) {
    category = "Servicios (Luz, Agua, Internet)";
  } else if (lower.includes("cine") || lower.includes("juego") || lower.includes("fiesta") || lower.includes("cerveza") || lower.includes("regalo") || lower.includes("netflix") || lower.includes("spotify")) {
    category = "Entretenimiento y Ocio";
  } else if (lower.includes("medicina") || lower.includes("farmacia") || lower.includes("doctor") || lower.includes("salud") || lower.includes("pastilla")) {
    category = "Salud y Medicinas";
  } else if (lower.includes("curso") || lower.includes("libro") || lower.includes("pension") || lower.includes("pensión") || lower.includes("universidad")) {
    category = "Educación y Cursos";
  } else if (lower.includes("casa") || lower.includes("alquiler") || lower.includes("compras") || lower.includes("supermercado") || lower.includes("mercado")) {
    category = "Hogar y Compras";
  }

  // Clean description
  let description = text.replace(/regístrame|registrame|gasto de|gaste|gasté|un gasto|pagué|pague|en|por|un|de|\d+(?:[.,]\d{1,2})?|soles|sol|pen|s\/\.?/gi, '').trim();
  if (!description || description.length < 2) {
    description = category.split(' ')[0];
  }
  description = description.charAt(0).toUpperCase() + description.slice(1);

  return {
    isQuery: false,
    transactions: [
      {
        type,
        amount: amount || 10,
        category,
        description,
        date
      }
    ],
    message: `He registrado un ${type === 'income' ? 'ingreso' : 'gasto'} de ${userCurrency} ${(amount || 10).toFixed(2)} en "${description}" (${category}).`
  };
}

/**
 * Ask the financial assistant a custom question about the user's financial status
 */
export async function askFinancialAdvisor(question, transactions, summary) {
  try {
    const data = await callDeepSeek([
      {
        role: 'system',
        content: `Eres Cashflow AI, un asesor financiero personal inteligente, amigable, claro y empático.
Analiza la información del usuario y responde su consulta de forma concisa (máximo 3 párrafos cortos).

RESUMEN ACTUAL DEL USUARIO:
- Total Ingresos: S/. ${summary.totalIncome.toFixed(2)}
- Total Gastos: S/. ${summary.totalExpense.toFixed(2)}
- Balance Neto: S/. ${summary.netBalance.toFixed(2)}
- Número de registros: ${transactions.length}

ÚLTIMAS TRANSACCIONES:
${JSON.stringify(transactions.slice(0, 10), null, 2)}`
      },
      {
        role: 'user',
        content: question
      }
    ], 0.7);

    return data.choices?.[0]?.message?.content || "No se pudo obtener respuesta del asesor financiero.";
  } catch (err) {
    console.warn("DeepSeek API notice:", err);
    return "El asistente de IA no está disponible en este momento. Inténtalo de nuevo más tarde.";
  }
}
