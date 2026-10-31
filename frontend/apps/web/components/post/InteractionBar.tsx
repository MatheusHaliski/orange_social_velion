'use client';

import { isApiError, type PostCardView, type PostDetailView, type ShareChannelCode } from '@orange-social/api';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useId, useState } from 'react';
import { Dialog } from '@/components/Dialog';
import { IconComment, IconCopy, IconExternal, IconLike, IconSave, IconShare } from '@/components/icons';
import { api } from '@/lib/api';
import { formatCompact, plural } from '@/lib/format';
import { postHref } from '@/lib/post-format';
import { patchPostEverywhere } from '@/lib/post-queries';
import { useSession } from '@/lib/queries';
import { loginHref } from '@/lib/safe-redirect';
import { canShareNatively, copyText, SHARE_CHANNELS, shareTarget } from '@/lib/share';
import { Trending } from './PostBits';

type AnyPost = PostCardView | PostDetailView;

/**
 * Número do botão do card: o visível ("2,1 mil") faz parte do nome acessível (WCAG 2.5.3) e o exato vem junto,
 * por extenso: "Curtir, 2,1 mil (2.100 curtidas)"; quando os dois são iguais, "Curtir, 57 curtidas".
 */
function CompactCount({ verb, n, one, many }: { verb: string; n: number; one: string; many: string }) {
  const compact = formatCompact(n);
  const exact = n.toLocaleString('pt-BR');
  const noun = n === 1 ? one : many;
  return (
    <>
      <span className="sr-only">{verb}, </span>
      <span>{compact}</span>
      <span className="sr-only">{compact === exact ? ` ${noun}` : ` (${exact} ${noun})`}</span>
    </>
  );
}

/** Alerta oficial (Alert Feed, exceto vaga): só compartilhar, sem curtidas nem comentários (DESIGN_SYSTEM.md §7). */
export function onlyShare(post: Pick<AnyPost, 'feed' | 'alert'>): boolean {
  return post.feed === 'ALERT' && post.alert?.category !== 'JOB_OPENING';
}

function interactionsOpen(post: AnyPost): boolean {
  return 'interactionsOpen' in post ? post.interactionsOpen : post.status === 'PUBLISHED';
}

/** Link público do post: o da API no detalhe; no card, o mesmo formato ({origem}/p/{id}). */
function shareUrlOf(post: AnyPost): string {
  if ('shareUrl' in post && post.shareUrl) return post.shareUrl;
  return typeof window === 'undefined' ? `/p/${post.id}` : `${window.location.origin}/p/${post.id}`;
}

/**
 * Curtir, comentar, compartilhar e salvar (RF26): {@code <button>} com a contagem, aria-label com o número por
 * extenso e aria-pressed em curtir/salvar; o resultado vai para um aria-live. No card ({@code compact}) os botões
 * são só ícone + número; no modal, com rótulo. Visitante vai para o login; post arquivado fica só leitura.
 */
export function InteractionBar({ post, compact = false }: { post: AnyPost; compact?: boolean }) {
  const router = useRouter();
  const qc = useQueryClient();
  const session = useSession();
  const [status, setStatus] = useState('');
  const [shareOpen, setShareOpen] = useState(false);
  const logged = !!session.data;
  const here = postHref(post);
  const open = interactionsOpen(post);
  const shareOnly = onlyShare(post);

  const fail = (e: unknown) => {
    if (isApiError(e, 401)) router.push(loginHref(here));
    else setStatus(isApiError(e) ? e.detail : 'Não foi possível concluir agora. Tente de novo.');
  };
  const requireLogin = () => {
    router.push(loginHref(here));
  };

  const like = useMutation({
    mutationFn: () => (post.viewer.liked ? api.posts.unlike(post.id) : api.posts.like(post.id)),
    onSuccess: (r) => {
      patchPostEverywhere(
        qc,
        post.id,
        (p) => ({ ...p, viewer: { ...p.viewer, liked: r.liked }, counts: { ...p.counts, likes: r.likes } }),
        (c) => ({ ...c, viewer: { ...c.viewer, liked: r.liked }, counts: { ...c.counts, likes: r.likes } }),
      );
      setStatus(`${r.liked ? 'Você curtiu.' : 'Curtida desfeita.'} ${plural(r.likes, 'curtida', 'curtidas')}.`);
    },
    onError: fail,
  });

  const save = useMutation({
    mutationFn: () => (post.viewer.saved ? api.posts.unsave(post.id) : api.posts.save(post.id)),
    onSuccess: (r) => {
      patchPostEverywhere(
        qc,
        post.id,
        (p) => ({ ...p, viewer: { ...p.viewer, saved: r.saved } }),
        (c) => ({ ...c, viewer: { ...c.viewer, saved: r.saved } }),
      );
      setStatus(r.saved ? 'Post salvo. Só você vê os seus salvos.' : 'Post tirado dos salvos.');
    },
    onError: fail,
  });

  const likes = plural(post.counts.likes, 'curtida', 'curtidas');
  const comments = plural(post.counts.comments, 'comentário', 'comentários');
  const shares = plural(post.counts.shares, 'compartilhamento', 'compartilhamentos');
  const btn = compact ? 'os-action' : 'os-btn';
  const closedNote = open ? undefined : 'Post arquivado: só leitura.';

  return (
    <div className={compact ? 'os-post-actions' : 'grid gap-3'}>
      <div className="flex flex-wrap items-center gap-1 sm:gap-2" role="group" aria-label="Interações">
        {!shareOnly && (
          <button
            type="button"
            className={btn}
            aria-pressed={post.viewer.liked}
            disabled={like.isPending || !open}
            title={closedNote}
            onClick={() => (logged ? like.mutate() : requireLogin())}
            data-testid="curtir"
          >
            <IconLike size={compact ? 18 : 18} fill={post.viewer.liked ? 'currentColor' : 'none'} />
            {compact ? (
              <CompactCount verb="Curtir" n={post.counts.likes} one="curtida" many="curtidas" />
            ) : (
              <>
                <span>{post.viewer.liked ? 'Curtido' : 'Curtir'}</span>
                <span className="text-muted">
                  <span className="sr-only">, </span>
                  {likes}
                </span>
              </>
            )}
          </button>
        )}
        {!shareOnly &&
          (compact ? (
            <Link href={`${here}#comentarios`} scroll={false} className={btn} data-testid="comentar">
              <IconComment size={18} />
              <CompactCount verb="Comentar" n={post.counts.comments} one="comentário" many="comentários" />
            </Link>
          ) : (
            <a href="#comentarios" className={btn} data-testid="ir-comentarios">
              <IconComment size={18} />
              <span>Comentar</span>
              <span className="text-muted">
                <span className="sr-only">, </span>
                {comments}
              </span>
            </a>
          ))}
        <button
          type="button"
          className={btn}
          aria-haspopup="dialog"
          onClick={() => setShareOpen(true)}
          data-testid="compartilhar"
        >
          <IconShare size={18} />
          {compact ? (
            <CompactCount verb="Compartilhar" n={post.counts.shares} one="compartilhamento" many="compartilhamentos" />
          ) : (
            <>
              <span>Compartilhar</span>
              <span className="text-muted">
                <span className="sr-only">, </span>
                {shares}
              </span>
            </>
          )}
        </button>
        {!shareOnly && (
          <button
            type="button"
            className={btn}
            aria-pressed={post.viewer.saved}
            disabled={save.isPending || !open}
            title={closedNote}
            onClick={() => (logged ? save.mutate() : requireLogin())}
            data-testid="salvar"
          >
            <IconSave size={18} fill={post.viewer.saved ? 'currentColor' : 'none'} />
            {compact ? <span className="sr-only">Salvar</span> : <span>{post.viewer.saved ? 'Salvo' : 'Salvar'}</span>}
          </button>
        )}
      </div>
      {compact ? (
        shareOnly ? (
          <span className="font-mono text-xs text-muted" data-testid="aviso-alerta">
            sem curtidas em alerta oficial
          </span>
        ) : (
          <Trending code={post.trending} />
        )
      ) : (
        <>
          {shareOnly && (
            <p className="text-sm text-muted" data-testid="aviso-alerta">
              Alerta oficial não recebe curtidas nem comentários: compartilhe para avisar mais gente.
            </p>
          )}
          {!open && <p className="text-sm text-muted">Post arquivado: curtir, comentar e salvar estão fechados.</p>}
        </>
      )}
      <p role="status" aria-live="polite" className={compact ? 'sr-only' : 'text-sm font-semibold'} data-testid="status-interacao">
        {status}
      </p>
      <ShareSheet post={post} open={shareOpen} onClose={() => setShareOpen(false)} onStatus={setStatus} canCount={logged && open} />
    </div>
  );
}

/** Folha de compartilhar (RF26): prévia do link, copiar, WhatsApp, Telegram, X, e-mail e "Mais opções" (Web Share). */
function ShareSheet({
  post,
  open,
  onClose,
  onStatus,
  canCount,
}: {
  post: AnyPost;
  open: boolean;
  onClose: () => void;
  onStatus: (s: string) => void;
  canCount: boolean;
}) {
  const uid = useId();
  const qc = useQueryClient();
  const url = shareUrlOf(post);
  const count = useMutation({
    mutationFn: (channel: ShareChannelCode) => api.posts.share(post.id, channel),
    onSuccess: (r) => {
      patchPostEverywhere(
        qc,
        post.id,
        (p) => ({ ...p, counts: { ...p.counts, shares: r.shares } }),
        (c) => ({ ...c, counts: { ...c.counts, shares: r.shares } }),
      );
    },
  });
  /** Conta 1× por pessoa e canal (só com sessão); o visitante compartilha sem contar. */
  const counted = (channel: ShareChannelCode) => {
    if (canCount) count.mutate(channel);
  };
  const channels = SHARE_CHANNELS.filter((c) => c.code !== 'NATIVE' || canShareNatively());

  return (
    <Dialog open={open} onClose={onClose} labelledBy={`${uid}-titulo`}>
      <div className="grid gap-4" data-testid="folha-compartilhar">
        <div className="flex items-start justify-between gap-3">
          <h2 id={`${uid}-titulo`} className="text-xl font-bold">
            Compartilhar
          </h2>
          <button type="button" className="os-btn os-btn-sm" onClick={onClose}>
            Fechar
          </button>
        </div>
        <p className="font-semibold">{post.title}</p>
        <ul className="flex flex-wrap gap-2">
          {channels.map((ch) => {
            const target = shareTarget(ch.code, url, post.title);
            if (ch.code === 'COPY_LINK') {
              return (
                <li key={ch.code}>
                  <button
                    type="button"
                    className="os-btn os-btn-sm"
                    onClick={async () => {
                      const ok = await copyText(url);
                      onStatus(ok ? 'Link copiado.' : 'Não deu para copiar: selecione o link e copie.');
                      if (ok) counted(ch.code);
                    }}
                  >
                    <IconCopy size={16} />
                    {ch.label}
                  </button>
                </li>
              );
            }
            if (ch.code === 'NATIVE') {
              return (
                <li key={ch.code}>
                  <button
                    type="button"
                    className="os-btn os-btn-sm"
                    onClick={async () => {
                      try {
                        await navigator.share({ title: post.title, url });
                        counted(ch.code);
                      } catch {
                        // a pessoa fechou a folha do sistema
                      }
                    }}
                  >
                    <IconShare size={16} />
                    {ch.label}
                  </button>
                </li>
              );
            }
            return target ? (
              <li key={ch.code}>
                <a href={target} target="_blank" rel="noopener noreferrer" className="os-btn os-btn-sm" onClick={() => counted(ch.code)}>
                  <IconExternal size={16} />
                  {ch.label}
                  <span className="sr-only">(abre em outra aba)</span>
                </a>
              </li>
            ) : null;
          })}
        </ul>
        <div className="grid gap-1">
          <label htmlFor={`${uid}-link`} className="text-sm font-semibold">
            Link do post
          </label>
          <input id={`${uid}-link`} className="os-input" readOnly value={url} onFocus={(e) => e.currentTarget.select()} />
          <p className="text-sm text-muted">O link não diz quem compartilhou.</p>
        </div>
      </div>
    </Dialog>
  );
}
