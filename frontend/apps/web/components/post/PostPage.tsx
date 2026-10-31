'use client';

import { isApiError, type PostDetailView } from '@orange-social/api';
import Link from 'next/link';
import { useEffect, type ReactNode } from 'react';
import { Notice } from '@/components/Form';
import { IconPlace } from '@/components/icons';
import { plural } from '@/lib/format';
import { feedHref } from '@/lib/feeds';
import { formatDateTime, formatRelative, profileHref } from '@/lib/post-format';
import { useMotionAllowed, usePost } from '@/lib/post-queries';
import { AuthorActions } from './AuthorActions';
import { Comments } from './Comments';
import { InteractionBar, onlyShare } from './InteractionBar';
import { AlertDetails, AlertHeader, AuthorLine, MediaBadge, RatingChip, Trending } from './PostBits';
import { PostFrame } from './PostFrame';

/** Estados de carregamento e erro do post (404 sem dizer o motivo: removido, rascunho ou autor fora do ar). */
export function PostLoader({ id, children }: { id: string; children: (post: PostDetailView) => ReactNode }) {
  const post = usePost(id);
  if (post.isPending) {
    return (
      <p role="status" className="text-muted">
        Carregando o post…
      </p>
    );
  }
  if (post.isError) {
    const e = post.error;
    if (isApiError(e, 404)) {
      return (
        <div className="grid max-w-xl grid-cols-1 gap-4" data-testid="post-indisponivel">
          <h1 className="text-2xl font-extrabold">Este post não está mais disponível</h1>
          <p>Ele pode ter sido apagado ou o endereço estar errado.</p>
          <p>
            <Link href="/" className="underline">
              Voltar para os feeds
            </Link>
          </p>
        </div>
      );
    }
    return (
      <Notice tone="error" live>
        <p>Não foi possível carregar o post. {e instanceof Error ? e.message : ''}</p>
        <p>
          <button type="button" className="os-btn os-btn-sm" onClick={() => post.refetch()}>
            Tentar de novo
          </button>
        </p>
      </Notice>
    );
  }
  return <>{children(post.data)}</>;
}

/** Página do post (link direto ou recarregar): o mesmo conteúdo do modal, como página. */
export function PostPage({ id }: { id: string }) {
  return (
    <div className="grid max-w-3xl grid-cols-1 gap-6">
      <p>
        <Link href="/" className="inline-flex min-h-6 items-center underline">
          Voltar para os feeds
        </Link>
      </p>
      <PostLoader id={id}>{(post) => <PostDetail post={post} titleAs="h1" />}</PostLoader>
    </div>
  );
}

/**
 * Detalhe do post (RF24): autor em destaque com o link para o perfil (RF25), mídia, título, subtítulo e texto
 * completos, "Publicado em {data absoluta}" + relativo, local, classificação, contagens por extenso e as 4 ações
 * com rótulo (RF26); o dono vê editar, arquivar e excluir (RF29).
 */
export function PostDetail({ post, titleAs = 'h1', titleId = 'titulo-post' }: { post: PostDetailView; titleAs?: 'h1' | 'h2'; titleId?: string }) {
  const motion = useMotionAllowed();
  const title = post.title;
  useEffect(() => {
    if (titleAs === 'h1' && title) document.title = `${title} · Orange Social`;
  }, [title, titleAs]);
  const isAlert = post.feed === 'ALERT';
  const job = post.alert?.category === 'JOB_OPENING';
  const H = titleAs;
  const profile = profileHref(post.author);
  const place = [post.city, post.country].filter(Boolean).join(', ');
  return (
    <div className="grid grid-cols-1 gap-5">
      <article aria-labelledby={titleId} className="grid grid-cols-1 gap-4">
        <PostFrame
          as="div"
          background={post.background}
          framed={!isAlert}
          category={isAlert && !job ? 'VERMELHO' : (post.author.category?.code ?? null)}
          hot={post.trending === 'HOT'}
          seed={post.id}
          motion={motion}
          feed={isAlert && !job ? 'ALERT' : undefined}
          testId="post"
        >
          {isAlert && post.alert && <AlertHeader alert={post.alert} publishedAt={post.publishedAt} />}
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div className="grid min-w-0 gap-1">
              <AuthorLine author={post.author} publishedAt={post.publishedAt} />
              {profile && (
                <Link href={profile} className="text-sm font-semibold text-brand underline">
                  Ver perfil e posts de {post.author.name}
                </Link>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-1.5">
              <MediaBadge media={post.mediaType} />
              {!isAlert && <RatingChip code={post.ageRating} label={post.ageRatingLabel} />}
            </div>
          </div>
          {post.mediaUrl && post.mediaType === 'IMAGE' && (
            // eslint-disable-next-line @next/next/no-img-element -- foto pública do bucket, já sem EXIF/GPS (RF29)
            <img src={post.mediaUrl} alt="" className="w-full rounded-md border border-line object-cover" />
          )}
          <H id={titleId} className="text-2xl font-extrabold leading-tight sm:text-3xl">
            {post.title}
          </H>
          {post.subtitle && <p className="text-lg text-muted">{post.subtitle}</p>}
          {post.body && (
            <div className="grid gap-3 text-lg" data-testid="texto-post">
              {post.body.split(/\n{2,}/).map((para, i) => (
                <p key={i} className="whitespace-pre-line break-words">
                  {para}
                </p>
              ))}
            </div>
          )}
          {isAlert && !job && post.alert && <AlertDetails alert={post.alert} author={post.author} />}
          <dl className="grid gap-1 text-sm">
            <div className="flex flex-wrap gap-x-1">
              <dt className="sr-only">Publicação</dt>
              <dd data-testid="publicado-em">
                Publicado em <time dateTime={post.publishedAt}>{formatDateTime(post.publishedAt)}</time>{' '}
                <span className="text-muted">({formatRelative(post.publishedAt)})</span>
              </dd>
            </div>
            {place && (
              <div className="flex items-center gap-1">
                <dt>
                  <IconPlace size={16} />
                  <span className="sr-only">Local</span>
                </dt>
                <dd>{place}</dd>
              </div>
            )}
            <div className="flex flex-wrap gap-x-1">
              <dt className="sr-only">Números</dt>
              <dd className="text-muted" data-testid="contagens">
                {onlyShare(post)
                  ? plural(post.counts.shares, 'compartilhamento', 'compartilhamentos')
                  : [
                      plural(post.counts.likes, 'curtida', 'curtidas'),
                      plural(post.counts.comments, 'comentário', 'comentários'),
                      plural(post.counts.shares, 'compartilhamento', 'compartilhamentos'),
                    ].join(' · ')}
              </dd>
            </div>
          </dl>
          <Trending code={post.trending} />
        </PostFrame>
        {post.status === 'ARCHIVED' && (
          <Notice>
            <p>Post arquivado: fora do feed, só para leitura.</p>
          </Notice>
        )}
        <InteractionBar post={post} />
      </article>
      {post.viewer.isAuthor && <AuthorActions post={post} />}
      {!onlyShare(post) && <Comments post={post} />}
      {isAlert && (
        <p>
          <Link href={feedHref('ALERT')} className="underline">
            Ver todos os alertas
          </Link>
        </p>
      )}
    </div>
  );
}
