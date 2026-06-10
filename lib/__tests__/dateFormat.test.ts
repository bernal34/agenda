import { dmyToIso, isoToDmy, isValidDmy } from '../dateFormat';

describe('isoToDmy', () => {
  it('convierte ISO a DD/MM/YYYY', () => {
    expect(isoToDmy('2026-03-05')).toBe('05/03/2026');
    expect(isoToDmy('2026-12-31')).toBe('31/12/2026');
  });

  it('devuelve vacío para null/undefined/vacío', () => {
    expect(isoToDmy(null)).toBe('');
    expect(isoToDmy(undefined)).toBe('');
    expect(isoToDmy('')).toBe('');
  });

  it('devuelve el input intacto si no es ISO', () => {
    expect(isoToDmy('31/12/2026')).toBe('31/12/2026');
    expect(isoToDmy('no es fecha')).toBe('no es fecha');
  });
});

describe('dmyToIso', () => {
  it('convierte DD/MM/YYYY a ISO', () => {
    expect(dmyToIso('05/03/2026')).toBe('2026-03-05');
    expect(dmyToIso('31/12/2026')).toBe('2026-12-31');
  });

  it('agrega ceros a día y mes de un dígito', () => {
    expect(dmyToIso('5/3/2026')).toBe('2026-03-05');
    expect(dmyToIso('1/1/2026')).toBe('2026-01-01');
  });

  it('tolera espacios alrededor', () => {
    expect(dmyToIso('  5/3/2026  ')).toBe('2026-03-05');
  });

  it('devuelve null para null/undefined/vacío', () => {
    expect(dmyToIso(null)).toBeNull();
    expect(dmyToIso(undefined)).toBeNull();
    expect(dmyToIso('')).toBeNull();
  });

  it('devuelve null para formatos inválidos', () => {
    expect(dmyToIso('2026-03-05')).toBeNull();
    expect(dmyToIso('5-3-2026')).toBeNull();
    expect(dmyToIso('5/3/26')).toBeNull();
    expect(dmyToIso('basura')).toBeNull();
  });

  it('hace round-trip con isoToDmy', () => {
    expect(dmyToIso(isoToDmy('2026-07-09'))).toBe('2026-07-09');
    expect(isoToDmy(dmyToIso('09/07/2026')!)).toBe('09/07/2026');
  });
});

describe('isValidDmy', () => {
  it('acepta vacío (sin fecha)', () => {
    expect(isValidDmy('')).toBe(true);
  });

  it('acepta fechas reales', () => {
    expect(isValidDmy('31/12/2026')).toBe(true);
    expect(isValidDmy('29/02/2024')).toBe(true); // bisiesto
    expect(isValidDmy('1/1/2026')).toBe(true);
  });

  it('rechaza formatos inválidos', () => {
    expect(isValidDmy('2026-12-31')).toBe(false);
    expect(isValidDmy('31/12')).toBe(false);
    expect(isValidDmy('basura')).toBe(false);
  });

  it('rechaza fechas imposibles (Date desborda, no debe pasar)', () => {
    expect(isValidDmy('31/02/2026')).toBe(false);
    expect(isValidDmy('29/02/2026')).toBe(false); // no bisiesto
    expect(isValidDmy('31/04/2026')).toBe(false);
    expect(isValidDmy('00/01/2026')).toBe(false);
    expect(isValidDmy('15/13/2026')).toBe(false);
  });
});
