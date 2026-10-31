'use client';

import { isApiError, type FeedPageView, type PostCardView } from '@orange-social/api';
import type { InfiniteData, UseInfiniteQueryResult } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { Notice } from '@/components/Form';
import { useMotionAllowed } from '@/lib/post-queries';
import { PostCard } from './PostCard';

interface Props {
  query: UseInfiniteQueryResult<InfiniteData<FeedPageView>>;
  /** Nome da lista para o leitor de tela ("Posts", "Alertas sanitários"…). */
  label: string;
  framed?: boolean;
  empty: ReactNode;
  /** Rota que a lista espera, para o aviso "aguarda API". */
  route?: string;
  testId?: string;
  columns?: boolean;
  headingLevel?: 'h2' | 'h3';
}

/** A rota ainda não existe no backend (404/405/501): a tela diz isso em vez de fingir que está vazia. */
export function isMissingApi(e: unknown): boolean {
  return isApiError(e, 404) || isApiError(e, 405) || isApiError(e, 501);
}

export function ApiPending({ what, route }: { what: string; route: string }) {
  return (
    <Notice>
      <p className="font-semibold" data-testid="aguarda-api">
        ⏳ {what} ainda não chegou ao servidor.
      </p>
      <p className="text-sm">
        A tela já está pronta e espera a rota <code className="font-mono">{route}</code>. Enquanto isso, os posts aparecem no perfil de quem
        publicou.
      </p>
    </Notice>
  );
}

/** Lista de posts com "Carregar mais" (paginação por cursor). */
export function PostList({ query, label, framed = true, empty, route, testId, columns = false, headingLevel }: Props) {
  const motion = useMotionAllowed();
  if (query.isPending) {
    return (
      <p role="status" className="text-muted">
        Carregando {label.toLowerCase()}…
      </p>
    );
  }
  if (query.isError) {
    if (route && isMissingApi(query.error)) return <ApiPending what={label} route={route} />;
    return (
      <Notice tone="error" live>
        <p>Não foi possível carregar agora. {query.error instanceof Error ? query.error.message : ''}</p>
        <p>
          <button type="button" className="os-btn os-btn-sm" onClick={() => query.refetch()}>
            Tentar de novo
          </button>
        </p>
      </Notice>
    );
  }
  const items: PostCardView[] = query.data.pages.flatMap((p) => p.items);
  if (!items.length) return <div className="os-card grid gap-2 p-6">{empty}</div>;
  return (
    <div className="grid gap-4">
      <ul aria-label={label} className={`grid gap-5 ${columns ? 'md:grid-cols-2' : ''}`} data-testid={testId} aria-busy={query.isFetching}>
        {items.map((p) => (
          <li key={p.id} className="min-w-0">
            <PostCard post={p} framed={framed} motion={motion} headingLevel={headingLevel} />
          </li>
        ))}
      </ul>
      <div className="flex flex-wrap items-center gap-3">
        {query.hasNextPage ? (
          <button type="button" className="os-btn" onClick={() => query.fetchNextPage()} disabled={query.isFetchingNextPage}>
            {query.isFetchingNextPage ? 'Carregando…' : 'Carregar mais'}
          </button>
        ) : (
          <p className="text-sm text-muted">Fim da lista.</p>
        )}
        <p role="status" className="sr-only">
          {items.length} {items.length === 1 ? 'post carregado' : 'posts carregados'}
        </p>
      </div>
    </div>
  );
}
