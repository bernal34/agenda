import { tokens, type Tokens } from '../../constants/theme';
import { statusColor, statusTint } from '../statusColor';

const t = tokens as Tokens;

describe('statusColor', () => {
  it('mapea los códigos default', () => {
    expect(statusColor(t, 'todo')).toBe(t.status.todo);
    expect(statusColor(t, 'in_progress')).toBe(t.status.progress);
    expect(statusColor(t, 'in_review')).toBe(t.status.review);
    expect(statusColor(t, 'done')).toBe(t.status.done);
  });

  it('cae en neutro con una etapa personalizada', () => {
    expect(statusColor(t, 'en_espera_proveedor')).toBe(t.status.todo);
    expect(statusColor(t, '')).toBe(t.status.todo);
  });
});

describe('statusTint', () => {
  it('devuelve siempre un color válido de 9 caracteres', () => {
    expect(statusTint(t, 'done')).toBe(t.status.done + '22');
    // El caso que rompía: sin fallback esto era la cadena "undefined22".
    expect(statusTint(t, 'etapa_rara')).toMatch(/^#[0-9A-Fa-f]{6}22$/);
  });
});
