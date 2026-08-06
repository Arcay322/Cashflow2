// Proxy servidor -> DeepSeek
// Mantiene la API key fuera del bundle del frontend.
// Configura la variable de entorno DEEPSEEK_API_KEY en el entorno de despliegue
// (Vercel: Settings -> Environment Variables; Netlify: Build settings, etc.).

// ---- Protección: límites y rate limiting -------------------------------
// El rate limit es en memoria y se resetea con cada instancia serverless.
// Para producción con varias instancias usa un store compartido
// (p. ej. Upstash Redis); este límite local ya frena abusos de un mismo IP.

const RATE_LIMIT = { windowMs: 60_000, maxRequests: 25 };
const requests = new Map(); // ip -> { count, resetAt }

const MAX_MESSAGES = 10;
const MAX_TOTAL_CONTENT = 6000; // caracteres sumados de todos los mensajes
const MAX_BODY_BYTES = 16 * 1024; // 16 KB

function getClientIp(req) {
  const fwd = req.headers['x-forwarded-for'];
  if (typeof fwd === 'string' && fwd.length > 0) return fwd.split(',')[0].trim();
  return req.headers['x-real-ip'] || req.socket?.remoteAddress || 'unknown';
}

function cleanup() {
  if (requests.size > 1000) {
    const now = Date.now();
    for (const [k, v] of requests) {
      if (v.resetAt <= now) requests.delete(k);
    }
  }
}

function consume(ip) {
  const now = Date.now();
  let entry = requests.get(ip);
  if (!entry || entry.resetAt <= now) {
    entry = { count: 0, resetAt: now + RATE_LIMIT.windowMs };
    requests.set(ip, entry);
  }
  entry.count += 1;
  return {
    limited: entry.count > RATE_LIMIT.maxRequests,
    remaining: Math.max(0, RATE_LIMIT.maxRequests - entry.count)
  };
}

function validateMessages(messages) {
  if (!Array.isArray(messages) || messages.length === 0) {
    return 'Campo "messages" debe ser un arreglo no vacío';
  }
  if (messages.length > MAX_MESSAGES) {
    return `Demasiados mensajes (máximo ${MAX_MESSAGES})`;
  }
  let total = 0;
  for (const m of messages) {
    const role = m && m.role;
    if (role !== 'system' && role !== 'user' && role !== 'assistant') {
      return 'Cada mensaje necesita un "role" válido (system, user, assistant)';
    }
    if (typeof m.content !== 'string' || m.content.length < 1) {
      return 'Cada mensaje necesita "content" de texto';
    }
    total += m.content.length;
  }
  if (total > MAX_TOTAL_CONTENT) {
    return `Texto demasiado largo (máximo ${MAX_TOTAL_CONTENT} caracteres en total)`;
  }
  return null;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const apiKey = process.env.DEEPSEEK_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'DEEPSEEK_API_KEY no configurada en el servidor' });
  }

  // Tamaño bruto del cuerpo
  const contentLength = parseInt(req.headers['content-length'] || '0', 10);
  if (contentLength > MAX_BODY_BYTES) {
    return res.status(413).json({ error: 'Request too large' });
  }

  cleanup();
  const ip = getClientIp(req);
  const { limited, remaining } = consume(ip);
  res.setHeader('X-RateLimit-Limit', String(RATE_LIMIT.maxRequests));
  res.setHeader('X-RateLimit-Remaining', String(remaining));
  if (limited) {
    res.setHeader('Retry-After', String(Math.ceil(RATE_LIMIT.windowMs / 1000)));
    return res.status(429).json({ error: 'Demasiadas peticiones. Inténtalo en un momento.' });
  }

  const { messages, temperature = 0.1, response_format } = req.body || {};

  const validationError = validateMessages(messages);
  if (validationError) {
    return res.status(400).json({ error: validationError });
  }

  if (typeof temperature !== 'number' || Number.isNaN(temperature)) {
    return res.status(400).json({ error: 'Campo "temperature" inválido' });
  }
  const temp = Math.min(2, Math.max(0, temperature));

  const body = { model: 'deepseek-chat', temperature: temp, messages };
  if (response_format !== undefined) {
    if (!response_format || response_format.type !== 'json_object') {
      return res.status(400).json({ error: 'response_format inválido' });
    }
    body.response_format = { type: 'json_object' };
  }

  try {
    const response = await fetch('https://api.deepseek.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify(body)
    });

    const data = await response.json();
    if (!response.ok) {
      return res.status(response.status).json({ error: data?.error?.message || 'DeepSeek API error' });
    }
    return res.status(200).json(data);
  } catch (err) {
    return res.status(502).json({ error: 'Error conectando con DeepSeek: ' + err.message });
  }
}
