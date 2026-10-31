'use client';

import { isApiError } from '@orange-social/api';
import { useMutation } from '@tanstack/react-query';
import { useEffect, useRef, useState, type ChangeEvent } from 'react';
import { FieldErrors, describedBy } from '@/components/Form';
import { IconDelete, IconPhotoUpload } from '@/components/icons';
import { api } from '@/lib/api';
import { checkPhoto, uploadPostPhoto } from '@/lib/photo';

export interface PhotoState {
  /** Chave do envio novo (vai no mediaObjectKey). */
  key: string | null;
  /** Foto que já está no post (edição). */
  currentUrl: string | null;
  removed: boolean;
  /** Prévia local (blob:) da foto nova, para o card de prévia. */
  localUrl?: string | null;
}

interface Props {
  value: PhotoState;
  onChange: (next: PhotoState) => void;
  required: boolean;
  errors?: string[];
  onBusy: (busy: boolean) => void;
}

/**
 * Foto do post (RF29): envio direto ao bucket pela URL pré-assinada; o servidor tira EXIF e GPS e reduz para até
 * 2.048 px ao gravar o post. ⏳ O texto alternativo (mediaAlt) ainda não existe na API.
 */
export function PhotoPicker({ value, onChange, required, errors, onBusy }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [localErrors, setLocalErrors] = useState<string[]>([]);
  const [status, setStatus] = useState('');

  const blobs = useRef<string[]>([]);
  useEffect(() => {
    const list = blobs.current;
    return () => list.forEach((u) => URL.revokeObjectURL(u));
  }, []);

  const upload = useMutation({
    mutationFn: (file: File) => uploadPostPhoto(file, { api }),
    onMutate: () => {
      onBusy(true);
      setLocalErrors([]);
      setStatus('Enviando a foto…');
    },
    onSuccess: (key) => {
      onChange({ ...value, key, removed: false, localUrl: blobs.current.at(-1) ?? null });
      setStatus('Foto enviada. Ela sai sem os dados de local e do aparelho quando o post for publicado.');
    },
    onError: (e, file) => {
      void file;
      setPreview(null);
      setStatus('');
      setLocalErrors(isApiError(e, 422) ? (e.errors.length ? e.errors : [e.detail]) : [isApiError(e) ? e.detail : 'Não foi possível enviar a foto. Tente de novo.']);
    },
    onSettled: () => {
      onBusy(false);
      if (inputRef.current) inputRef.current.value = '';
    },
  });

  function choose(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const problem = checkPhoto(file);
    if (problem) {
      setLocalErrors([problem]);
      e.target.value = '';
      return;
    }
    const url = URL.createObjectURL(file);
    blobs.current.push(url);
    setPreview(url);
    upload.mutate(file);
  }

  const shown = preview ?? (value.removed ? null : value.currentUrl);
  const hasPhoto = !!value.key || (!!value.currentUrl && !value.removed);
  const allErrors = [...localErrors, ...(errors ?? [])];
  return (
    <div className="grid gap-3" data-testid="campo-foto">
      <div className="grid gap-1">
        <p id="post-photo-rotulo" className="font-semibold">
          Foto{required ? <span className="font-normal text-muted"> (obrigatória)</span> : <span className="font-normal text-muted"> (opcional)</span>}
        </p>
        <p id="post-photo-dica" className="text-sm text-muted">
          JPEG ou PNG, até 10 MB. A foto sai sem os dados de local e do aparelho.
        </p>
      </div>
      {shown && (
        // eslint-disable-next-line @next/next/no-img-element -- prévia local (blob:) ou foto pública do post
        <img src={shown} alt="Prévia da foto escolhida" className="max-h-72 w-full max-w-md rounded-md border border-line object-cover" data-testid="previa-foto" />
      )}
      <div className="flex flex-wrap gap-2">
        <input
          ref={inputRef}
          id="post-photo"
          type="file"
          accept="image/jpeg,image/png"
          className="peer sr-only"
          onChange={choose}
          disabled={upload.isPending}
          aria-labelledby="post-photo-rotulo post-photo-botao"
          aria-describedby={describedBy('post-photo-dica', allErrors.length > 0 && 'post-photo-erro')}
          aria-invalid={allErrors.length ? true : undefined}
        />
        <label
          id="post-photo-botao"
          htmlFor="post-photo"
          className="os-btn peer-focus-visible:outline-3 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-focus peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
        >
          <IconPhotoUpload size={18} />
          {upload.isPending ? 'Enviando…' : hasPhoto ? 'Trocar foto' : 'Escolher foto'}
        </label>
        {hasPhoto && !upload.isPending && (
          <button
            type="button"
            className="os-btn"
            onClick={() => {
              setPreview(null);
              onChange({ key: null, currentUrl: value.currentUrl, removed: true, localUrl: null });
              setStatus('Foto retirada.');
            }}
          >
            <IconDelete size={18} />
            Tirar a foto
          </button>
        )}
      </div>
      <div aria-live="polite">
        <FieldErrors id="post-photo-erro" errors={allErrors} />
        {status && <p className="text-sm">{status}</p>}
      </div>
    </div>
  );
}
