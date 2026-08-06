import React, { useState } from 'react';
import { X, DollarSign, Check, ShieldCheck, User, Type } from 'lucide-react';
import { useFinance } from '../../context/FinanceContext';
import { useAuth } from '../../context/AuthContext';

export default function SettingsModal({ onClose, fontSize, onFontSize }) {
  const { currency, updateCurrency } = useFinance();
  const { currentUser, isDemoUser } = useAuth();
  const [savedSuccess, setSavedSuccess] = useState(false);
  const [selectedCurrency, setSelectedCurrency] = useState(currency);

  const handleSave = (e) => {
    e.preventDefault();
    updateCurrency(selectedCurrency);
    setSavedSuccess(true);
    setTimeout(() => {
      setSavedSuccess(false);
      onClose();
    }, 1200);
  };

  const fontOptions = [
    { key: 'sm', label: 'Pequeña', hint: 'A' },
    { key: 'md', label: 'Mediana', hint: 'A' },
    { key: 'lg', label: 'Grande', hint: 'A' }
  ];

  return (
    <div className="mobile-modal-sheet">
      <div className="modal-card">
        <button
          onClick={onClose}
          className="btn-icon"
          aria-label="Cerrar ventana de ajustes"
          style={{ position: 'absolute', right: '14px', top: '14px' }}
        >
          <X size={22} />
        </button>

        <h3 style={{ fontSize: '1.25rem', fontWeight: 800, marginBottom: '18px', display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-main)' }}>
          <DollarSign size={22} color="var(--cta)" /> Preferencias de Usuario
        </h3>

        <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
          
          {/* User Account Banner */}
          <div className="neo-inset" style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '14px' }}>
            <span className="avatar" style={{ width: '40px', height: '40px' }}>
              <User size={20} />
            </span>
            <div>
              <span style={{ fontSize: '0.9rem', fontWeight: 700, display: 'block', color: 'var(--text-main)' }}>
                {currentUser?.displayName || currentUser?.email || 'Usuario Demo'}
              </span>
              <span className="metric-hint" style={{ marginTop: 0 }}>
                {isDemoUser ? 'Sesión de Prueba Local' : 'Cuenta Sincronizada en Firebase'}
              </span>
            </div>
          </div>

          {/* Currency Selection */}
          <div>
            <label className="field-label">
              Moneda Principal
            </label>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px' }}>
              {[
                { code: 'S/.', label: 'Soles (S/.)' },
                { code: '$', label: 'Dólares ($)' },
                { code: '€', label: 'Euros (€)' }
              ].map(c => (
                <button
                  key={c.code}
                  type="button"
                  onClick={() => setSelectedCurrency(c.code)}
                  className="btn"
                  style={{
                    minHeight: '46px',
                    background: selectedCurrency === c.code ? 'var(--cta)' : 'var(--elevated)',
                    color: selectedCurrency === c.code ? 'var(--cta-text)' : 'var(--text-muted)',
                    boxShadow: selectedCurrency === c.code ? 'var(--shadow-inset)' : 'var(--shadow-raised)',
                    fontSize: '0.88rem',
                    fontWeight: 700
                  }}
                >
                  {c.label}
                </button>
              ))}
            </div>
          </div>

          {/* Font Size Selection */}
          <div>
            <label className="field-label">
              <Type size={15} style={{ verticalAlign: '-2px', marginRight: '6px' }} />
              Tamaño de Letra
            </label>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px' }}>
              {fontOptions.map(f => (
                <button
                  key={f.key}
                  type="button"
                  onClick={() => onFontSize(f.key)}
                  className="btn"
                  role="radio"
                  aria-checked={fontSize === f.key}
                  style={{
                    minHeight: '50px',
                    padding: '10px',
                    borderRadius: 'var(--radius-md)',
                    border: 'none',
                    flexDirection: 'column',
                    gap: '2px',
                    background: fontSize === f.key ? 'var(--cta)' : 'var(--elevated)',
                    color: fontSize === f.key ? 'var(--cta-text)' : 'var(--text-secondary)',
                    boxShadow: fontSize === f.key ? 'var(--shadow-fab)' : 'var(--shadow-raised)',
                    fontWeight: 800,
                    fontSize: fontSize === f.key ? '1rem' : '0.9rem',
                    transition: 'all 0.2s var(--ease-smooth)'
                  }}
                >
                  <span style={{ fontSize: f.key === 'sm' ? '0.8rem' : f.key === 'lg' ? '1.15rem' : '0.95rem', lineHeight: 1 }}>{f.hint}</span>
                  <span style={{ fontSize: '0.78rem', fontWeight: 700 }}>{f.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Security & Cloud Status */}
          <div className="neo-inset" style={{ padding: '14px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
              <span style={{ fontSize: '0.85rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--text-main)' }}>
                <ShieldCheck size={16} color="var(--positive)" /> Motor de IA & Seguridad
              </span>
              <span className="badge badge-positive">
                Activo
              </span>
            </div>
            <p className="metric-hint" style={{ marginTop: 0 }}>
              DeepSeek v4 Flash procesa tus comandos de voz de forma cifrada mediante variables de entorno seguras.
            </p>
          </div>

          {/* Submit */}
          <div style={{ display: 'flex', gap: '12px', marginTop: '4px' }}>
            <button type="button" onClick={onClose} className="btn btn-secondary" style={{ flex: 1 }}>
              Cancelar
            </button>
            <button type="submit" className="btn btn-primary" style={{ flex: 1 }}>
              {savedSuccess ? <><Check size={18} /> ¡Guardado!</> : 'Guardar Cambios'}
            </button>
          </div>

        </form>
      </div>
    </div>
  );
}
