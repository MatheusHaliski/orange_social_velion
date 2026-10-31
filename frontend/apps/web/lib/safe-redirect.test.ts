import { describe, expect, it } from 'vitest';
import { loginHref, safeRedirect } from './safe-redirect';

describe('safeRedirect', () => {
  it.each([
    ['/lugares/1', '/lugares/1'],
    ['/conta?x=1', '/conta?x=1'],
    ['//exemplo.com', '/'],
    ['/\\exemplo.com', '/'],
    ['https://exemplo.com', '/'],
    ['javascript:alert(1)', '/'],
    [null, '/'],
  ])('%s → %s', (input, out) => {
    expect(safeRedirect(input)).toBe(out);
  });

  it('monta o link de login com voltar', () => {
    expect(loginHref('/lugares/18')).toBe('/entrar?voltar=%2Flugares%2F18');
  });
});
