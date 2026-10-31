import { afterEach, describe, expect, it } from 'vitest';
import { applyFontScale } from './font-scale';

describe('applyFontScale', () => {
  afterEach(() => applyFontScale(null));

  it('aplica a escala salva na raiz', () => {
    applyFontScale(120);
    expect(document.documentElement.style.fontSize).toBe('120%');
  });

  it('volta ao tamanho do navegador sem conta ou em 100 %', () => {
    applyFontScale(130);
    applyFontScale(100);
    expect(document.documentElement.style.fontSize).toBe('');
    applyFontScale(130);
    applyFontScale(null);
    expect(document.documentElement.style.fontSize).toBe('');
  });

  it('respeita os limites de 85 % a 150 %', () => {
    applyFontScale(300);
    expect(document.documentElement.style.fontSize).toBe('150%');
    applyFontScale(10);
    expect(document.documentElement.style.fontSize).toBe('85%');
    applyFontScale(Number.NaN);
    expect(document.documentElement.style.fontSize).toBe('');
  });
});
