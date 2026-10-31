'use client';

import type { PostCardView } from '@orange-social/api';
import Link from 'next/link';
import { IconComment, IconLike, IconPlay, IconSave, IconShare } from '@/components/icons';
import { durationText, formatDuration } from '@/lib/format';
import { postHref } from '@/lib/post-format';
import { InteractionBar } from './InteractionBar';
import { AlertDetails, AlertHeader, AuthorLine, MediaBadge, RatingChip, Trending } from './PostBits';
import { PostFrame } from './PostFrame';

interface Props {
  post: PostCardView;
  /** Alert Feed (e qualquer feed em rules.feedsWithoutFrame) nunca mostra moldura. */
  framed?: boolean;
  motion: boolean;
  headingLevel?: 'h2' | 'h3';
  /** Prévia do estúdio: sem link nem botões (o post ainda não existe). */
  preview?: boolean;
}

/** Mídia do card: foto ou pôster do vídeo com o botão e a duração; o texto alternativo ainda não existe (⏳ mediaAlt). */
function CardMedia({ post }: { post: PostCardView }) {
  if (!post.mediaUrl || (post.mediaType !== 'IMAGE' && post.mediaType !== 'VIDEO')) return null;
  return (
    <div className="relative overflow-hidden rounded-md border border-line">
      {/* eslint-disable-next-line @next/next/no-img-element -- foto pública do bucket, já sem EXIF/GPS (RF29) */}
      <img src={post.mediaUrl} alt="" loading="lazy" className="aspect-video w-full object-cover" />
      {post.mediaType === 'VIDEO' && (
        <>
          <span aria-hidden="true" className="absolute inset-0 grid place-items-center">
            <span className="grid h-14 w-14 place-items-center rounded-full bg-[#17120D]/80 text-[#F4EEE6]">
              <IconPlay size={26} fill="currentColor" />
            </span>
          </span>
          {post.durationSeconds != null && (
            <span className="absolute bottom-2 right-2 rounded-md bg-[#17120D]/85 px-2 py-0.5 font-mono text-sm text-[#F4EEE6]">
              <span aria-hidden="true">{formatDuration(post.durationSeconds)}</span>
              <span className="sr-only">Vídeo de {durationText(post.durationSeconds)}</span>
            </span>
          )}
        </>
      )}
    </div>
  );
}

/**
 * Feed Card (OS-32) dentro da moldura (RF28): bolinha + glifo + filete da categoria, tipo de mídia, classificação,
 * título obrigatório (link para o modal, RF24), subtítulo em até 2 linhas e as ações (RF26). Sem texto corrido.
 * Alerta oficial (OS-34): severidade, fonte verificada, área, validade e só compartilhar.
 */
export function PostCard({ post, framed = true, motion, headingLevel = 'h3', preview = false }: Props) {
  const headingId = `post-${post.id}`;
  const H = headingLevel;
  const isAlert = post.feed === 'ALERT';
  const job = post.alert?.category === 'JOB_OPENING';
  return (
    <PostFrame
      background={post.background}
      framed={framed && !isAlert}
      category={isAlert && !job ? 'VERMELHO' : (post.author.category?.code ?? null)}
      hot={post.trending === 'HOT'}
      seed={post.id}
      motion={motion}
      feed={isAlert && !job ? 'ALERT' : undefined}
      labelledBy={headingId}
      testId="card-post"
    >
      {isAlert && post.alert && <AlertHeader alert={post.alert} publishedAt={post.publishedAt} />}
      {(!isAlert || job) && (
        <div className="flex flex-wrap items-start justify-between gap-2">
          <AuthorLine author={post.author} publishedAt={post.publishedAt} />
          <div className="flex flex-wrap items-center gap-1.5">
            {!isAlert && <MediaBadge media={post.mediaType} />}
            {!isAlert && <RatingChip code={post.ageRating} label={post.ageRatingLabel} />}
          </div>
        </div>
      )}
      <CardMedia post={post} />
      <H id={headingId} className="text-lg font-bold leading-snug sm:text-xl">
        {preview ? (
          post.title
        ) : (
          <Link href={postHref(post)} scroll={false} className="hover:underline" data-testid="abrir-post">
            {post.title}
          </Link>
        )}
      </H>
      {post.subtitle && <p className="line-clamp-2 text-muted">{post.subtitle}</p>}
      {isAlert && !job && post.alert && <AlertDetails alert={post.alert} author={post.author} />}
      {post.status === 'ARCHIVED' && (
        <p>
          <span className="os-tag">Arquivado</span>
        </p>
      )}
      {preview ? <PreviewActions post={post} /> : <InteractionBar post={post} compact />}
    </PostFrame>
  );
}

/** Rodapé da prévia do estúdio: as mesmas contagens, sem botões; o "em alta" é texto, como no feed. */
function PreviewActions({ post }: { post: PostCardView }) {
  return (
    <div className="os-post-actions">
      <span className="flex items-center gap-4 text-muted">
        <span className="inline-flex items-center gap-1">
          <IconLike size={18} /> {post.counts.likes}
        </span>
        <span className="inline-flex items-center gap-1">
          <IconComment size={18} /> {post.counts.comments}
        </span>
        <span className="inline-flex items-center gap-1">
          <IconShare size={18} /> {post.counts.shares}
        </span>
        <IconSave size={18} />
      </span>
      <Trending code={post.trending} />
    </div>
  );
}
