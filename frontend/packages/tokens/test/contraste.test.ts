// Confere os pares de contraste do docs/DESIGN_SYSTEM.md em cada tema, como o scripts/wcag_contrast.py.
import { describe, expect, it } from 'vitest';
import { tokens, type Tema } from '../dist/tokens.ts';

function canal(c: number): number {
  const s = c / 255;
  return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
}

function luminancia(hex: string): number {
  const m = /^#([0-9a-f]{6})$/i.exec(hex);
  if (!m?.[1]) throw new Error(`cor inválida: ${hex}`);
  const n = parseInt(m[1], 16);
  return 0.2126 * canal((n >> 16) & 255) + 0.7152 * canal((n >> 8) & 255) + 0.0722 * canal(n & 255);
}

export function contraste(a: string, b: string): number {
  const [x, y] = [luminancia(a), luminancia(b)].sort((p, q) => q - p) as [number, number];
  return (x + 0.05) / (y + 0.05);
}

const CATEGORIAS = ['verde', 'amarelo', 'azul', 'laranja', 'vermelho', 'preto'] as const;

const TEXTO = [
  'color-text',
  'color-text-muted',
  'color-brand',
  'color-feedback-error',
  'color-feedback-success',
  // rótulo da categoria escrito na cor dela (DESIGN_SYSTEM.md §3)
  ...CATEGORIAS.map((c) => `color-category-${c}-ink` as const),
  'color-alert-border',
] as const;

const NAO_TEXTUAL = [
  'color-border-strong',
  'color-focus',
  'color-category-preto-ring',
  ...CATEGORIAS.filter((c) => c !== 'preto').map((c) => `color-category-${c}-fill` as const),
] as const;

describe.each<Tema>(['light', 'dark'])('tema %s', (tema) => {
  const t = tokens[tema];

  it.each(TEXTO)('%s tem 4,5:1 contra o fundo (WCAG 1.4.3)', (nome) => {
    expect(contraste(t[nome], t['color-bg'])).toBeGreaterThanOrEqual(4.5);
  });

  it.each(NAO_TEXTUAL)('%s tem 3:1 contra o fundo (WCAG 1.4.11)', (nome) => {
    expect(contraste(t[nome], t['color-bg'])).toBeGreaterThanOrEqual(3);
  });

  it('o texto do botão principal tem 4,5:1 (carvão sobre laranja, nunca branco)', () => {
    expect(contraste(t['color-on-primary'], t['color-primary'])).toBeGreaterThanOrEqual(4.5);
  });

  it.each(CATEGORIAS)('o glifo da bolinha %s tem 3:1 contra o preenchimento (WCAG 1.4.11)', (c) => {
    expect(contraste(t[`color-category-${c}-glyph`], t[`color-category-${c}-fill`])).toBeGreaterThanOrEqual(3);
  });

  it.each(['livre', '12', '16', '18', 'sensivel'] as const)('o chip de classificação %s tem 4,5:1', (r) => {
    expect(contraste(t['color-rating-ink'], t[`color-rating-${r}`])).toBeGreaterThanOrEqual(4.5);
  });

  it('a faixa hazard: texto escuro sobre a listra laranja com 4,5:1', () => {
    expect(contraste(t['color-alert-hazard-ink'], t['color-alert-hazard'])).toBeGreaterThanOrEqual(4.5);
  });
});

describe('temas', () => {
  it('claro e escuro têm os mesmos tokens', () => {
    expect(Object.keys(tokens.dark).sort()).toEqual(Object.keys(tokens.light).sort());
  });

  it('o fundo é o do DESIGN_SYSTEM.md', () => {
    expect(tokens.dark['color-bg']).toBe('#17120D');
    expect(tokens.light['color-bg']).toBe('#FFFFFF');
  });

  it('o QR code do 2FA é escuro sobre claro nos dois temas (21:1)', () => {
    expect(contraste(tokens.base['color-qr-dark'], tokens.base['color-qr-light'])).toBeGreaterThanOrEqual(21);
  });

  it('PRETO tem anel claro no tema escuro (o preto sozinho dá 1,06:1)', () => {
    expect(contraste(tokens.dark['color-category-preto-fill'], tokens.dark['color-bg'])).toBeLessThan(1.1);
    expect(contraste(tokens.dark['color-category-preto-ring'], tokens.dark['color-bg'])).toBeGreaterThan(12);
  });

  it('o laranja da marca é #FF6A2B e vira #C2410C como texto no tema claro', () => {
    expect(tokens.dark['color-brand']).toBe('#FF6A2B');
    expect(tokens.light['color-brand']).toBe('#C2410C');
  });
});
