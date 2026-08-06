import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown, Check } from 'lucide-react';

export default function NeoSelect({
  value,
  onChange,
  options = [],
  placeholder = 'Selecciona...',
  ariaLabel = 'Selecciona una opción',
  style
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  const close = () => setOpen(false);
  const list = options.map(o => (typeof o === 'object' ? o : { value: o, label: o }));
  const label = list.find(o => o.value === value)?.label ?? placeholder;

  useEffect(() => {
    if (!open) return;
    const onDocClick = (e) => {
      if (ref.current && !ref.current.contains(e.target)) close();
    };
    const onKey = (e) => {
      if (e.key === 'Escape') close();
    };
    document.addEventListener('mousedown', onDocClick);
    document.addEventListener('touchstart', onDocClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDocClick);
      document.removeEventListener('touchstart', onDocClick);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const selectOption = (opt) => {
    onChange(opt.value);
    close();
  };

  return (
    <div ref={ref} style={{ position: 'relative', ...style }}>
      <button
        type="button"
        role="combobox"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={ariaLabel}
        onClick={() => setOpen(o => !o)}
        className="neo-select__trigger"
      >
        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {label}
        </span>
        <ChevronDown
          size={18}
          color="var(--text-muted)"
          style={{
            flexShrink: 0,
            transition: 'transform 0.2s var(--ease-smooth)',
            transform: open ? 'rotate(180deg)' : 'rotate(0deg)'
          }}
        />
      </button>

      {open && (
        <ul
          role="listbox"
          aria-label={ariaLabel}
          className="neo-select__panel"
        >
          {list.map((opt, idx) => {
            const selected = opt.value === value;
            return (
              <li
                key={idx}
                role="option"
                aria-selected={selected}
                onClick={() => selectOption(opt)}
                className={`neo-select__option${selected ? ' is-selected' : ''}`}
              >
                <span style={{ flex: 1 }}>{opt.label}</span>
                {selected && <Check size={16} color="var(--positive)" />}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}