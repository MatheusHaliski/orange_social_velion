'use client';

import type { FeedType } from '@orange-social/api';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useState } from 'react';
import { IconFeedAlerts, IconFeedAudio, IconFeedPosts, IconFeedProfiles, IconOfficialSource, IconPublish, IconSoon } from '@/components/icons';
import { PostList } from '@/components/post/PostList';
import { TabPanel, Tabs } from '@/components/Tabs';
import { feedBySlug, feedInfo, FEEDS, filtersToParams, parseFilters, type FeedFilters } from '@/lib/feeds';
import { useFeed, useMotionAllowed } from '@/lib/post-queries';
import { usePreferences, useSession } from '@/lib/queries';
import { FilterBar, type Coords } from './FilterBar';
import { ProfilesPanel } from './ProfilesPanel';

const FEED_ICONS = { PROFILE: IconFeedProfiles, POST: IconFeedPosts, AUDIO: IconFeedAudio, ALERT: IconFeedAlerts } as const;

/**
 * Casca dos feeds (OS-31): Segmented Switcher Perfis | Posts | Áudio | Alertas (role=tablist, setas, Home/End),
 * com o feed escolhido e os filtros na URL. Sem ?feed, abre o feed inicial das preferências (RF2) ou Posts.
 */
export function FeedView() {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();
  const session = useSession();
  const prefs = usePreferences(!!session.data);
  const fromUrl = feedBySlug(sp.get('feed'));
  const feed: FeedType = fromUrl?.type ?? (session.data ? (prefs.data?.defaultFeed ?? 'POST') : 'POST');
  const filters = parseFilters(new URLSearchParams(sp.toString()));
  const [coords, setCoords] = useState<Coords | null>(null);

  /** push: o link fica compartilhável e o "voltar" do navegador desfaz a escolha. */
  const navigate = (params: URLSearchParams) => {
    const q = params.toString();
    router.push(`${pathname}${q ? `?${q}` : ''}`, { scroll: false });
  };
  const selectFeed = (type: FeedType) => {
    const next = new URLSearchParams(sp.toString());
    next.set('feed', feedInfo(type).slug);
    navigate(next);
  };
  const setFilters = (f: FeedFilters) => navigate(filtersToParams(f, new URLSearchParams(sp.toString())));

  return (
    <div className="mx-auto grid w-full max-w-3xl gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-mono text-sm font-bold uppercase tracking-[0.2em] text-muted">
          <span className="sr-only">Orange Social · </span>Para você
        </h1>
        {session.data && (
          <Link href="/publicar" className="os-btn os-btn-sm" data-testid="publicar-feed">
            <IconPublish size={18} />
            Novo post
          </Link>
        )}
      </div>
      <Tabs<FeedType>
        label="Feeds"
        compact
        idPrefix="feed"
        selected={feed}
        onSelect={selectFeed}
        items={FEEDS.map((f) => {
          const Icon = FEED_ICONS[f.type];
          return {
            key: f.type,
            label: (
              <>
                <Icon size={18} />
                {f.label}
              </>
            ),
            testId: `aba-${f.slug}`,
          };
        })}
      />
      <TabPanel idPrefix="feed" tab={feed}>
        {feed === 'POST' && <PostsFeed filters={filters} onFilters={setFilters} coords={coords} onCoords={setCoords} />}
        {feed === 'ALERT' && <AlertsFeed filters={filters} onFilters={setFilters} coords={coords} onCoords={setCoords} />}
        {feed === 'PROFILE' && <ProfilesPanel filters={filters} onFilters={setFilters} coords={coords} onCoords={setCoords} />}
        {feed === 'AUDIO' && <AudioSoon />}
      </TabPanel>
    </div>
  );
}

interface PanelProps {
  filters: FeedFilters;
  onFilters: (f: FeedFilters) => void;
  coords: Coords | null;
  onCoords: (c: Coords | null) => void;
}

function geo(filters: FeedFilters, coords: Coords | null) {
  return filters.radiusKm && coords ? { lat: coords.lat, lng: coords.lng, radiusKm: filters.radiusKm } : {};
}

/** Post Feed (OS-32): cards com moldura; ⏳ GET /api/v1/posts. */
function PostsFeed({ filters, onFilters, coords, onCoords }: PanelProps) {
  const query = useFeed({
    feed: 'POST',
    category: filters.categories.length ? filters.categories : undefined,
    mediaType: filters.media ?? undefined,
    country: filters.country || undefined,
    city: filters.city || undefined,
    q: filters.name || undefined,
    ...geo(filters, coords),
  });
  return (
    <>
      <FilterBar filters={filters} onChange={onFilters} axes={['category', 'media', 'local', 'country', 'city', 'name']} coords={coords} onCoords={onCoords} />
      <PostList
        query={query}
        label="Posts"
        route="GET /api/v1/posts?feed=POST"
        testId="lista-posts"
        empty={<p>Nenhum post com esses filtros. Tente limpar os filtros.</p>}
      />
    </>
  );
}

/** Alert Feed (OS-34): faixa hazard, só fontes verificadas, sem moldura; ⏳ GET /api/v1/posts?feed=ALERT. */
function AlertsFeed({ filters, onFilters, coords, onCoords }: PanelProps) {
  const query = useFeed({
    feed: 'ALERT',
    country: filters.country || undefined,
    city: filters.city || undefined,
    ...geo(filters, coords),
  });
  return (
    <>
      <div className="grid gap-2">
        <div className="os-hazard" aria-hidden="true" data-testid="faixa-hazard" />
        <p className="flex items-start gap-2 text-sm">
          <IconOfficialSource size={18} className="mt-0.5 flex-none text-success" />
          <span>
            <strong>Só fontes oficiais verificadas</strong> publicam aqui (Defesa Civil, governo, instituições com selo). Alerta não tem curtidas
            nem comentários: compartilhe para avisar mais gente.
          </span>
        </p>
      </div>
      <FilterBar filters={filters} onChange={onFilters} axes={['local', 'country', 'city']} coords={coords} onCoords={onCoords} />
      <PostList
        query={query}
        label="Alertas"
        framed={false}
        route="GET /api/v1/posts?feed=ALERT"
        testId="lista-alertas"
        empty={<p>Nenhum alerta ativo para esta região. Bom sinal.</p>}
      />
    </>
  );
}

/** Audio Feed (OS-33): o backend ainda não recebe áudio (OS-24); a tela diz isso com honestidade. */
function AudioSoon() {
  const motion = useMotionAllowed();
  return (
    <div className="os-card grid gap-3 p-6" data-testid="audio-em-breve">
      <h2 className="flex items-center gap-2 text-xl font-bold">
        <IconSoon size={22} />
        Áudio: em breve
      </h2>
      <p>
        Podcasts, áudios pessoais e música vão morar aqui, com forma de onda, player acessível e duração. O envio de áudio ainda não existe no servidor
        (OS-24), então não há nada para ouvir por enquanto.
      </p>
      <p className="text-sm text-muted">
        {motion ? 'Quando chegar, o player respeita "Reduzir movimento".' : 'Quando chegar, o player segue a sua preferência de reduzir movimento.'}
      </p>
    </div>
  );
}
