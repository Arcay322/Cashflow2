import React from 'react';
import { LayoutDashboard, Mic, Receipt, Target, Settings } from 'lucide-react';

export default function MobileBottomNav({ activeTab, setActiveTab, onOpenSettings }) {
  return (
    <div className="mobile-bottom-nav">
      <nav className="nav-dock" aria-label="Navegación principal">
        <button
          className={`nav-item ${activeTab === 'dashboard' ? 'active' : ''}`}
          onClick={() => setActiveTab('dashboard')}
        >
          <LayoutDashboard size={20} />
          <span>Inicio</span>
        </button>

        <button
          className={`nav-item ${activeTab === 'transactions' ? 'active' : ''}`}
          onClick={() => setActiveTab('transactions')}
        >
          <Receipt size={20} />
          <span>Historial</span>
        </button>

        {/* Floating Center Voice Button */}
        <button
          className={`nav-item nav-voice-fab ${activeTab === 'voice' ? 'active' : ''}`}
          onClick={() => setActiveTab('voice')}
          title="Hablar a la IA"
        >
          <span className="fab-icon-glow">
            <Mic size={24} />
          </span>
          <span style={{ color: 'var(--text-muted)' }}>Voz IA</span>
        </button>

        <button
          className={`nav-item ${activeTab === 'budgets' ? 'active' : ''}`}
          onClick={() => setActiveTab('budgets')}
        >
          <Target size={20} />
          <span>Metas</span>
        </button>

        <button
          className="nav-item"
          onClick={onOpenSettings}
        >
          <Settings size={20} />
          <span>Ajustes</span>
        </button>
      </nav>
    </div>
  );
}
