import { describe, expect, it } from 'vitest';
import { ageOn, formatDecimal, formatKm, plural } from './format';

describe('formatação pt-BR', () => {
  it('uma casa decimal com vírgula', () => {
    expect(formatDecimal(4.25)).toBe('4,3');
    expect(formatDecimal(4)).toBe('4,0');
  });

  it('distância', () => {
    expect(formatKm(25)).toBe('25 km');
    expect(formatKm(1.2)).toBe('1,2 km');
  });

  it('plural', () => {
    expect(plural(1, 'curtida', 'curtidas')).toBe('1 curtida');
    expect(plural(1280, 'curtida', 'curtidas')).toBe('1.280 curtidas');
  });
});

describe('ageOn', () => {
  it('conta o aniversário', () => {
    const hoje = new Date(2026, 9, 25);
    expect(ageOn('2010-10-25', hoje)).toBe(16);
    expect(ageOn('2010-10-26', hoje)).toBe(15);
    expect(ageOn('', hoje)).toBeNull();
  });
});
