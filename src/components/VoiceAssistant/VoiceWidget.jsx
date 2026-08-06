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
  Loader2
} from 'lucide-react';
import { useFinance } from '../../context/FinanceContext';
import { parseVoiceCommand, askFinancialAdvisor } from '../../services/deepseek';

export default function VoiceWidget() {
  const { addMultipleTransactions, currency, transactions, summary } = useFinance();
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [assistantMessage, setAssistantMessage] = useState(null);
  const [speechSupported, setSpeechSupported] = useState(true);
  const recognitionRef = useRef(null);

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

  const handleProcessText = async (textToProcess) => {
    const text = textToProcess || transcript;
    if (!text.trim()) return;

    setIsProcessing(true);
    setAssistantMessage(null);

    try {
      const result = await parseVoiceCommand(text, undefined, currency);

      if (result.isQuery) {
        const advice = await askFinancialAdvisor(text, transactions, summary);
        setAssistantMessage({ type: 'info', text: advice });
        speakText(advice);
      } else if (result.transactions && result.transactions.length > 0) {
        await addMultipleTransactions(result.transactions);
        const msg = result.message || `Registrado exitosamente: ${result.transactions.length} transacción(es).`;
        setAssistantMessage({ type: 'success', text: msg });
        speakText(msg);
        setTranscript('');
      } else {
        setAssistantMessage({ type: 'error', text: 'No se pudo interpretar el monto o la categoría. Intenta decir: "Regístrame 20 soles en galletas"' });
      }
    } catch (err) {
      setAssistantMessage({ type: 'error', text: 'Error procesando comando: ' + err.message });
    } finally {
      setIsProcessing(false);
    }
  };

  const speakText = (text) => {
    if ('speechSynthesis' in window) {
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = 'es-ES';
      utterance.rate = 1.0;
      window.speechSynthesis.speak(utterance);
    }
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
