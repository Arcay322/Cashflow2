/**
 * Cashflow IA - Normalización de texto para voz (TTS).
 * Convierte montos a orden natural ("100 soles"), elimina markdown y emojis
 * para que el sintetizador de voz lea de forma clara.
 */
export function speakify(text) {
  return String(text || '')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/__(.+?)__/g, '$1')
    .replace(/[`*_#]/g, ' ')
    .replace(/(S\s*\/\s*\.?)\s*([\d.,]*\d)/gi, '$2 soles')
    .replace(/(S\s*\/\s*\.?)/gi, 'soles')
    .replace(/(€)\s*([\d.,]*\d)/g, '$2 euros')
    .replace(/\s*€/g, ' euros')
    .replace(/(\$)\s*([\d.,]*\d)/g, '$2 dólares')
    .replace(/\s*\$/g, ' dólares')
    .replace(/(\d),(?=\d{3}\b)/g, '$1')
    .replace(/\.\d{2}\b/g, '')
    .replace(/[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{2190}-\u{21FF}\u{2B00}-\u{2BFF}\u{2702}-\u{27B0}]/gu, '')
    .replace(/\s{2,}/g, ' ')
    .trim();
}
