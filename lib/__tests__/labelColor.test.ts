import { colorForLabel } from '../labelColor';

describe('colorForLabel', () => {
  it('es determinista: misma etiqueta → mismo color', () => {
    expect(colorForLabel('bug')).toEqual(colorForLabel('bug'));
    expect(colorForLabel('diseño')).toEqual(colorForLabel('diseño'));
  });

  it('ignora mayúsculas/minúsculas', () => {
    expect(colorForLabel('Bug')).toEqual(colorForLabel('bug'));
    expect(colorForLabel('URGENTE')).toEqual(colorForLabel('urgente'));
  });

  it('siempre devuelve un par bg/fg válido', () => {
    const samples = ['', 'a', 'bug', 'una etiqueta larga con espacios', '🚀', 'áéíóú'];
    for (const s of samples) {
      const c = colorForLabel(s);
      expect(typeof c.bg).toBe('string');
      expect(typeof c.fg).toBe('string');
      expect(c.bg).toMatch(/^#/);
      expect(c.fg).toMatch(/^#/);
    }
  });
});
