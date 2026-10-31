'use client';

import type { ProfileCardView } from '@orange-social/api';
import Link from 'next/link';
import { CategoryDot, VerifiedSeal } from '@/components/CategoryBadge';
import { Notice } from '@/components/Form';
import { IconPlace } from '@/components/icons';
import { Avatar } from '@/components/post/PostBits';
import { ApiPending, isMissingApi } from '@/components/post/PostList';
import type { FeedFilters } from '@/lib/feeds';
import { useProfiles } from '@/lib/post-queries';
import { FilterBar, type Coords } from './FilterBar';

/** Card do Profile Feed (TAXONOMIA §5.3, "Perfil"): avatar com a bolinha, nome, categoria (cor + glifo + rótulo), local e interesses. */
export function ProfileCard({ profile }: { profile: ProfileCardView }) {
  const headingId = `perfil-${profile.id}`;
  const place = [profile.city, profile.state].filter(Boolean).join(', ') + (profile.country ? ` · ${profile.country}` : '');
  return (
    <article aria-labelledby={headingId} className="os-card relative flex h-full gap-3 p-4 hover:bg-sunken" data-category={profile.category.code}>
      <span className="relative flex-none">
        <Avatar name={profile.name} url={profile.avatarUrl} size={56} />
        <span className="absolute -bottom-1 -right-1 rounded-full bg-bg p-0.5">
          <CategoryDot code={profile.category.code} size={20} />
        </span>
      </span>
      <div className="grid min-w-0 flex-1 content-start gap-1 [overflow-wrap:anywhere]">
        <h3 id={headingId} className="flex flex-wrap items-center gap-1.5 text-lg font-bold">
          <Link href={`/u/${profile.id}`} className="underline decoration-1 after:absolute after:inset-0 after:content-[''] hover:decoration-2">
            {profile.name}
          </Link>
          {profile.verified && <VerifiedSeal />}
        </h3>
        <p className="text-sm font-semibold">
          <span className="sr-only">Categoria: </span>
          {profile.category.label}
        </p>
        {place.trim() && (
          <p className="flex items-center gap-1.5 text-sm text-muted">
            <IconPlace size={14} />
            {place}
          </p>
        )}
        {profile.interests.length > 0 && (
          <ul className="flex flex-wrap gap-1" aria-label="Interesses">
            {profile.interests.map((i) => (
              <li key={i} className="os-tag whitespace-normal normal-case tracking-normal">
                {i}
              </li>
            ))}
          </ul>
        )}
      </div>
    </article>
  );
}

interface Props {
  filters: FeedFilters;
  onFilters: (f: FeedFilters) => void;
  coords: Coords | null;
  onCoords: (c: Coords | null) => void;
}

/** Profile Feed (RF25 · OS-35): perfis filtrados por categoria, local, país, cidade e nome; ⏳ GET /api/v1/users. */
export function ProfilesPanel({ filters, onFilters, coords, onCoords }: Props) {
  const query = useProfiles({
    category: filters.categories.length ? filters.categories : undefined,
    country: filters.country || undefined,
    city: filters.city || undefined,
    q: filters.name || undefined,
    ...(filters.radiusKm && coords ? { lat: coords.lat, lng: coords.lng, radiusKm: filters.radiusKm } : {}),
  });
  const items = query.data?.pages.flatMap((p) => p.items) ?? [];
  return (
    <>
      <FilterBar filters={filters} onChange={onFilters} axes={['category', 'local', 'country', 'city', 'name']} coords={coords} onCoords={onCoords} />
      {query.isPending ? (
        <p role="status" className="text-muted">
          Carregando perfis…
        </p>
      ) : query.isError ? (
        isMissingApi(query.error) ? (
          <ApiPending what="Perfis" route="GET /api/v1/users" />
        ) : (
          <Notice tone="error" live>
            <p>Não foi possível carregar os perfis.</p>
          </Notice>
        )
      ) : items.length === 0 ? (
        <div className="os-card p-6">
          <p>Nenhum perfil com esses filtros.</p>
        </div>
      ) : (
        <div className="grid gap-4">
          <ul aria-label="Perfis" className="grid gap-4 md:grid-cols-2" data-testid="lista-perfis">
            {items.map((p) => (
              <li key={p.id} className="min-w-0">
                <ProfileCard profile={p} />
              </li>
            ))}
          </ul>
          {query.hasNextPage && (
            <p>
              <button type="button" className="os-btn" onClick={() => query.fetchNextPage()} disabled={query.isFetchingNextPage}>
                {query.isFetchingNextPage ? 'Carregando…' : 'Carregar mais'}
              </button>
            </p>
          )}
        </div>
      )}
    </>
  );
}
