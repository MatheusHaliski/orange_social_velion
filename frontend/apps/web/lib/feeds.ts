// Os 4 feeds do Segmented Switcher (OS-31) e a barra de filtros dos 6 eixos (OS-35): o estado fica na URL
// (/?feed=posts&cat=VERDE&cat=AZUL&tipo=IMAGE&pais=BR&cidade=Curitiba&nome=ana&raio=25), então dá para voltar,
// recarregar e compartilhar a busca.
import type { CategoryCode, FeedType, MediaKind } from '@orange-social/api';
import { isCategoryCode } from './categories';

export interface FeedInfo {
  type: FeedType;
  /** Valor na URL (?feed=…). */
  slug: string;
  label: string;
}

export const FEEDS: readonly FeedInfo[] = [
  { type: 'PROFILE', slug: 'perfis', label: 'Perfis' },
  { type: 'POST', slug: 'posts', label: 'Posts' },
  { type: 'AUDIO', slug: 'audio', label: 'Áudio' },
  { type: 'ALERT', slug: 'alertas', label: 'Alertas' },
];

export function feedBySlug(slug: string | null | undefined): FeedInfo | null {
  return FEEDS.find((f) => f.slug === slug) ?? null;
}

export function feedInfo(type: FeedType): FeedInfo {
  return FEEDS.find((f) => f.type === type) ?? FEEDS[1]!;
}

export function feedHref(type: FeedType): string {
  return `/?feed=${feedInfo(type).slug}`;
}

/** Raios do eixo "Local" (perto de mim). */
export const RADII = [10, 25, 50, 100] as const;

/** Os 6 eixos: Categoria, Tipo, Local, País, Cidade e Nome. */
export interface FeedFilters {
  categories: CategoryCode[];
  media: MediaKind | null;
  /** Raio em km a partir da localização do aparelho; null = sem filtro de local. */
  radiusKm: number | null;
  country: string;
  city: string;
  name: string;
}

export const EMPTY_FILTERS: FeedFilters = { categories: [], media: null, radiusKm: null, country: '', city: '', name: '' };

const MEDIA: MediaKind[] = ['TEXT', 'IMAGE', 'VIDEO', 'AUDIO'];

export function parseFilters(params: URLSearchParams): FeedFilters {
  const radius = Number(params.get('raio'));
  const media = params.get('tipo');
  return {
    categories: [...new Set(params.getAll('cat').filter(isCategoryCode))],
    media: media && (MEDIA as string[]).includes(media) ? (media as MediaKind) : null,
    radiusKm: (RADII as readonly number[]).includes(radius) ? radius : null,
    country: (params.get('pais') ?? '').trim().toUpperCase().slice(0, 2),
    city: (params.get('cidade') ?? '').trim().slice(0, 120),
    name: (params.get('nome') ?? '').trim().slice(0, 80),
  };
}

/** Filtros → query string da tela (sem o feed). */
export function filtersToParams(f: FeedFilters, base: URLSearchParams = new URLSearchParams()): URLSearchParams {
  const p = new URLSearchParams(base);
  for (const k of ['cat', 'tipo', 'raio', 'pais', 'cidade', 'nome']) p.delete(k);
  f.categories.forEach((c) => p.append('cat', c));
  if (f.media) p.set('tipo', f.media);
  if (f.radiusKm) p.set('raio', String(f.radiusKm));
  if (f.country) p.set('pais', f.country);
  if (f.city) p.set('cidade', f.city);
  if (f.name) p.set('nome', f.name);
  return p;
}

export function activeFilterCount(f: FeedFilters): number {
  return (f.categories.length ? 1 : 0) + (f.media ? 1 : 0) + (f.radiusKm ? 1 : 0) + (f.country ? 1 : 0) + (f.city ? 1 : 0) + (f.name ? 1 : 0);
}
