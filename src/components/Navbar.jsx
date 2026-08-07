import React, { useState, useEffect } from 'react';
import {
  Wallet,
  Settings,
  Download,
  LogOut,
  User,
  Sparkles,
  Smartphone,
  Sun,
  Moon
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useFinance } from '../context/FinanceContext';

const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;

export default function Navbar({ onOpenSettings, onOpenAuth, theme, onToggleTheme }) {
  const { currentUser, logout } = useAuth();
  const { exportToCSV } = useFinance();
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [isInstalled, setIsInstalled] = useState(false);
  const [showIosHelp, setShowIosHelp] = useState(false);

  const isStandalone = window.matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;

  useEffect(() => {
    window.addEventListener('beforeinstallprompt', (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
    });

    window.addEventListener('appinstalled', () => {
      setIsInstalled(true);
      setDeferredPrompt(null);
    });
  }, []);

  const handleInstallPWA = () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      deferredPrompt.userChoice.then((choiceResult) => {
        if (choiceResult.outcome === 'accepted') {
          setIsInstalled(true);
        }
        setDeferredPrompt(null);
      });
    }
  };

  return (
    <header className="app-header">
      <div className="header-inner">
        {/* Brand */}
        <div className="brand">
          <div className="brand-logo">
            <Wallet size={22} />
          </div>
          <div style={{ minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
              <h1 className="brand-title">Cashflow IA</h1>
              <span className="badge badge-ia">
                <Sparkles size={11} />
                Voz + IA
              </span>
            </div>
            <p className="brand-subtitle">Finanzas personales por inteligencia artificial</p>
          </div>
        </div>

        {/* Action Controls */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          {/* Theme Toggle */}
          <button
            onClick={onToggleTheme}
            className="btn-icon"
            title={theme === 'dark' ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'}
            aria-label={theme === 'dark' ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'}
          >
            {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
          </button>

          {/* PWA Install Button */}
          {!isStandalone && !isInstalled && deferredPrompt && (
            <button onClick={handleInstallPWA} className="btn-secondary" title="Instalar como App en tu teléfono o PC">
              <Smartphone size={16} />
              <span style={{ fontSize: '0.9rem' }} className="hide-mobile">Instalar App</span>
            </button>
          )}
          {!isStandalone && !isInstalled && !deferredPrompt && isIOS && (
            <button onClick={() => setShowIosHelp(true)} className="btn-secondary" title="Instalar en iPhone/iPad">
              <Smartphone size={16} />
              <span style={{ fontSize: '0.9rem' }} className="hide-mobile">Instalar App</span>
            </button>
          )}

          {/* Export CSV */}
          <button onClick={exportToCSV} className="btn-icon" title="Exportar reporte CSV">
            <Download size={18} />
            <span style={{ fontSize: '0.9rem', fontWeight: 700 }} className="hide-mobile">CSV</span>
          </button>

          {/* Settings Button */}
          <button onClick={onOpenSettings} className="btn-icon" title="Configuración">
            <Settings size={18} />
            <span style={{ fontSize: '0.9rem', fontWeight: 700 }} className="hide-mobile">Config</span>
          </button>

          {/* User Profile / Auth Button */}
          {currentUser ? (
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '6px 12px',
              borderRadius: '30px',
              boxShadow: 'var(--shadow-inset)'
            }}>
              {currentUser.photoURL ? (
                <img className="avatar" src={currentUser.photoURL} alt="Avatar" style={{ width: '32px', height: '32px' }} />
              ) : (
                <span className="avatar" style={{ width: '32px', height: '32px' }}>
                  <User size={15} />
                </span>
              )}
              <span style={{
                fontSize: '0.9rem',
                fontWeight: 700,
                maxWidth: '120px',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
                color: 'var(--text-main)'
              }}>
                {currentUser.displayName || currentUser.email.split('@')[0]}
              </span>
              <button
                onClick={logout}
                className="btn-icon"
                style={{ minHeight: '36px', minWidth: '36px', padding: '6px' }}
                title="Cerrar Sesión"
                aria-label="Cerrar sesión"
              >
                <LogOut size={16} />
              </button>
            </div>
          ) : (
            <button onClick={onOpenAuth} className="btn-primary">
              <User size={18} />
              <span>Ingresar</span>
            </button>
          )}
        </div>
      </div>

      {/* iOS Install Help Modal */}
      {showIosHelp && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 9999, background: 'rgba(0,0,0,0.55)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px'
        }} onClick={() => setShowIosHelp(false)}>
          <div className="neo-card" style={{ maxWidth: '360px', width: '100%', padding: '22px' }} onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
              <h3 style={{ fontWeight: 800, color: 'var(--text-main)' }}>Instalar en iPhone/iPad</h3>
              <button className="btn-icon" onClick={() => setShowIosHelp(false)} aria-label="Cerrar">✕</button>
            </div>
            <ol style={{ paddingLeft: '18px', margin: 0, display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
              <li>Toca el botón <strong>Compartir</strong> <span className="badge">⤴</span> en Safari.</li>
              <li>Desplázate y toca <strong>"Añadir a pantalla de inicio"</strong>.</li>
              <li>Toca <strong>"Añadir"</strong> en la esquina superior derecha.</li>
            </ol>
            <p className="metric-hint" style={{ marginTop: '12px' }}>La app quedará como un icono en tu pantalla, sin navegador.</p>
          </div>
        </div>
      )}
    </header>
  );
}
