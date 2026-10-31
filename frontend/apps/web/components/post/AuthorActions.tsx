'use client';

import { isApiError, type PostDetailView } from '@orange-social/api';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useId, useRef, useState } from 'react';
import { Dialog } from '@/components/Dialog';
import { Notice } from '@/components/Form';
import { IconArchive, IconDelete, IconEdit, IconRestore } from '@/components/icons';
import { api } from '@/lib/api';
import { patchPostEverywhere, postKey } from '@/lib/post-queries';

/** Ações de quem publicou (RF29): editar, arquivar ou restaurar e excluir (com confirmação). */
export function AuthorActions({ post }: { post: PostDetailView }) {
  const uid = useId();
  const qc = useQueryClient();
  const router = useRouter();
  const [confirm, setConfirm] = useState(false);
  const [message, setMessage] = useState<{ tone: 'success' | 'error'; text: string } | null>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);

  const apply = (view: PostDetailView) => {
    qc.setQueryData(postKey(post.id), view);
    patchPostEverywhere(qc, post.id, (p) => p, (c) => ({ ...c, status: view.status }));
    void qc.invalidateQueries({ queryKey: ['posts', 'feed'] });
  };
  const onError = (e: unknown) => setMessage({ tone: 'error', text: isApiError(e) ? e.detail : 'Não foi possível concluir agora.' });

  const archive = useMutation({
    mutationFn: () => api.posts.archive(post.id),
    onSuccess: (v) => {
      apply(v);
      setMessage({ tone: 'success', text: 'Post arquivado: saiu do feed e do "em alta"; a página continua no ar só para leitura.' });
    },
    onError,
  });
  const restore = useMutation({
    mutationFn: () => api.posts.restore(post.id),
    onSuccess: (v) => {
      apply(v);
      setMessage({ tone: 'success', text: 'Post restaurado: voltou para o feed.' });
    },
    onError,
  });
  const remove = useMutation({
    mutationFn: () => api.posts.remove(post.id),
    onSuccess: () => {
      qc.removeQueries({ queryKey: postKey(post.id) });
      void qc.invalidateQueries({ queryKey: ['posts'] });
      router.push('/');
    },
    onError: (e) => {
      setConfirm(false);
      onError(e);
    },
  });

  return (
    <section aria-labelledby={`${uid}-titulo`} className="os-card grid gap-3 p-4" data-testid="acoes-autor">
      <h2 id={`${uid}-titulo`} className="font-bold">
        Seu post
      </h2>
      <div className="flex flex-wrap gap-2">
        <Link href={`/posts/${post.id}/editar`} className="os-btn os-btn-sm">
          <IconEdit size={16} />
          Editar
        </Link>
        {post.status === 'PUBLISHED' && (
          <button type="button" className="os-btn os-btn-sm" onClick={() => archive.mutate()} disabled={archive.isPending}>
            <IconArchive size={16} />
            Arquivar
          </button>
        )}
        {post.status === 'ARCHIVED' && (
          <button type="button" className="os-btn os-btn-sm" onClick={() => restore.mutate()} disabled={restore.isPending}>
            <IconRestore size={16} />
            Restaurar
          </button>
        )}
        <button type="button" className="os-btn os-btn-sm" onClick={() => setConfirm(true)}>
          <IconDelete size={16} />
          Excluir…
        </button>
      </div>
      {message && (
        <Notice tone={message.tone} live>
          <p>{message.text}</p>
        </Notice>
      )}
      <Dialog open={confirm} onClose={() => setConfirm(false)} role="alertdialog" labelledBy={`${uid}-excluir`} describedBy={`${uid}-excluir-txt`} initialFocus={cancelRef}>
        <div className="grid gap-4">
          <h2 id={`${uid}-excluir`} className="text-xl font-bold">
            Excluir o post?
          </h2>
          <p id={`${uid}-excluir-txt`}>
            O conteúdo, a foto, as curtidas e os comentários somem para todo mundo, e o link deixa de funcionar. Não dá para desfazer. Se quiser só tirar do
            feed, arquive.
          </p>
          <div className="flex flex-wrap gap-2">
            <button type="button" className="os-btn os-btn-primary" onClick={() => remove.mutate()} disabled={remove.isPending}>
              <IconDelete size={18} />
              {remove.isPending ? 'Excluindo…' : 'Sim, excluir'}
            </button>
            <button ref={cancelRef} type="button" className="os-btn" onClick={() => setConfirm(false)}>
              Cancelar
            </button>
          </div>
        </div>
      </Dialog>
    </section>
  );
}
