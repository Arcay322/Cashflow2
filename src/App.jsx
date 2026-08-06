import React, { useState, useEffect } from 'react';
import { AuthProvider } from './context/AuthContext';
import { FinanceProvider, useFinance } from './context/FinanceContext';
import Navbar from './components/Navbar';
import VoiceWidget from './components/VoiceAssistant/VoiceWidget';
import SummaryCards from './components/Dashboard/SummaryCards';
import CategoryCharts from './components/Dashboard/CategoryCharts';
import Insights from './components/Dashboard/Insights';
import TransactionManager from './components/Transactions/TransactionManager';
import BudgetManager from './components/Budgets/BudgetManager';
import SettingsModal from './components/Settings/SettingsModal';
import AuthModal from './components/Auth/AuthModal';
import MobileBottomNav from './components/MobileBottomNav';

function MainApp() {
  const { loading } = useFinance();
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isAuthOpen, setIsAuthOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('dashboard'); // 'dashboard', 'transactions', 'voice', 'budgets'
  const [theme, setTheme] = useState(() => {
    const saved = localStorage.getItem('CASHFLOW_THEME');
    const initial = saved === 'light' || saved === 'dark'
      ? saved
      : window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    document.documentElement.setAttribute('data-theme', initial);
    return initial;
  });
  const [fontSize, setFontSize] = useState(() => {
    const saved = localStorage.getItem('CASHFLOW_FONT_SIZE');
    const initial = saved === 'sm' || saved === 'md' || saved === 'lg' ? saved : 'md';
    document.documentElement.setAttribute('data-font', initial);
    return initial;
  });

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('CASHFLOW_THEME', theme);
  }, [theme]);

  useEffect(() => {
    document.documentElement.setAttribute('data-font', fontSize);
    localStorage.setItem('CASHFLOW_FONT_SIZE', fontSize);
  }, [fontSize]);

  const toggleTheme = () => setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'));

  return (
    <div className="app-container">
      {/* Top Navbar */}
      <Navbar
        theme={theme}
        onToggleTheme={toggleTheme}
        onOpenSettings={() => setIsSettingsOpen(true)}
        onOpenAuth={() => setIsAuthOpen(true)}
      />

      {/* Main Content Area */}
      <main aria-busy={loading} aria-live="polite">
        {loading ? (
          <div className="loading-screen" role="status" aria-label="Cargando tus datos">
            <div className="skeleton-line short" />
            <div className="skeleton-block" />
            <div className="skeleton-block" />
            <div className="skeleton-line" />
            <div className="skeleton-block" />
          </div>
        ) : (
          <>
            {/* On Mobile: switch content based on activeTab, or display all on desktop */}
            
            {/* Voice Assistant Section (always visible on Voice tab or Desktop) */}
            <div style={{ display: activeTab === 'voice' || activeTab === 'dashboard' ? 'block' : 'none' }}>
              <VoiceWidget />
            </div>

            {/* Dashboard Cards & Charts */}
            <div style={{ display: activeTab === 'dashboard' ? 'block' : 'none' }}>
              <SummaryCards />
              <CategoryCharts />
              <Insights />
            </div>

            {/* Budget Goals Section */}
            <div style={{ display: activeTab === 'budgets' || activeTab === 'dashboard' ? 'block' : 'none' }}>
              <BudgetManager />
            </div>

            {/* Transactions History Section */}
            <div style={{ display: activeTab === 'transactions' || activeTab === 'dashboard' ? 'block' : 'none' }}>
              <TransactionManager />
            </div>
          </>
        )}
      </main>

      {/* Fixed Mobile Bottom Navigation Bar */}
      <MobileBottomNav 
        activeTab={activeTab} 
        setActiveTab={setActiveTab}
        onOpenSettings={() => setIsSettingsOpen(true)}
      />

      {/* Modals */}
      {isSettingsOpen && (
        <SettingsModal
          onClose={() => setIsSettingsOpen(false)}
          fontSize={fontSize}
          onFontSize={setFontSize}
        />
      )}
      {isAuthOpen && <AuthModal onClose={() => setIsAuthOpen(false)} />}
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <FinanceProvider>
        <MainApp />
      </FinanceProvider>
    </AuthProvider>
  );
}
