import { describe, expect, it } from 'vitest';
import { activeFilterCount, EMPTY_FILTERS, feedBySlug, feedHref, filtersToParams, parseFilters } from './feeds';

describe('feeds na URL (OS-31)', () => {
  it('slug ↔ tipo', () => {
    expect(feedBySlug('alertas')?.type).toBe('ALERT');
    expect(feedBySlug('xyz')).toBeNull();
    expect(feedHref('PROFILE')).toBe('/?feed=perfis');
  });
});

describe('filtros dos 6 eixos (OS-35)', () => {
  it('lê só valores válidos e normaliza', () => {
    const f = parseFilters(new URLSearchParams('cat=VERDE&cat=ROXO&cat=VERDE&cat=PRETO&tipo=IMAGE&raio=25&pais=br&cidade= Curitiba &nome=ana'));
    expect(f).toEqual({ categories: ['VERDE', 'PRETO'], media: 'IMAGE', radiusKm: 25, country: 'BR', city: 'Curitiba', name: 'ana' });
    expect(activeFilterCount(f)).toBe(6);
    expect(parseFilters(new URLSearchParams('raio=7&tipo=GIF')).radiusKm).toBeNull();
  });

  it('volta para a URL mantendo o feed e limpando o resto', () => {
    const p = filtersToParams({ ...EMPTY_FILTERS, categories: ['AZUL'], city: 'Recife' }, new URLSearchParams('feed=posts&nome=x'));
    expect(p.toString()).toBe('feed=posts&cat=AZUL&cidade=Recife');
    expect(activeFilterCount(EMPTY_FILTERS)).toBe(0);
  });
});
