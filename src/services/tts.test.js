import { describe, expect, it } from 'vitest';
import { speakify } from './tts';

describe('speakify', () => {
  it('convierte S/. en orden natural: 100 soles', () => {
    expect(speakify('S/. 100.00')).toBe('100 soles');
    expect(speakify('gastaste S/. 20.00')).toBe('gastaste 20 soles');
  });

  it('maneja variantes de S/ (sin punto, minúscula, espacios)', () => {
    expect(speakify('S/ 20 extra')).toBe('20 soles extra');
    expect(speakify('s/. 45.50')).toBe('45 soles');
    expect(speakify('S / . 100')).toBe('100 soles');
    expect(speakify('S/20 directo')).toBe('20 soles directo');
  });

  it('convierte $ y €', () => {
    expect(speakify('Gasto de $ 12.00 y € 30.00')).toBe('Gasto de 12 dólares y 30 euros');
  });

  it('deja la palabra "soles" cuando ya está en orden natural', () => {
    expect(speakify('saldo soles 1424')).toBe('saldo soles 1424');
  });

  it('lee un balance completo con varios montos', () => {
    const out = speakify('Balance: ingresos S/. 1,500.00, gastos S/. 75.50, saldo S/. 1,424.50.');
    expect(out).toBe('Balance: ingresos 1500 soles, gastos 75 soles, saldo 1424 soles.');
  });

  it('elimina markdown', () => {
    expect(speakify('**Transporte:** gastaste S/. 400.00')).toBe('Transporte: gastaste 400 soles');
  });

  it('elimina emojis', () => {
    expect(speakify('gastaste S/. 400.00 💰🎉')).toBe('gastaste 400 soles');
  });

  it('no altera correcciones ni texto plano', () => {
    expect(speakify('No era 30, era 40')).toBe('No era 30, era 40');
    expect(speakify('')).toBe('');
  });
});
