'use client';

import { useRouter } from 'next/navigation';
import { useId, useRef } from 'react';
import { Dialog } from '@/components/Dialog';
import { IconClose } from '@/components/icons';
import { usePost } from '@/lib/post-queries';
import { PostDetail, PostLoader } from './PostPage';

/**
 * Modal do post (RF24, PostModal do DESIGN_SYSTEM.md §6): sheet de até 92 % da altura, role=dialog + aria-modal,
 * foco inicial no "Fechar", Esc fecha e devolve o foco ao card (o feed continua montado por baixo).
 */
export function PostModal({ id }: { id: string }) {
  const router = useRouter();
  const uid = useId();
  const closeRef = useRef<HTMLButtonElement>(null);
  const post = usePost(id);
  const close = () => router.back();
  return (
    <Dialog open onClose={close} labelledBy={post.data ? `${uid}-titulo` : `${uid}-carregando`} initialFocus={closeRef} variant="sheet">
      <div className="grid grid-cols-1 gap-4" data-testid="modal-post">
        <span aria-hidden="true" className="mx-auto h-1.5 w-12 rounded-full bg-line-strong" />
        <div className="flex items-center justify-between gap-3">
          <span id={`${uid}-carregando`} className="font-mono text-xs font-bold uppercase tracking-widest text-muted">
            Post
          </span>
          <button ref={closeRef} type="button" className="os-btn os-btn-sm" onClick={close} data-testid="fechar-modal">
            <IconClose size={18} />
            Fechar
          </button>
        </div>
        <PostLoader id={id}>{(p) => <PostDetail post={p} titleAs="h2" titleId={`${uid}-titulo`} />}</PostLoader>
      </div>
    </Dialog>
  );
}
