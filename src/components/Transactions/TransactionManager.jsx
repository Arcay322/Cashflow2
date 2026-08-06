import React, { useState } from 'react';
import { 
  Search, 
  Trash2, 
  Edit3, 
  Plus, 
  ArrowUpCircle, 
  ArrowDownCircle, 
  Calendar,
  Repeat,
  X
} from 'lucide-react';
import { useFinance } from '../../context/FinanceContext';
import NeoSelect from '../ui/NeoSelect';

const DEFAULT_CATEGORIES = [
  "Alimentación y Comida",
  "Transporte y Gasolina",
  "Servicios (Luz, Agua, Internet)",
  "Entretenimiento y Ocio",
  "Salud y Medicinas",
  "Educación y Cursos",
  "Hogar y Compras",
  "Ingreso (Sueldo/Trabajo)",
  "Otros"
];

export default function TransactionManager() {
  const { transactions, currency, deleteTransaction, addTransaction, updateTransaction } = useFinance();
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState('all'); // 'all', 'expense', 'income'
  const [filterDate, setFilterDate] = useState('all'); // 'all', 'today', 'week', 'month'
  
  // Modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [formData, setFormData] = useState({
    type: 'expense',
    amount: '',
    category: 'Alimentación y Comida',
    description: '',
    date: new Date().toISOString().split('T')[0],
    recurring: false
  });

  const handleOpenAddModal = () => {
    setEditingId(null);
    setFormData({
      type: 'expense',
      amount: '',
      category: 'Alimentación y Comida',
      description: '',
      date: new Date().toISOString().split('T')[0],
      recurring: false
    });
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (t) => {
    setEditingId(t.id);
    setFormData({
      type: t.type,
      amount: t.amount,
      category: t.category,
      description: t.description,
      date: t.date,
      recurring: !!t.recurring
    });
    setIsModalOpen(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.amount || !formData.description) return;

    if (editingId) {
      await updateTransaction(editingId, {
        ...formData,
        amount: parseFloat(formData.amount)
      });
    } else {
      await addTransaction({
        ...formData,
        amount: parseFloat(formData.amount)
      });
    }
    setIsModalOpen(false);
  };

  // Filtering Logic
  const filteredTransactions = transactions.filter((t) => {
    if (filterType !== 'all' && t.type !== filterType) return false;

    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase();
      const matchDesc = t.description.toLowerCase().includes(term);
      const matchCat = t.category.toLowerCase().includes(term);
      if (!matchDesc && !matchCat) return false;
    }

    if (filterDate !== 'all') {
      const tDate = new Date(t.date);
      const now = new Date();
      if (filterDate === 'today') {
        if (t.date !== now.toISOString().split('T')[0]) return false;
      } else if (filterDate === 'week') {
        const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        if (tDate < weekAgo) return false;
      } else if (filterDate === 'month') {
        if (tDate.getMonth() !== now.getMonth() || tDate.getFullYear() !== now.getFullYear()) return false;
      }
    }

    return true;
  });

  const segmentedBtn = (isActive) => ({
    background: isActive ? 'var(--elevated)' : 'transparent',
    color: isActive ? 'var(--text-main)' : 'var(--text-muted)',
    border: 'none',
    padding: '9px 14px',
    borderRadius: '12px',
    fontSize: '0.85rem',
    fontWeight: 800,
    cursor: 'pointer',
    boxShadow: isActive ? 'var(--shadow-raised)' : 'none',
    transition: 'all 0.2s var(--ease-smooth)'
  });

  return (
    <div className="neo-card" style={{ padding: '24px', marginBottom: '28px' }}>
      
      {/* Table Header & Controls */}
      <div className="section-header">
        <div>
          <h2 style={{ fontSize: '1.2rem', fontWeight: 800, color: 'var(--text-main)' }}>Historial de Transacciones</h2>
          <p className="metric-hint">Mostrando {filteredTransactions.length} registros</p>
        </div>

        <button onClick={handleOpenAddModal} className="btn btn-primary">
          <Plus size={18} />
          <span>Nuevo Registro</span>
        </button>
      </div>

      {/* Filter Controls */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px', flexWrap: 'wrap' }}>
        
        {/* Search */}
        <div style={{ position: 'relative', flex: 1, minWidth: '200px' }}>
          <Search size={17} color="var(--text-muted)" style={{ position: 'absolute', left: '16px', top: '17px' }} />
          <input
            type="text"
            className="input-field"
            style={{ paddingLeft: '44px' }}
            placeholder="Buscar concepto o categoría..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        {/* Type Filter */}
        <div style={{ display: 'flex', background: 'var(--elevated)', boxShadow: 'var(--shadow-inset)', padding: '4px', borderRadius: 'var(--radius-md)' }}>
          {[
            { id: 'all', label: 'Todos' },
            { id: 'expense', label: 'Gastos' },
            { id: 'income', label: 'Ingresos' }
          ].map(type => (
            <button
              key={type.id}
              onClick={() => setFilterType(type.id)}
              style={segmentedBtn(filterType === type.id)}
            >
              {type.label}
            </button>
          ))}
        </div>

        {/* Date Filter */}
        <NeoSelect
          value={filterDate}
          onChange={setFilterDate}
          options={[
            { value: 'all', label: 'Todas las Fechas' },
            { value: 'today', label: 'Hoy' },
            { value: 'week', label: 'Últimos 7 días' },
            { value: 'month', label: 'Este Mes' }
          ]}
          ariaLabel="Filtrar por fecha"
          style={{ width: 'auto', minWidth: '190px' }}
        />

      </div>

      {/* Transaction List */}
      {filteredTransactions.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '34px 0', color: 'var(--text-muted)', fontSize: '0.95rem', fontWeight: 500 }}>
          No hay transacciones registradas con los filtros actuales.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          {filteredTransactions.map((t) => (
            <div key={t.id} className="tx-item-card">
              
              {/* Row 1: Icon + Title & Amount */}
              <div className="tx-row-top">
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flex: 1, minWidth: 0 }}>
                  <span className={`icon-chip ${t.type === 'income' ? 'icon-chip-positive' : 'icon-chip-negative'}`} style={{ width: '40px', height: '40px' }}>
                    {t.type === 'income' ? <ArrowUpCircle size={20} /> : <ArrowDownCircle size={20} />}
                  </span>
                  <h3 className="tx-title">
                    {t.description}
                  </h3>
                </div>

                <span className={`tx-amount ${t.type === 'income' ? 'tx-amount-positive' : 'tx-amount-negative'}`}>
                  {t.type === 'income' ? '+' : '-'} {currency} {t.amount.toFixed(2)}
                </span>
              </div>

              {/* Row 2: Category Badge, Date & Action Buttons */}
              <div className="tx-row-bottom">
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                  <span className={`badge ${t.type === 'income' ? 'badge-positive' : 'badge-negative'}`}>
                    {t.category}
                  </span>
                  {t.recurring && (
                    <span className="badge badge-ia" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }} title="Se repite cada mes">
                      <Repeat size={11} /> Recurrente
                    </span>
                  )}
                  <span className="metric-hint" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', marginTop: 0 }}>
                    <Calendar size={12} /> {t.date}
                  </span>
                </div>

                <div style={{ display: 'flex', gap: '4px', marginLeft: 'auto' }}>
                  <button
                    onClick={() => handleOpenEditModal(t)}
                    className="btn-icon"
                    style={{ minHeight: '36px', minWidth: '36px', padding: '4px' }}
                    aria-label="Editar transacción"
                    title="Editar"
                  >
                    <Edit3 size={15} />
                  </button>
                  <button
                    onClick={() => deleteTransaction(t.id)}
                    className="btn-icon"
                    style={{ minHeight: '36px', minWidth: '36px', padding: '4px', color: 'var(--negative)' }}
                    aria-label="Eliminar transacción"
                    title="Eliminar"
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              </div>

            </div>
          ))}
        </div>
      )}

      {/* Add / Edit Modal Sheet */}
      {isModalOpen && (
        <div className="mobile-modal-sheet">
          <div className="modal-card">
            <button
              onClick={() => setIsModalOpen(false)}
              className="btn-icon"
              style={{ position: 'absolute', right: '14px', top: '14px' }}
              aria-label="Cerrar"
            >
              <X size={22} />
            </button>

            <h3 style={{ fontSize: '1.3rem', fontWeight: 800, marginBottom: '18px', color: 'var(--text-main)' }}>
              {editingId ? 'Editar Transacción' : 'Nuevo Registro Manual'}
            </h3>

            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {/* Type Switcher */}
              <div style={{ display: 'flex', gap: '12px' }}>
                <button
                  type="button"
                  onClick={() => setFormData({ ...formData, type: 'expense' })}
                  className="btn"
                  style={{
                    flex: 1,
                    minHeight: '50px',
                    background: formData.type === 'expense' ? 'var(--negative-soft)' : 'var(--elevated)',
                    color: formData.type === 'expense' ? 'var(--negative)' : 'var(--text-muted)',
                    boxShadow: formData.type === 'expense' ? 'var(--shadow-inset)' : 'var(--shadow-raised)'
                  }}
                >
                  Gasto
                </button>
                <button
                  type="button"
                  onClick={() => setFormData({ ...formData, type: 'income' })}
                  className="btn"
                  style={{
                    flex: 1,
                    minHeight: '50px',
                    background: formData.type === 'income' ? 'var(--positive-soft)' : 'var(--elevated)',
                    color: formData.type === 'income' ? 'var(--positive)' : 'var(--text-muted)',
                    boxShadow: formData.type === 'income' ? 'var(--shadow-inset)' : 'var(--shadow-raised)'
                  }}
                >
                  Ingreso
                </button>
              </div>

              {/* Amount */}
              <div>
                <label className="field-label">Monto ({currency})</label>
                <input
                  type="number"
                  step="0.01"
                  className="input-field"
                  placeholder="0.00"
                  required
                  value={formData.amount}
                  onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                />
              </div>

              {/* Description */}
              <div>
                <label className="field-label">Descripción / Concepto</label>
                <input
                  type="text"
                  className="input-field"
                  placeholder="Ej: Galletas, Gasolina..."
                  required
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                />
              </div>

              {/* Category */}
              <div>
                <label className="field-label">Categoría</label>
                <NeoSelect
                  value={formData.category}
                  onChange={(opt) => setFormData({ ...formData, category: opt })}
                  options={DEFAULT_CATEGORIES}
                  ariaLabel="Elegir categoría"
                />
              </div>

              {/* Date */}
              <div>
                <label className="field-label">Fecha</label>
                <input
                  type="date"
                  className="input-field"
                  required
                  value={formData.date}
                  onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                />
              </div>

              {/* Recurring toggle */}
              <button
                type="button"
                onClick={() => setFormData({ ...formData, recurring: !formData.recurring })}
                role="switch"
                aria-checked={formData.recurring}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  padding: '14px 16px',
                  borderRadius: 'var(--radius-md)',
                  background: formData.recurring ? 'var(--positive-soft)' : 'var(--elevated)',
                  boxShadow: formData.recurring ? 'var(--shadow-inset)' : 'var(--shadow-raised)',
                  border: 'none',
                  cursor: 'pointer',
                  textAlign: 'left'
                }}
              >
                <Repeat size={18} color={formData.recurring ? 'var(--positive)' : 'var(--text-muted)'} />
                <span style={{ flex: 1, fontWeight: 700, fontSize: '0.9rem', color: 'var(--text-main)' }}>
                  Se repite cada mes
                </span>
                <span
                  style={{
                    width: '44px',
                    height: '26px',
                    borderRadius: '13px',
                    background: formData.recurring ? 'var(--positive)' : 'var(--text-muted)',
                    opacity: 0.9,
                    position: 'relative',
                    transition: 'background 0.2s var(--ease-smooth)'
                  }}
                >
                  <span
                    style={{
                      position: 'absolute',
                      top: '3px',
                      left: formData.recurring ? '21px' : '3px',
                      width: '20px',
                      height: '20px',
                      borderRadius: '50%',
                      background: 'var(--bg-main)',
                      transition: 'left 0.2s var(--ease-smooth)'
                    }}
                  />
                </span>
              </button>

              {/* Action Buttons */}
              <div style={{ display: 'flex', gap: '12px', marginTop: '6px' }}>
                <button type="button" onClick={() => setIsModalOpen(false)} className="btn btn-secondary" style={{ flex: 1 }}>
                  Cancelar
                </button>
                <button type="submit" className="btn btn-primary" style={{ flex: 1 }}>
                  {editingId ? 'Guardar Cambios' : 'Registrar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
