import type { FrameCatalog } from '@orange-social/api';
import { describe, expect, it } from 'vitest';
import catalogJson from '../e2e/fixtures/catalogo-molduras.json';
import {
  DEFAULT_FRAME,
  applyStudio,
  artSources,
  bestInk,
  containerOf,
  contrastRatio,
  artCss,
  confeteArt,
  eclipseArt,
  formatRatio,
  fromConfig,
  previewBackground,
  seasonGradient,
  softerInk,
  toConfig,
  validateFrame,
  type FrameState,
} from './frame';

const catalog = catalogJson as unknown as FrameCatalog;
const start = (): FrameState => structuredClone(DEFAULT_FRAME);

describe('contraste (o mesmo do Contrast.java)', () => {
  it('razão e formato com vírgula', () => {
    expect(formatRatio(contrastRatio('#F5EDE3', '#2A2119'))).toBe('13,6:1');
    expect(formatRatio(contrastRatio('#17120D', '#FF6A2B'))).toBe('6,5:1');
    expect(formatRatio(4.5)).toBe('4,5:1');
    expect(formatRatio(4.45)).toBe('4,5:1');
    expect(formatRatio(contrastRatio('#FFFFFF', '#FFFFFF'))).toBe('1,0:1');
  });

  it('tinta automática: a clara em fundo escuro, a escura em fundo claro', () => {
    expect(bestInk('#2A2119')).toBe('#F5EDE3');
    expect(bestInk('#F5EDE3')).toBe('#17120D');
    expect(bestInk('#FF6A2B')).toBe('#17120D');
    expect(bestInk('#808080')).toBe('#17120D');
  });

  it('tom secundário chega ao mínimo pedido', () => {
    const t2 = softerInk('#F5EDE3', '#2A2119', 0.5, 4.5);
    expect(contrastRatio(t2, '#2A2119')).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio(t2, '#2A2119')).toBeLessThan(contrastRatio('#F5EDE3', '#2A2119'));
  });
});

describe('uma fonte de arte por vez', () => {
  it('cor → gradiente → cartela → aura → Aura Plus: cada escolha tira a anterior e avisa', () => {
    let r = applyStudio(start(), { type: 'color', id: '#3b1f33' }, catalog);
    expect(r.state.color).toBe('#3B1F33');
    expect(r.notice).toBeNull();

    r = applyStudio(r.state, { type: 'gradient', id: 'por-do-sol' }, catalog);
    expect(r.state).toMatchObject({ color: null, gradientId: 'por-do-sol' });
    expect(r.notice).toBe('Uma arte por vez: a cor Ameixa saiu.');

    r = applyStudio(r.state, { type: 'season', presetId: null, auto: true }, catalog);
    expect(r.state).toMatchObject({ gradientId: null, seasonal: { presetId: null, auto: true } });
    expect(r.notice).toBe('Uma arte por vez: o gradiente Pôr do sol saiu.');

    r = applyStudio(r.state, { type: 'aura', id: 'varanda' }, catalog);
    expect(r.state.seasonal).toEqual({ presetId: null, auto: false });
    expect(r.state.aura).toEqual({ presetId: 'varanda', variantId: 'ORIGINAL', format: 'IMAGEM_UNICA' });
    expect(artSources(r.state)).toBe(1);

    r = applyStudio(r.state, { type: 'auraFormat', format: 'MOSAICO' }, catalog);
    r = applyStudio(r.state, { type: 'aura', id: 'mare' }, catalog);
    expect(r.state.aura).toEqual({ presetId: 'mare', variantId: 'ORIGINAL', format: 'MOSAICO' });

    r = applyStudio(r.state, { type: 'auraPlus', id: 'brasa' }, catalog);
    expect(r.state).toMatchObject({ aura: null, auraPlusId: 'brasa' });
    expect(r.notice).toBe('Uma arte por vez: a aura Maré saiu.');
    expect(artSources(r.state)).toBe(1);
  });

  it('cartela escolhida e automática não convivem', () => {
    let s = applyStudio(start(), { type: 'season', presetId: 'natal', auto: false }, catalog).state;
    expect(s.seasonal).toEqual({ presetId: 'natal', auto: false });
    s = applyStudio(s, { type: 'season', presetId: 'natal', auto: true }, catalog).state;
    expect(s.seasonal).toEqual({ presetId: null, auto: true });
  });

  it('Aura Hype e Metamorfose não são arte: convivem com a aura', () => {
    let s = applyStudio(start(), { type: 'aura', id: 'eclipse' }, catalog).state;
    s = applyStudio(s, { type: 'hype', style: 'SCANNER' }, catalog).state;
    s = applyStudio(s, { type: 'metamorphose', mode: 'PRISMA' }, catalog).state;
    expect(s).toMatchObject({ auraHypeStyle: 'SCANNER', metamorphose: 'PRISMA', aura: { presetId: 'eclipse' } });
    expect(validateFrame(s, catalog, 'POST')).toEqual([]);
  });
});

describe('layout Pôster (arte própria)', () => {
  it('limpa a arte, o material e a Metamorfose e explica numa frase', () => {
    let s = applyStudio(start(), { type: 'aura', id: 'confete' }, catalog).state;
    s = applyStudio(s, { type: 'material', id: 'cetim' }, catalog).state;
    s = applyStudio(s, { type: 'metamorphose', mode: 'HOLOGRAFIA' }, catalog).state;
    const r = applyStudio(s, { type: 'layout', id: 'POSTER' }, catalog);
    expect(r.state).toMatchObject({ layoutId: 'POSTER', aura: null, materialId: null, metamorphose: 'OFF', auraPlusId: null });
    expect(r.notice).toBe('Pôster já traz arte própria: a aura Confete, o material Cetim e a Metamorfose saíram.');
    expect(validateFrame(r.state, catalog, 'POST')).toEqual([]);
  });

  it('escolher arte, material ou Metamorfose no Pôster volta o layout para Clássico', () => {
    const poster = applyStudio(start(), { type: 'layout', id: 'POSTER' }, catalog).state;
    const r = applyStudio(poster, { type: 'gradient', id: 'mate' }, catalog);
    expect(r.state).toMatchObject({ layoutId: 'CLASSICO', gradientId: 'mate' });
    expect(r.notice).toBe('O layout voltou para Clássico: Pôster já traz arte própria.');
    expect(applyStudio(poster, { type: 'material', id: 'vidro' }, catalog).state.layoutId).toBe('CLASSICO');
    expect(applyStudio(poster, { type: 'metamorphose', mode: 'PRISMA' }, catalog).state.layoutId).toBe('CLASSICO');
    expect(applyStudio(poster, { type: 'auraPlus', id: 'aurora' }, catalog).state.layoutId).toBe('CLASSICO');
  });

  it('a validação recusa o que o servidor recusa', () => {
    const bad: FrameState = { ...start(), color: '#2B2217', gradientId: 'uva', layoutId: 'POSTER', materialId: 'metal' };
    expect(validateFrame(bad, catalog, 'POST')).toEqual([
      'Escolha uma única arte para a moldura: cor, gradiente, cartela, aura, Aura Plus ou arte própria.',
      'O layout Pôster já traz arte própria: não combina com outra arte, material ou Metamorfose.',
    ]);
  });
});

describe('container e contraste', () => {
  it('AUTO usa a melhor tinta sobre a cor da skin ou a escolhida', () => {
    expect(containerOf(start(), catalog)).toMatchObject({ color: '#211A12', ink: '#F5EDE3', ok: true });
    const laranja = applyStudio(start(), { type: 'containerColor', color: '#FF6A2B' }, catalog).state;
    expect(containerOf(laranja, catalog)).toMatchObject({ ink: '#17120D', contrast: '6,5:1', ok: true });
  });

  it('tinta fixa com menos de 4,5:1 avisa e sugere a que passa', () => {
    let s = applyStudio(start(), { type: 'containerColor', color: '#E9C46A' }, catalog).state;
    s = applyStudio(s, { type: 'ink', ink: '#F5EDE3' }, catalog).state;
    const c = containerOf(s, catalog);
    expect(c).toMatchObject({ ok: false, contrast: '1,4:1', suggestion: '#17120D' });
    expect(validateFrame(s, catalog, 'POST')).toEqual([
      `Texto com contraste 1,4:1 sobre o container (mínimo 4,5:1). Sugestão: tinta #17120D (${c.suggestionContrast}).`,
    ]);
  });

  it('alerta oficial não tem moldura', () => {
    const s = applyStudio(start(), { type: 'color', id: '#2B2217' }, catalog).state;
    expect(validateFrame(s, catalog, 'ALERT')).toEqual([
      'Alertas oficiais não têm moldura: a faixa de alerta precisa ser reconhecida na hora.',
    ]);
    expect(validateFrame(start(), catalog, 'ALERT')).toEqual([]);
  });
});

describe('configuração enviada e prévia', () => {
  it('padrão vira null; só as chaves escolhidas vão no background', () => {
    expect(toConfig(start())).toBeNull();
    let s = applyStudio(start(), { type: 'aura', id: 'asfalto' }, catalog).state;
    s = applyStudio(s, { type: 'ink', ink: 'AUTO' }, catalog).state;
    s = applyStudio(s, { type: 'animation', id: 'DERIVA' }, catalog).state;
    s = applyStudio(s, { type: 'hype', style: 'BRILHO' }, catalog).state;
    expect(toConfig(s)).toEqual({
      v: 1,
      aura: { presetId: 'asfalto', variantId: 'ORIGINAL', format: 'IMAGEM_UNICA' },
      animationId: 'DERIVA',
      auraHypeStyle: 'BRILHO',
    });
    expect(fromConfig(toConfig(s))).toEqual(s);
  });

  it('a forma canônica do servidor volta para o mesmo estado', () => {
    const canonical = {
      v: 1 as const,
      color: null,
      gradientId: 'oceano',
      seasonal: { presetId: null, auto: false },
      animationId: 'NONE',
      aura: null,
      auraPlusId: null,
      auraHypeStyle: 'OFF' as const,
      metamorphose: { mode: 'OFF' as const, presetId: null },
      materialId: 'vidro',
      customArt: null,
      layoutId: 'POLAROID' as const,
      skinId: 'PADRAO',
      container: { color: '#F5EDE3', ink: 'AUTO' },
    };
    expect(toConfig(fromConfig(canonical))).toEqual({ v: 1, gradientId: 'oceano', materialId: 'vidro', layoutId: 'POLAROID', container: { color: '#F5EDE3' } });
  });

  it('cartela: o mesmo gradiente do BackgroundService (135°, paradas inteiras)', () => {
    expect(seasonGradient(['#A', '#B', '#C'].map((c) => c.padEnd(7, '0')))).toBe('linear-gradient(135deg,#A00000 0%,#B00000 50%,#C00000 100%)');
    const auto = applyStudio(start(), { type: 'season', presetId: null, auto: true }, catalog).state;
    const bg = previewBackground(auto, catalog)!;
    expect(bg).toMatchObject({ artKind: 'SEASONAL', artId: 'outubro-rosa' });
    expect(bg.css).toBe('linear-gradient(135deg,#F48FB1 0%,#EC407A 25%,#AD1457 50%,#FCE4EC 75%,#6D2C4A 100%)');
    expect(previewBackground(applyStudio(start(), { type: 'layout', id: 'POSTER' }, catalog).state, catalog)).toMatchObject({
      artKind: 'LAYOUT',
      artId: 'POSTER',
      css: null,
    });
  });

  it('Aura Plus: vídeo + pôster do catálogo, tocando no máximo 5 s', () => {
    const bg = previewBackground(applyStudio(start(), { type: 'auraPlus', id: 'brasa' }, catalog).state, catalog)!;
    expect(bg).toMatchObject({ artKind: 'AURA_PLUS', artId: 'brasa', auraPlus: { poster: '/brand/auras/brasa-poster.webp', maxPlaySeconds: 5 } });
    expect(artCss(bg, 'x')).toContain('brasa-poster.webp');
  });

  it('Eclipse e Confete são gerados no cliente e sempre iguais para o mesmo post', () => {
    for (const art of [eclipseArt, confeteArt]) {
      const a = art(['#7B2FF7', '#4A93FF'], 'post-1');
      expect(a).toBe(art(['#7B2FF7', '#4A93FF'], 'post-1'));
      expect(a).not.toBe(art(['#7B2FF7', '#4A93FF'], 'post-2'));
      expect(a).toMatch(/url\("data:image\/svg\+xml,/);
    }
  });
});
