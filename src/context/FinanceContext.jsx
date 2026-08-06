import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import { 
  collection, 
  addDoc, 
  deleteDoc, 
  doc, 
  setDoc, 
  updateDoc, 
  onSnapshot, 
  query, 
  orderBy 
} from 'firebase/firestore';
import confetti from 'canvas-confetti';
import { db, isFirebaseConfigured } from '../services/firebase';
import { useAuth } from './AuthContext';

const FinanceContext = createContext();

const INITIAL_TRANSACTIONS = [
  {
    id: 't1',
    type: 'income',
    amount: 3500.00,
    category: 'Ingreso (Sueldo/Trabajo)',
    description: 'Sueldo Mensual de Trabajo',
    date: new Date(Date.now() - 86400000 * 2).toISOString().split('T')[0]
  },
  {
    id: 't2',
    type: 'expense',
    amount: 20.00,
    category: 'Alimentación y Comida',
    description: 'Galletas y Café',
    date: new Date().toISOString().split('T')[0]
  },
  {
    id: 't3',
    type: 'expense',
    amount: 45.50,
    category: 'Transporte y Gasolina',
    description: 'Gasolina para el auto',
    date: new Date().toISOString().split('T')[0]
  },
  {
    id: 't4',
    type: 'expense',
    amount: 120.00,
    category: 'Servicios (Luz, Agua, Internet)',
    description: 'Servicio de Internet y Cable',
    date: new Date(Date.now() - 86400000 * 5).toISOString().split('T')[0]
  },
  {
    id: 't5',
    type: 'expense',
    amount: 85.00,
    category: 'Entretenimiento y Ocio',
    description: 'Entradas de cine y cena',
    date: new Date(Date.now() - 86400000 * 3).toISOString().split('T')[0]
  }
];

const INITIAL_BUDGETS = {
  'Alimentación y Comida': 800,
  'Transporte y Gasolina': 300,
  'Servicios (Luz, Agua, Internet)': 400,
  'Entretenimiento y Ocio': 250,
  'Salud y Medicinas': 200,
  'Hogar y Compras': 500
};

// Compute the recurring occurrences that are due up to today (idempotent).
function computeRecurringOccurrences(list) {
  const today = new Date();
  const todayStr = today.toISOString().split('T')[0];
  const [ty, tm] = todayStr.split('-').map(Number);

  const existing = new Set(
    list.filter(t => t.source).map(t => `${t.source}|${t.date}`)
  );
  const generated = [];

  for (const t of list) {
    if (!t.recurring || !t.date) continue;
    const withSource = t.source || t.id;
    const [by, bm, bd] = t.date.split('-').map(Number);
    if (!by || !bm || !bd) continue;

    let y = by;
    let m = bm;
    while (true) {
      m += 1;
      if (m > 12) { m = 1; y += 1; }
      if (y > ty || (y === ty && m > tm)) break;

      const day = Math.min(bd, new Date(y, m, 0).getDate());
      const date = `${y}-${String(m).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      if (date > todayStr) break;

      const key = `${withSource}|${date}`;
      if (!existing.has(key)) {
        existing.add(key);
        generated.push({
          type: t.type,
          amount: t.amount,
          category: t.category,
          description: t.description,
          date,
          recurring: false,
          source: withSource
        });
      }
    }
  }
  return generated;
}

export function FinanceProvider({ children }) {
  const { currentUser, isDemoUser } = useAuth();
  const [transactions, setTransactions] = useState([]);
  const [budgets, setBudgets] = useState(INITIAL_BUDGETS);
  const [currency, setCurrency] = useState('S/.');
  const [loading, setLoading] = useState(true);

  // Sync with Firestore or LocalStorage
  useEffect(() => {
    const savedCurrency = localStorage.getItem('CASHFLOW_CURRENCY');
    if (savedCurrency) setCurrency(savedCurrency);

    const savedBudgets = localStorage.getItem('CASHFLOW_BUDGETS');
    if (savedBudgets) setBudgets(JSON.parse(savedBudgets));

    if (currentUser && !isDemoUser && db && isFirebaseConfigured) {
      const q = query(
        collection(db, 'users', currentUser.uid, 'transactions'),
        orderBy('date', 'desc')
      );
      const unsubscribe = onSnapshot(q, (snapshot) => {
        const docs = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));
        setTransactions(docs);
        setLoading(false);
      }, (error) => {
        console.warn("Firestore listener error, fallback to local:", error);
        loadLocalTransactions();
      });
      return unsubscribe;
    } else {
      loadLocalTransactions();
    }
  }, [currentUser, isDemoUser]);

  // Sync preferences (currency + budgets) with Firestore for real accounts
  useEffect(() => {
    if (currentUser && !isDemoUser && db && isFirebaseConfigured) {
      const settingsRef = doc(db, 'users', currentUser.uid, 'settings', 'preferences');
      const unsubscribe = onSnapshot(settingsRef, (snap) => {
        if (snap.exists()) {
          const data = snap.data();
          if (data.currency) {
            setCurrency(data.currency);
            localStorage.setItem('CASHFLOW_CURRENCY', data.currency);
          }
          if (data.budgets && typeof data.budgets === 'object') {
            const merged = { ...INITIAL_BUDGETS, ...data.budgets };
            setBudgets(merged);
            localStorage.setItem('CASHFLOW_BUDGETS', JSON.stringify(merged));
          }
        }
      }, (error) => {
        console.warn("Firestore settings listener error, using local preferences:", error);
      });
      return unsubscribe;
    }
  }, [currentUser, isDemoUser]);

  // Auto-generate due recurring occurrences (idempotent). Used on load and after each recurring add.
  const generateRecurringFor = (list) => {
    const due = computeRecurringOccurrences(list);
    if (due.length > 0) {
      due.forEach(t => addTransaction(t, { silent: true }));
    }
  };

  // Backfill due occurrences after data loads (runs once per mount)
  const recurringSyncedRef = useRef(false);
  useEffect(() => {
    if (recurringSyncedRef.current || loading) return;
    recurringSyncedRef.current = true;
    generateRecurringFor(transactions);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading]);

  const loadLocalTransactions = () => {
    const saved = localStorage.getItem('CASHFLOW_TRANSACTIONS');
    if (saved) {
      setTransactions(JSON.parse(saved));
    } else {
      setTransactions(INITIAL_TRANSACTIONS);
      localStorage.setItem('CASHFLOW_TRANSACTIONS', JSON.stringify(INITIAL_TRANSACTIONS));
    }
    setLoading(false);
  };

  const saveLocalTransactions = (newTransactions) => {
    setTransactions(newTransactions);
    localStorage.setItem('CASHFLOW_TRANSACTIONS', JSON.stringify(newTransactions));
  };

  const triggerConfetti = () => {
    try {
      confetti({
        particleCount: 50,
        spread: 60,
        origin: { y: 0.8 },
        colors: ['#3b82f6', '#10b981', '#8b5cf6', '#ec4899']
      });
    } catch {
      // Ignore if DOM canvas not available
    }
  };

  // Add a transaction
  const addTransaction = async (data, opts = {}) => {
    const newDoc = {
      type: data.type || 'expense',
      amount: parseFloat(data.amount) || 0,
      category: data.category || 'Otros',
      description: data.description || 'Gasto registrado',
      date: data.date || new Date().toISOString().split('T')[0],
      recurring: !!data.recurring,
      source: data.source || null,
      createdAt: new Date().toISOString()
    };

    let savedId;
    if (currentUser && !isDemoUser && db && isFirebaseConfigured) {
      const ref = await addDoc(collection(db, 'users', currentUser.uid, 'transactions'), newDoc);
      savedId = ref.id;
    } else {
      const created = {
        id: 't_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7),
        ...newDoc
      };
      savedId = created.id;
      setTransactions(prev => {
        const next = [created, ...prev];
        localStorage.setItem('CASHFLOW_TRANSACTIONS', JSON.stringify(next));
        return next;
      });
    }

    // Generate due recurring occurrences immediately for regular recurring adds
    if (data.recurring && !opts.silent) {
      generateRecurringFor([{ ...newDoc, id: data.source || savedId }, ...transactions]);
    }

    // Trigger celebration confetti for income or big milestones (skip silent ones like recurring)
    if (!opts.silent && (data.type === 'income' || parseFloat(data.amount) > 100)) {
      triggerConfetti();
    }
  };

  // Add multiple transactions at once (voice command batch)
  const addMultipleTransactions = async (list) => {
    for (const item of list) {
      await addTransaction(item);
    }
  };

  // Delete transaction
  const deleteTransaction = async (id) => {
    if (currentUser && !isDemoUser && db && isFirebaseConfigured) {
      await deleteDoc(doc(db, 'users', currentUser.uid, 'transactions', id));
    } else {
      const filtered = transactions.filter(t => t.id !== id);
      saveLocalTransactions(filtered);
    }
  };

  // Update transaction
  const updateTransaction = async (id, updatedData) => {
    if (currentUser && !isDemoUser && db && isFirebaseConfigured) {
      await updateDoc(doc(db, 'users', currentUser.uid, 'transactions', id), updatedData);
    } else {
      const updated = transactions.map(t => t.id === id ? { ...t, ...updatedData } : t);
      saveLocalTransactions(updated);
    }

    // If it just became recurring, backfill its due occurrences right away
    if (updatedData.recurring) {
      generateRecurringFor(transactions.map(t => t.id === id ? { ...t, ...updatedData } : t));
    }
  };

  // Update Budget limit
  const setCategoryBudget = (category, amount) => {
    const updated = { ...budgets, [category]: parseFloat(amount) || 0 };
    setBudgets(updated);
    localStorage.setItem('CASHFLOW_BUDGETS', JSON.stringify(updated));
    if (currentUser && !isDemoUser && db && isFirebaseConfigured) {
      setDoc(doc(db, 'users', currentUser.uid, 'settings', 'preferences'), { budgets: updated }, { merge: true })
        .catch(err => console.warn("Error guardando presupuestos en Firestore:", err));
    }
  };

  // Update preferred currency
  const updateCurrency = (newCurrency) => {
    setCurrency(newCurrency);
    localStorage.setItem('CASHFLOW_CURRENCY', newCurrency);
    if (currentUser && !isDemoUser && db && isFirebaseConfigured) {
      setDoc(doc(db, 'users', currentUser.uid, 'settings', 'preferences'), { currency: newCurrency }, { merge: true })
        .catch(err => console.warn("Error guardando moneda en Firestore:", err));
    }
  };

  // Financial Summaries
  const totalIncome = transactions
    .filter(t => t.type === 'income')
    .reduce((sum, t) => sum + (t.amount || 0), 0);

  const totalExpense = transactions
    .filter(t => t.type === 'expense')
    .reduce((sum, t) => sum + (t.amount || 0), 0);

  const netBalance = totalIncome - totalExpense;

  const savingsRate = totalIncome > 0 ? Math.max(0, Math.round(((totalIncome - totalExpense) / totalIncome) * 100)) : 0;

  // Export CSV
  const exportToCSV = () => {
    const headers = ['Fecha', 'Tipo', 'Categoría', 'Descripción', `Monto (${currency})`].join(',');
    const rows = transactions.map(t => 
      `"${t.date}","${t.type === 'income' ? 'Ingreso' : 'Gasto'}","${t.category}","${t.description.replace(/"/g, '""')}","${t.amount.toFixed(2)}"`
    ).join('\n');

    const blob = new Blob([`${headers}\n${rows}`], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `cashflow_finanzas_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <FinanceContext.Provider value={{
      transactions,
      budgets,
      currency,
      loading,
      summary: { totalIncome, totalExpense, netBalance, savingsRate },
      addTransaction,
      addMultipleTransactions,
      deleteTransaction,
      updateTransaction,
      setCategoryBudget,
      updateCurrency,
      exportToCSV,
      triggerConfetti
    }}>
      {children}
    </FinanceContext.Provider>
  );
}

export function useFinance() {
  return useContext(FinanceContext);
}
