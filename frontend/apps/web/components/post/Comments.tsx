'use client';

import { isApiError, type CommentPageView, type CommentView, type PostDetailView } from '@orange-social/api';
import { useMutation, useQueryClient, type InfiniteData } from '@tanstack/react-query';
import Link from 'next/link';
import { useId, useRef, useState } from 'react';
import { Dialog } from '@/components/Dialog';
import { FieldErrors, Notice } from '@/components/Form';
import { IconDelete, IconSend } from '@/components/icons';
import { api } from '@/lib/api';
import { plural } from '@/lib/format';
import { formatDateTime, formatRelative, profileHref } from '@/lib/post-format';
import { commentsKey, patchPostEverywhere, useComments } from '@/lib/post-queries';
import { useSession } from '@/lib/queries';
import { loginHref } from '@/lib/safe-redirect';
import { AuthorBadge, Avatar } from './PostBits';

const MAX = 2000;

/**
 * Caixa de mensagens do post (RF26): lista paginada por "after", campo com contador 0/2.000, apagar o próprio
 * comentário (ou qualquer um, para o dono do post). Visitante vê os comentários e o convite para entrar.
 */
export function Comments({ post }: { post: PostDetailView }) {
  const uid = useId();
  const qc = useQueryClient();
  const session = useSession();
  const comments = useComments(post.id);
  const [text, setText] = useState('');
  const [errors, setErrors] = useState<string[]>([]);
  const [status, setStatus] = useState('');
  const [toDelete, setToDelete] = useState<CommentView | null>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);
  const logged = !!session.data;
  const canWrite = logged && post.interactionsOpen;
  // a mesma resposta pode trazer um comentário que já está na lista (ex.: o recém-publicado): um item por id
  const items = uniqueById(comments.data?.pages.flatMap((p) => p.items) ?? []);
  const total = comments.data?.pages.at(-1)?.total ?? post.counts.comments;

  const setCount = (n: number) =>
    patchPostEverywhere(
      qc,
      post.id,
      (p) => ({ ...p, counts: { ...p.counts, comments: n } }),
      (c) => ({ ...c, counts: { ...c.counts, comments: n } }),
    );

  const send = useMutation({
    mutationFn: (body: string) => api.posts.comment(post.id, body),
    onSuccess: (r) => {
      qc.setQueryData<InfiniteData<CommentPageView>>(commentsKey(post.id), (d) => {
        if (!d) return d;
        // a lista vem em ordem crescente de id: o comentário novo só entra direto se a última página carregada é a
        // final; se ainda há páginas por carregar, ele chega nelas, no lugar certo e sem duplicar
        const last = d.pages.length - 1;
        const complete = d.pages.at(-1)?.nextAfter == null;
        const pages = d.pages.map((p, i) =>
          i === last && complete ? { ...p, items: [...p.items, r.comment], total: r.comments } : { ...p, total: r.comments },
        );
        return { ...d, pages };
      });
      setCount(r.comments);
      setText('');
      setErrors([]);
      setStatus(`Comentário publicado. ${plural(r.comments, 'comentário', 'comentários')}.`);
    },
    onError: (e) => {
      if (isApiError(e, 422) || isApiError(e, 400)) setErrors(e.errors.length ? e.errors : [e.detail]);
      else setErrors([isApiError(e) ? e.detail : 'Não foi possível comentar agora. Tente de novo.']);
    },
  });

  const dropComment = (c: CommentView) =>
    qc.setQueryData<InfiniteData<CommentPageView>>(commentsKey(post.id), (d) =>
      d ? { ...d, pages: d.pages.map((p) => ({ ...p, items: p.items.filter((x) => x.id !== c.id), total: Math.max(0, p.total - 1) })) } : d,
    );

  const remove = useMutation({
    mutationFn: (c: CommentView) => api.posts.removeComment(post.id, c.id),
    onSuccess: (_r, c) => {
      dropComment(c);
      setCount(Math.max(0, total - 1));
      setToDelete(null);
      setStatus('Comentário apagado.');
    },
    onError: (e, c) => {
      setToDelete(null);
      if (isApiError(e, 404)) {
        // outra exclusão (quem escreveu ou o dono do post) chegou antes: o servidor já tirou o comentário e
        // baixou o contador; some da lista e a contagem vem de novo do servidor
        dropComment(c);
        void qc.invalidateQueries({ queryKey: commentsKey(post.id) });
        setStatus('Este comentário já tinha sido apagado.');
        return;
      }
      setStatus(isApiError(e) ? e.detail : 'Não foi possível apagar agora.');
    },
  });

  return (
    <section id="comentarios" aria-labelledby={`${uid}-titulo`} className="grid gap-4" data-testid="comentarios">
      <h2 id={`${uid}-titulo`} className="text-xl font-bold">
        Comentários <span className="text-base font-normal text-muted">({total})</span>
      </h2>

      {comments.isError && (
        <Notice tone="error">
          <p>Não foi possível carregar os comentários.</p>
        </Notice>
      )}
      {comments.data && items.length === 0 && <p className="text-muted">Ninguém comentou ainda.</p>}
      {items.length > 0 && (
        <ol className="grid gap-3" aria-label="Comentários do post">
          {items.map((c) => {
            const href = profileHref(c.author);
            return (
              <li key={c.id} className="os-card grid gap-2 p-3" data-testid="comentario">
                <div className="flex items-start gap-2">
                  <Avatar name={c.author.name} url={c.author.avatarUrl} size={32} />
                  <div className="grid min-w-0 flex-1 gap-0.5">
                    <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
                      {href ? (
                        <Link href={href} className="font-bold underline">
                          {c.author.name}
                        </Link>
                      ) : (
                        <span className="font-bold">{c.author.name}</span>
                      )}
                      <AuthorBadge author={c.author} />
                      <time dateTime={c.createdAt} title={formatDateTime(c.createdAt)} className="text-muted">
                        {formatRelative(c.createdAt)}
                      </time>
                    </p>
                    <p className="whitespace-pre-line break-words">{c.body}</p>
                  </div>
                  {c.canDelete && (
                    <button type="button" className="os-btn os-btn-sm" onClick={() => setToDelete(c)} aria-label={`Apagar o comentário de ${c.author.name}`}>
                      <IconDelete size={16} />
                    </button>
                  )}
                </div>
              </li>
            );
          })}
        </ol>
      )}
      {comments.hasNextPage && (
        <p>
          <button type="button" className="os-btn os-btn-sm" onClick={() => comments.fetchNextPage()} disabled={comments.isFetchingNextPage}>
            {comments.isFetchingNextPage ? 'Carregando…' : 'Carregar mais comentários'}
          </button>
        </p>
      )}

      {canWrite ? (
        <form
          aria-label="Escrever um comentário"
          className="grid gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            const body = text.trim();
            if (!body) {
              setErrors(['Escreva o comentário antes de enviar.']);
              return;
            }
            send.mutate(body);
          }}
        >
          <label htmlFor={`${uid}-texto`} className="font-semibold">
            Seu comentário
          </label>
          <textarea
            id={`${uid}-texto`}
            className="os-input min-h-24"
            value={text}
            maxLength={MAX}
            onChange={(e) => setText(e.target.value)}
            aria-describedby={`${uid}-dica${errors.length ? ` ${uid}-erro` : ''}`}
            aria-invalid={errors.length ? true : undefined}
          />
          <p id={`${uid}-dica`} className="text-sm text-muted">
            {text.length.toLocaleString('pt-BR')}/{MAX.toLocaleString('pt-BR')} caracteres. Comentários são públicos.
          </p>
          <FieldErrors id={`${uid}-erro`} errors={errors} />
          <p>
            <button type="submit" className="os-btn os-btn-primary" disabled={send.isPending}>
              <IconSend size={18} />
              {send.isPending ? 'Enviando…' : 'Enviar comentário'}
            </button>
          </p>
        </form>
      ) : (
        <Notice>
          <p data-testid="aviso-comentarios">
            {!post.interactionsOpen
              ? 'Post arquivado: os comentários estão fechados.'
              : 'Entre na sua conta para comentar. Comentários são públicos.'}
          </p>
          {!logged && post.interactionsOpen && (
            <p>
              <Link href={loginHref(`/posts/${post.id}`)} className="font-semibold underline">
                Entrar para comentar
              </Link>
            </p>
          )}
        </Notice>
      )}
      <p role="status" aria-live="polite" className="text-sm font-semibold" data-testid="status-comentarios">
        {status}
      </p>

      <Dialog open={!!toDelete} onClose={() => setToDelete(null)} role="alertdialog" labelledBy={`${uid}-apagar`} describedBy={`${uid}-apagar-txt`} initialFocus={cancelRef}>
        <div className="grid gap-4">
          <h2 id={`${uid}-apagar`} className="text-xl font-bold">
            Apagar o comentário?
          </h2>
          <p id={`${uid}-apagar-txt`}>O texto some para todo mundo. Não dá para desfazer.</p>
          <div className="flex flex-wrap gap-2">
            <button type="button" className="os-btn os-btn-primary" onClick={() => toDelete && remove.mutate(toDelete)} disabled={remove.isPending}>
              <IconDelete size={18} />
              Sim, apagar
            </button>
            <button ref={cancelRef} type="button" className="os-btn" onClick={() => setToDelete(null)}>
              Cancelar
            </button>
          </div>
        </div>
      </Dialog>
    </section>
  );
}

function uniqueById(list: CommentView[]): CommentView[] {
  const seen = new Set<CommentView['id']>();
  return list.filter((c) => (seen.has(c.id) ? false : (seen.add(c.id), true)));
}
