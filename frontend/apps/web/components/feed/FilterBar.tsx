'use client';

import type { MediaKind } from '@orange-social/api';
import { useId, useState, type FormEvent } from 'react';
import { CategoryDot } from '@/components/CategoryBadge';
import { IconClose, IconFilters, IconNearMe, IconSearch } from '@/components/icons';
import { CATEGORIES } from '@/lib/categories';
import { activeFilterCount, EMPTY_FILTERS, RADII, type FeedFilters } from '@/lib/feeds';
import { MEDIA_LABELS } from '@/lib/post-format';

export type FilterAxis = 'category' | 'media' | 'local' | 'country' | 'city' | 'name';

export interface Coords {
  lat: number;
  lng: number;
}

interface Props {
  filters: FeedFilters;
  onChange: (f: FeedFilters) => void;
  /** Eixos que este feed aceita (o Alert Feed não filtra por categoria nem por nome). */
  axes: FilterAxis[];
  /** Coordenadas do aparelho para o eixo Local (nunca vão para a URL). */
  coords: Coords | null;
  onCoords: (c: Coords | null) => void;
}

const MEDIA_OPTIONS: MediaKind[] = ['TEXT', 'IMAGE', 'VIDEO'];

/**
 * Barra de filtros dos 6 eixos (OS-35): Categoria (chips combináveis com cor + glifo + rótulo), Tipo, Local
 * (perto de mim), País, Cidade e Nome; "Limpar filtros" e o estado na URL. Os campos de texto aplicam ao enviar.
 */
export function FilterBar({ filters, onChange, axes, coords, onCoords }: Props) {
  const uid = useId();
  const has = (a: FilterAxis) => axes.includes(a);
  const [open, setOpen] = useState(() => !!(filters.country || filters.city || filters.name || filters.media || filters.radiusKm));
  const [geoStatus, setGeoStatus] = useState('');
  const count = activeFilterCount(filters);

  const toggleCategory = (code: FeedFilters['categories'][number]) => {
    const set = new Set(filters.categories);
    if (set.has(code)) set.delete(code);
    else set.add(code);
    onChange({ ...filters, categories: CATEGORIES.map((c) => c.code).filter((c) => set.has(c)) });
  };

  const submitText = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const data = new FormData(e.currentTarget);
    onChange({
      ...filters,
      country: String(data.get('pais') ?? '').trim().toUpperCase().slice(0, 2),
      city: String(data.get('cidade') ?? '').trim(),
      name: String(data.get('nome') ?? '').trim(),
    });
  };

  const chooseRadius = (value: string) => {
    const radiusKm = value ? Number(value) : null;
    if (!radiusKm) {
      onCoords(null);
      setGeoStatus('');
      onChange({ ...filters, radiusKm: null });
      return;
    }
    if (coords) {
      onChange({ ...filters, radiusKm });
      return;
    }
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      setGeoStatus('Este navegador não informa a localização. Use País e Cidade.');
      return;
    }
    setGeoStatus('Pedindo a sua localização ao navegador…');
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        onCoords({ lat: Number(pos.coords.latitude.toFixed(3)), lng: Number(pos.coords.longitude.toFixed(3)) });
        setGeoStatus(`Mostrando o que está a até ${radiusKm} km de você.`);
        onChange({ ...filters, radiusKm });
      },
      () => setGeoStatus('Sem permissão para usar a localização. Use País e Cidade, ou permita no navegador.'),
      { maximumAge: 10 * 60_000, timeout: 15_000 },
    );
  };

  return (
    <section aria-label="Filtros" className="grid gap-3" data-testid="filtros">
      {has('category') && (
        <fieldset className="grid gap-2">
          <legend className="mb-1 font-mono text-xs font-bold uppercase tracking-widest text-muted">Categoria</legend>
          <div className="flex flex-wrap gap-2">
            {CATEGORIES.map((c) => {
              const on = filters.categories.includes(c.code);
              return (
                <button
                  key={c.code}
                  type="button"
                  className="os-pill"
                  aria-pressed={on}
                  onClick={() => toggleCategory(c.code)}
                  data-testid={`filtro-categoria-${c.code}`}
                >
                  <CategoryDot code={c.code} size={18} />
                  {c.label}
                </button>
              );
            })}
          </div>
        </fieldset>
      )}

      <div className="flex flex-wrap items-center gap-2">
        {axes.some((a) => a !== 'category') && (
          <button type="button" className="os-btn os-btn-sm" aria-expanded={open} aria-controls={`${uid}-mais`} onClick={() => setOpen((v) => !v)}>
            <IconFilters size={16} />
            {open ? 'Menos filtros' : 'Mais filtros'}
          </button>
        )}
        {count > 0 && (
          <button
            type="button"
            className="os-btn os-btn-sm"
            onClick={() => {
              onCoords(null);
              setGeoStatus('');
              onChange(EMPTY_FILTERS);
            }}
            data-testid="limpar-filtros"
          >
            <IconClose size={16} />
            Limpar filtros ({count})
          </button>
        )}
      </div>

      <div id={`${uid}-mais`} hidden={!open} className="os-card grid gap-4 p-4">
        {(has('media') || has('local')) && (
          <div className="flex flex-wrap gap-4">
            {has('media') && (
              <div className="grid gap-1">
                <label htmlFor={`${uid}-tipo`} className="text-sm font-semibold">
                  Tipo
                </label>
                <select
                  id={`${uid}-tipo`}
                  className="os-input w-auto"
                  value={filters.media ?? ''}
                  onChange={(e) => onChange({ ...filters, media: (e.target.value || null) as MediaKind | null })}
                  data-testid="filtro-tipo"
                >
                  <option value="">Todos</option>
                  {MEDIA_OPTIONS.map((m) => (
                    <option key={m} value={m}>
                      {MEDIA_LABELS[m]}
                    </option>
                  ))}
                </select>
              </div>
            )}
            {has('local') && (
              <div className="grid gap-1">
                <label htmlFor={`${uid}-local`} className="inline-flex items-center gap-1 text-sm font-semibold">
                  <IconNearMe size={16} />
                  Local (perto de mim)
                </label>
                <select
                  id={`${uid}-local`}
                  className="os-input w-auto"
                  value={filters.radiusKm && coords ? String(filters.radiusKm) : ''}
                  onChange={(e) => chooseRadius(e.target.value)}
                  aria-describedby={`${uid}-local-dica`}
                  data-testid="filtro-local"
                >
                  <option value="">Qualquer lugar</option>
                  {RADII.map((r) => (
                    <option key={r} value={r}>
                      Até {r} km
                    </option>
                  ))}
                </select>
                <p id={`${uid}-local-dica`} className="max-w-xs text-sm text-muted">
                  A localização é usada só nesta busca e não fica salva.
                </p>
              </div>
            )}
          </div>
        )}
        {(has('country') || has('city') || has('name')) && (
          <form key={`${filters.name}|${filters.city}|${filters.country}`} onSubmit={submitText} className="flex flex-wrap items-end gap-3" role="search" aria-label="Filtrar por texto">
            {has('name') && (
              <div className="grid min-w-0 flex-1 basis-48 gap-1">
                <label htmlFor={`${uid}-nome`} className="text-sm font-semibold">
                  Nome
                </label>
                <input id={`${uid}-nome`} name="nome" type="search" className="os-input" defaultValue={filters.name} maxLength={80} autoComplete="off" />
              </div>
            )}
            {has('city') && (
              <div className="grid min-w-0 flex-1 basis-40 gap-1">
                <label htmlFor={`${uid}-cidade`} className="text-sm font-semibold">
                  Cidade
                </label>
                <input id={`${uid}-cidade`} name="cidade" className="os-input" defaultValue={filters.city} maxLength={120} autoComplete="address-level2" />
              </div>
            )}
            {has('country') && (
              <div className="grid w-28 gap-1">
                <label htmlFor={`${uid}-pais`} className="text-sm font-semibold">
                  País
                </label>
                <input
                  id={`${uid}-pais`}
                  name="pais"
                  className="os-input uppercase"
                  defaultValue={filters.country}
                  maxLength={2}
                  placeholder="BR"
                  aria-describedby={`${uid}-pais-dica`}
                  autoComplete="country"
                />
                <span id={`${uid}-pais-dica`} className="sr-only">
                  Sigla de duas letras
                </span>
              </div>
            )}
            <button type="submit" className="os-btn">
              <IconSearch size={18} />
              Aplicar
            </button>
          </form>
        )}
        <p role="status" aria-live="polite" className="text-sm">
          {geoStatus}
        </p>
      </div>
    </section>
  );
}
