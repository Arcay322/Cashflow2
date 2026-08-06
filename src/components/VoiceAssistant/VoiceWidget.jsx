import React, { useState, useEffect, useRef } from 'react';
import {
  Mic,
  MicOff,
  Send,
  Sparkles,
  Bot,
  Volume2,
  CheckCircle2,
  AlertCircle,
  MessageSquareText,
  Loader2,
  ShieldAlert
} from 'lucide-react';
import { useFinance } from '../../context/FinanceContext';
import { analyzeCommand, resolveQuery, askFinancialAdvisor, DEFAULT_CATEGORIES } from '../../services/deepseek';
import { generateSummary } from '../../services/analytics';

export default function VoiceWidget() {
  const {
    addMultipleTransactions,
    deleteTransaction,
    updateTransaction,
    setCategoryBudget,
    updateCurrency,
    exportToCSV,
    currency,
    transactions,
    summary
  } = useFinance();
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [assistantMessage, setAssistantMessage] = useState(null);
  const [speechSupported, setSpeechSupported] = useState(true);
  const [pendingAnalysis, setPendingAnalysis] = useState(null);
  const [pendingText, setPendingText] = useState('');
  const [listeningForConfirm, setListeningForConfirm] = useState(false);
  const [conversationMemory, setConversationMemory] = useState([]);
  const recognitionRef = useRef(null);
  const confirmationRecognitionRef = useRef(null);

  useEffect(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (SpeechRecognition) {
      const recognition = new SpeechRecognition();
      recognition.continuous = false;
      recognition.interimResults = true;
      recognition.lang = 'es-ES';

      recognition.onresult = (event) => {
        let currentTranscript = '';
        for (let i = event.resultIndex; i < event.results.length; i++) {
          currentTranscript += event.results[i][0].transcript;
        }
        setTranscript(currentTranscript);
      };

      recognition.onerror = (event) => {
        console.error("Speech recognition error:", event.error);
        setIsListening(false);
      };

      recognition.onend = () => {
        setIsListening(false);
      };

      recognitionRef.current = recognition;
    } else {
      setSpeechSupported(false);
    }
  }, []);

  useEffect(() => {
    return () => {
      try { confirmationRecognitionRef.current?.stop(); } catch { /* noop */ }
    };
  }, []);

  const toggleListening = () => {
    if (!speechSupported) {
      alert("Tu navegador no soporta reconocimiento de voz nativo. Puedes escribir la frase en el campo de texto.");
      return;
    }

    if (isListening) {
      recognitionRef.current?.stop();
      setIsListening(false);
    } else {
      setTranscript('');
      setAssistantMessage(null);
      try {
        recognitionRef.current?.start();
        setIsListening(true);
      } catch (err) {
        console.error("Failed to start speech recognition:", err);
      }
    }
  };

  const showMessage = (type, text) => {
    setAssistantMessage({ type, text });
    setConversationMemory(prev => [...prev, { role: 'assistant', content: text }].slice(-6));
    speakText(text);
  };

  const speakText = (text) => {
    if ('speechSynthesis' in window) {
      const clean = String(text)
        .replace(/S\/\./g, 'soles')
        .replace(/\$/g, ' dólares ')
        .replace(/€/g, ' euros ')
        .replace(/\s+/g, ' ')
        .trim();
      const utterance = new SpeechSynthesisUtterance(clean);
      utterance.lang = 'es-ES';
      const voices = window.speechSynthesis.getVoices();
      const preferred = voices.find(v => /es(-|_)(MX|US)/i.test(v.lang) && /natural|neural|premium|enhanced/i.test(v.name))
        || voices.find(v => /^es(-|_)(ES|MX|US)/i.test(v.lang));
      if (preferred) utterance.voice = preferred;
      utterance.rate = 0.97;
      utterance.pitch = 1.0;
      window.speechSynthesis.speak(utterance);
    }
  };

  const stopConfirmationListen = () => {
    setListeningForConfirm(false);
    try { confirmationRecognitionRef.current?.stop(); } catch { /* noop */ }
    confirmationRecognitionRef.current = null;
  };

  const startConfirmationListen = () => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) return;
    const rec = new SpeechRecognition();
    rec.lang = 'es-ES';
    rec.interimResults = false;
    rec.maxAlternatives = 1;
    rec.onresult = (event) => {
      const heard = (event.results[0]?.[0]?.transcript || '').toLowerCase();
      stopConfirmationListen();
      if (/(s[ií]|confirmo|adelante|dale|o[kc]|bien|correcto)/.test(heard)) confirmPending();
      else if (/(no|cancelar|para|detente|quita)/.test(heard)) cancelPending();
    };
    rec.onend = () => { setListeningForConfirm(false); confirmationRecognitionRef.current = null; };
    rec.onerror = () => { setListeningForConfirm(false); confirmationRecognitionRef.current = null; };
    try { rec.start(); } catch { return; }
    confirmationRecognitionRef.current = rec;
    setListeningForConfirm(true);
  };

  const resolveDeleteTargets = (target) => {
    let list = [...transactions];
    if (target.type) list = list.filter(t => t.type === target.type);
    if (target.category) list = list.filter(t => t.category === target.category);
    if (target.description) list = list.filter(t => (t.description || '').toLowerCase().includes(target.description.toLowerCase()));
    list.sort((a, b) => (a.date < b.date ? 1 : -1));
    if (target.scope === 'last' && list.length > 0) list = [list[0]];
    return list;
  };

  const performAction = async (action) => {
    const type = action.type;
    if (type === 'delete') {
      const targets = resolveDeleteTargets(action.target || {});
      if (targets.length === 0) {
        return showMessage('error', 'No encontré registros que coincidan para borrar.');
      }
      for (const t of targets) {
        if (t.id) await deleteTransaction(t.id);
      }
      return showMessage('success', `He borrado ${targets.length} registro(s).`);
    }
    if (type === 'budget' && action.budget) {
      await setCategoryBudget(action.budget.category, action.budget.amount);
      return showMessage('success', `Presupuesto de ${action.budget.category} fijado en ${currency} ${action.budget.amount.toFixed(2)}.`);
    }
    if (type === 'currency' && action.currency) {
      await updateCurrency(action.currency);
      return showMessage('success', `Moneda cambiada a ${action.currency}.`);
    }
    if (type === 'export') {
      exportToCSV();
      return showMessage('success', 'Exportando tu historial a CSV...');
    }
    if (type === 'update') {
      if (!action.amount) {
        return showMessage('info', 'Dime el nuevo monto, por ejemplo: "no era 30, era 40".');
      }
      const targets = resolveDeleteTargets(action.target || { scope: 'last' });
      if (targets.length === 0) {
        return showMessage('error', 'No encontré el registro para corregir.');
      }
      const t = targets[0];
      if (t.id) await updateTransaction(t.id, { amount: action.amount });
      return showMessage('success', `Corregido "${t.description || t.category}" a ${currency} ${Number(action.amount).toFixed(2)}.`);
    }
    return showMessage('error', 'No pude reconocer la acción.');
  };

  const executeAnalysis = async (analysis, text) => {
    if (analysis.intent === 'register') {
      if (!analysis.transactions || analysis.transactions.length === 0) {
        return showMessage('error', 'No pude reconocer un monto claro. Intenta decir: "Regístrame 20 soles en galletas".');
      }
      await addMultipleTransactions(analysis.transactions);
      const labels = analysis.transactions.map(t => `${t.type === 'income' ? 'ingreso' : 'gasto'} de ${Number(t.amount).toFixed(2)}${t.recurring ? ' (mensual)' : ''}`).join(' y ');
      return showMessage('success', `Listo. Registré ${labels}.`);
    }
    if (analysis.intent === 'query') {
      const answer = resolveQuery(analysis.query, transactions, currency);
      return showMessage('info', answer);
    }
    if (analysis.intent === 'advice') {
      const advice = await askFinancialAdvisor(text, transactions, summary);
      return showMessage('info', advice);
    }
    if (analysis.intent === 'action') {
      return performAction(analysis.action);
    }
    return showMessage('info', 'No entendí del todo. Prueba con: "Regístrame 20 soles en galletas", "¿Cuánto gasté esta semana?", "Borra el último gasto" o "Cambia la moneda a dólares".');
  };

  const handleProcessText = async (textToProcess) => {
    const text = textToProcess || transcript;
    if (!text.trim()) return;

    setIsProcessing(true);
    setAssistantMessage(null);
    setConversationMemory(prev => [...prev, { role: 'user', content: text }].slice(-6));
    try {
      if (/resumen/.test(text.toLowerCase())) {
        const period = /semana/.test(text.toLowerCase()) ? 'week' : 'day';
        return showMessage('info', generateSummary(transactions, period, currency));
      }
      const analysis = await analyzeCommand(text, { categories: DEFAULT_CATEGORIES, currency, memory: conversationMemory });
      if (analysis.needsConfirmation) {
        setPendingAnalysis(analysis);
        setPendingText(text);
        speakText('¿Confirmas que continúe?');
        startConfirmationListen();
      } else {
        await executeAnalysis(analysis, text);
      }
    } catch (err) {
      setAssistantMessage({ type: 'error', text: 'Error procesando comando: ' + err.message });
    } finally {
      setIsProcessing(false);
    }
  };

  const confirmPending = async () => {
    stopConfirmationListen();
    const analysis = pendingAnalysis;
    const text = pendingText;
    setPendingAnalysis(null);
    setPendingText('');
    setIsProcessing(true);
    try {
      await executeAnalysis(analysis, text);
    } catch (err) {
      setAssistantMessage({ type: 'error', text: 'Error al confirmar: ' + err.message });
    } finally {
      setIsProcessing(false);
    }
  };

  const cancelPending = () => {
    stopConfirmationListen();
    setPendingAnalysis(null);
    setPendingText('');
    setAssistantMessage({ type: 'info', text: 'Acción cancelada.' });
    speakText('Acción cancelada');
  };

  return (
    <div className="ia-card" style={{ padding: '24px', marginBottom: '26px' }}>

      {/* Header */}
      <div className="section-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <span className="icon-chip icon-chip-ia" style={{ width: '48px', height: '48px' }}>
            <Bot size={24} />
          </span>
          <div>
            <h2 style={{ fontSize: '1.15rem', fontWeight: 800, color: 'var(--text-main)', letterSpacing: '-0.01em' }}>
              Asistente de Voz por IA
            </h2>
            <p className="metric-hint" style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <Sparkles size={12} color="var(--ia)" /> Habla o escribe para registrar o consultar
            </p>
          </div>
        </div>

        {/* Audio Wave Visualizer while listening */}
        {isListening ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: '5px', height: '28px', padding: '0 12px', background: 'var(--negative-soft)', borderRadius: '14px', boxShadow: 'var(--shadow-inset)' }}>
            <span className="audio-bar" />
            <span className="audio-bar" />
            <span className="audio-bar" />
            <span className="audio-bar" />
            <span style={{ fontSize: '0.8rem', fontWeight: 800, color: 'var(--negative)', marginLeft: '6px' }}>Escuchando...</span>
          </div>
        ) : (
          <span className="badge badge-ia">
            <Sparkles size={11} /> IA Activa
          </span>
        )}
      </div>

      {/* Main Mic Input Area */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '14px', marginBottom: '16px' }}>

        {/* Voice Mic Button */}
        <button
          onClick={toggleListening}
          className={`btn-fab ${isListening ? 'mic-active' : ''}`}
          aria-label={isListening ? "Detener micrófono" : "Activar micrófono por voz"}
          title={isListening ? "Haz clic para detener" : "Toca para hablarle a la IA"}
        >
          {isListening ? <MicOff size={26} /> : <Mic size={26} />}
        </button>

        {/* Text Input */}
        <div style={{ flex: 1, position: 'relative' }}>
          <input
            type="text"
            className="input-field"
            style={{ paddingRight: '54px' }}
            placeholder={isListening ? "Escuchando voz..." : "Escribe o habla: Regístrame 20 soles..."}
            value={transcript}
            onChange={(e) => setTranscript(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleProcessText()}
          />
          <button
            onClick={() => handleProcessText()}
            disabled={isProcessing || !transcript.trim()}
            aria-label="Enviar comando"
            style={{
              position: 'absolute',
              right: '7px',
              top: '7px',
              height: '42px',
              width: '42px',
              borderRadius: '13px',
              background: 'var(--cta)',
              border: 'none',
              color: 'var(--cta-text)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: transcript.trim() ? 'pointer' : 'default',
              opacity: transcript.trim() ? 1 : 0.4,
              transition: 'opacity 0.2s ease'
            }}
          >
            {isProcessing ? <Loader2 size={19} className="animate-spin" /> : <Send size={19} />}
          </button>
        </div>
      </div>

      {/* Mobile Horizontal Scrollable Suggestion Chips */}
      <div className="scroll-chips">
        <span className="metric-hint" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', flexShrink: 0, paddingRight: '4px' }}>
          <Sparkles size={12} color="var(--ia)" /> Ejemplos:
        </span>
        {[
          "Regístrame 20 soles en galletas",
          "Ayer pagué 45.50 de luz",
          "Me depositaron 1500 de sueldo",
          "¿Cuánto he gastado este mes?"
        ].map((sample, idx) => (
          <button
            key={idx}
            className="chip"
            onClick={() => {
              setTranscript(sample);
              handleProcessText(sample);
            }}
          >
            "{sample}"
          </button>
        ))}
      </div>

      {/* Confirmation Card */}
      {pendingAnalysis && (
        <div className="toast toast-warn" style={{ borderLeftColor: 'var(--ia)' }}>
          <ShieldAlert size={20} style={{ marginTop: '2px', flexShrink: 0, color: 'var(--ia)' }} />
          <div style={{ flex: 1 }}>
            <span className="toast-title">¿Confirmas esta acción?</span>
            <p className="toast-text">
              {pendingAnalysis.intent === 'action'
                ? `Acción detectada: ${pendingAnalysis.action?.type === 'delete' ? 'borrar registros' : pendingAnalysis.action?.type === 'budget' ? 'ajustar presupuesto' : pendingAnalysis.action?.type === 'currency' ? 'cambiar moneda' : pendingAnalysis.action?.type === 'export' ? 'exportar CSV' : pendingAnalysis.action?.type || 'acción'}.`
                : 'Quiero confirmar antes de continuar con tu solicitud.'}
            </p>
            <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
              <button className="btn-primary" onClick={confirmPending} disabled={isProcessing} style={{ padding: '8px 16px', fontSize: '0.85rem' }}>
                Sí, continuar
              </button>
              <button className="btn-secondary" onClick={cancelPending} disabled={isProcessing} style={{ padding: '8px 16px', fontSize: '0.85rem' }}>
                Cancelar
              </button>
              {listeningForConfirm && (
                <span className="metric-hint" style={{ display: 'flex', alignItems: 'center', gap: '4px', marginLeft: 'auto' }}>
                  <span className="audio-bar" />
                  <span className="audio-bar" />
                  <span className="audio-bar" />
                  Escuchando respuesta...
                </span>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Assistant Response Toast Card */}
      {assistantMessage && (
        <div className={`toast ${assistantMessage.type === 'success' ? 'toast-success' : assistantMessage.type === 'info' ? 'toast-info' : 'toast-error'}`}>
          {assistantMessage.type === 'success' && <CheckCircle2 size={20} style={{ marginTop: '2px', flexShrink: 0 }} />}
          {assistantMessage.type === 'info' && <MessageSquareText size={20} style={{ marginTop: '2px', flexShrink: 0 }} />}
          {assistantMessage.type === 'error' && <AlertCircle size={20} style={{ marginTop: '2px', flexShrink: 0 }} />}

          <div style={{ flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
              <span className="toast-title">
                {assistantMessage.type === 'success' ? '¡Registro Exitoso!' : assistantMessage.type === 'info' ? 'Respuesta IA' : 'Atención'}
              </span>
              <button
                onClick={() => speakText(assistantMessage.text)}
                className="btn-icon"
                style={{ minHeight: '32px', minWidth: '32px', padding: '4px' }}
                aria-label="Escuchar mensaje"
                title="Escuchar"
              >
                <Volume2 size={16} />
              </button>
            </div>
            <p className="toast-text">{assistantMessage.text}</p>
          </div>
        </div>
      )}

    </div>
  );
}
