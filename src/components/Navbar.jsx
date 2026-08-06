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

export default function Navbar({ onOpenSettings, onOpenAuth, theme, onToggleTheme }) {
  const { currentUser, logout } = useAuth();
  const { exportToCSV } = useFinance();
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [isInstalled, setIsInstalled] = useState(false);

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
          {deferredPrompt && !isInstalled && (
            <button onClick={handleInstallPWA} className="btn-secondary" title="Instalar como App en tu teléfono o PC">
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
    </header>
  );
}
