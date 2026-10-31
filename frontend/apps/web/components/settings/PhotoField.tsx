'use client';

import { isApiError, type ProfileView } from '@orange-social/api';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useId, useRef, useState, type ChangeEvent } from 'react';
import { FieldErrors, Notice, describedBy } from '@/components/Form';
import { IconDelete, IconPhotoUpload } from '@/components/icons';
import { api } from '@/lib/api';
import { checkPhoto, initials, uploadProfilePhoto } from '@/lib/photo';
import { PROFILE_KEY } from '@/lib/queries';

type Status = { tone: 'success' | 'error' | 'info'; text: string } | null;

/** Foto de perfil (RF2): envio pré-assinado direto ao bucket; sem foto, aparecem as iniciais. */
export function PhotoField({ profile }: { profile: ProfileView }) {
  const uid = useId();
  const queryClient = useQueryClient();
  const inputRef = useRef<HTMLInputElement>(null);
  const [errors, setErrors] = useState<string[]>([]);
  const [status, setStatus] = useState<Status>(null);

  const onError = (e: unknown) => {
    setStatus(null);
    if (isApiError(e, 422)) setErrors(e.errors.length ? e.errors : [e.detail]);
    else setErrors([isApiError(e) ? e.detail : 'Não foi possível trocar a foto agora. Tente de novo.']);
  };

  const upload = useMutation({
    mutationFn: (file: File) => uploadProfilePhoto(file, { api }),
    onMutate: () => {
      setErrors([]);
      setStatus({ tone: 'info', text: 'Enviando a foto…' });
    },
    onSuccess: (view) => {
      queryClient.setQueryData(PROFILE_KEY, view);
      setStatus({ tone: 'success', text: 'Foto atualizada. Ela fica quadrada, com 512 px, e sem os dados de local e do aparelho.' });
    },
    onError,
    onSettled: () => {
      if (inputRef.current) inputRef.current.value = '';
    },
  });

  const remove = useMutation({
    mutationFn: () => api.me.removePhoto(),
    onMutate: () => setErrors([]),
    onSuccess: (view) => {
      queryClient.setQueryData(PROFILE_KEY, view);
      setStatus({ tone: 'success', text: 'Foto removida: agora aparecem as suas iniciais.' });
    },
    onError,
  });

  function choose(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const problem = checkPhoto(file);
    if (problem) {
      setStatus(null);
      setErrors([problem]);
      e.target.value = '';
      return;
    }
    upload.mutate(file);
  }

  const busy = upload.isPending || remove.isPending;
  const inputId = `${uid}-foto`;
  const hintId = `${uid}-foto-dica`;
  const errId = `${uid}-foto-erro`;

  return (
    <section aria-labelledby={`${uid}-titulo`} className="os-card grid gap-4 p-5">
      <h2 id={`${uid}-titulo`} className="text-xl font-bold">
        Foto de perfil
      </h2>
      <div className="flex flex-wrap items-center gap-4">
        {profile.avatarUrl ? (
          // eslint-disable-next-line @next/next/no-img-element -- URL pública do bucket, já em 512 px
          <img src={profile.avatarUrl} alt="Sua foto de perfil" width={96} height={96} className="size-24 rounded-full border border-line object-cover" data-testid="foto-perfil" />
        ) : (
          <span className="grid size-24 place-items-center rounded-full border-2 border-line-strong bg-sunken text-3xl font-bold" data-testid="iniciais">
            <span aria-hidden="true">{initials(profile.name)}</span>
            <span className="sr-only">Sem foto: aparecem as suas iniciais</span>
          </span>
        )}
        <div className="grid gap-2">
          <div className="flex flex-wrap gap-2">
            <input
              ref={inputRef}
              id={inputId}
              type="file"
              accept="image/jpeg,image/png"
              className="peer sr-only"
              onChange={choose}
              disabled={busy}
              aria-describedby={describedBy(hintId, errors.length > 0 && errId)}
              aria-invalid={errors.length ? true : undefined}
            />
            <label
              htmlFor={inputId}
              className="os-btn peer-focus-visible:outline-3 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-focus peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
            >
              <IconPhotoUpload size={18} />
              {upload.isPending ? 'Enviando…' : profile.avatarUrl ? 'Trocar foto' : 'Escolher foto'}
            </label>
            {profile.avatarUrl && (
              <button type="button" className="os-btn" onClick={() => remove.mutate()} disabled={busy}>
                <IconDelete size={18} />
                {remove.isPending ? 'Removendo…' : 'Remover foto'}
              </button>
            )}
          </div>
          <p id={hintId} className="text-sm text-muted">
            JPEG ou PNG, até 10 MB. A foto é recortada em quadrado e sai sem os dados de local e do aparelho.
          </p>
          <div aria-live="polite">
            <FieldErrors id={errId} errors={errors} />
          </div>
        </div>
      </div>
      {status && (
        <Notice tone={status.tone} live>
          <p>{status.text}</p>
        </Notice>
      )}
    </section>
  );
}
