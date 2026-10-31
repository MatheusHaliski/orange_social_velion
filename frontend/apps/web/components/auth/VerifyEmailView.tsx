'use client';

import { isApiError } from '@orange-social/api';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { useId, useState, type FormEvent } from 'react';
import { FieldErrors, Notice, useDeferredFocus } from '@/components/Form';
import { IconEmail, IconLogin } from '@/components/icons';
import { api } from '@/lib/api';
import { SESSION_KEY, useSession } from '@/lib/queries';
import { loginHref } from '@/lib/safe-redirect';
import { useCountdown, waitText } from '@/lib/use-countdown';

/** Confirmar e-mail (RF1): código de 6 dígitos e reenvio (1 por minuto). */
export function VerifyEmailView() {
  const uid = useId();
  const session = useSession();
  const queryClient = useQueryClient();
  const [code, setCode] = useState('');
  const [codeError, setCodeError] = useState<string[] | undefined>();
  const [info, setInfo] = useState<{ tone: 'success' | 'error' | 'info'; text: string } | null>(null);
  const [wait, startWait] = useCountdown();
  const [infoRef, focusInfo] = useDeferredFocus<HTMLDivElement>();
  const user = session.data;

  const show = (tone: 'success' | 'error' | 'info', text: string) => {
    setInfo({ tone, text });
    focusInfo();
  };

  const verify = useMutation({
    mutationFn: () => api.me.verifyEmail(code),
    onSuccess: (u) => {
      queryClient.setQueryData(SESSION_KEY, u);
      setCodeError(undefined);
      show('success', 'E-mail confirmado. A sua conta está ativa.');
    },
    onError: (e) => {
      if (isApiError(e, 422)) setCodeError([e.detail]);
      else if (isApiError(e, 409)) void session.refetch().then(() => show('info', e.detail));
      else show('error', isApiError(e) ? e.detail : 'Não foi possível confirmar agora. Tente de novo.');
    },
  });

  const resend = useMutation({
    mutationFn: () => api.me.resendVerification(),
    onSuccess: () => {
      startWait(60);
      show('success', `Enviamos um novo código para ${user?.email ?? 'o seu e-mail'}.`);
    },
    onError: (e) => {
      if (isApiError(e, 429)) {
        startWait(e.retryAfterSeconds ?? 60);
        show('error', e.detail);
      } else show(isApiError(e, 409) ? 'info' : 'error', isApiError(e) ? e.detail : 'Não foi possível reenviar agora.');
    },
  });

  function submit(e: FormEvent) {
    e.preventDefault();
    if (!/^\d{6}$/.test(code)) {
      setCodeError(['O código tem 6 números.']);
      return;
    }
    setCodeError(undefined);
    verify.mutate();
  }

  if (session.isPending) return <p className="text-muted">Carregando…</p>;
  if (!user) {
    return (
      <div className="mx-auto grid w-full max-w-md gap-4">
        <h1 className="text-3xl font-extrabold">Confirmar e-mail</h1>
        <p>Entre na sua conta para confirmar o e-mail.</p>
        <p>
          <Link href={loginHref('/confirmar-email')} className="os-btn os-btn-primary">
            <IconLogin size={18} />
            Entrar
          </Link>
        </p>
      </div>
    );
  }

  const done = user.emailVerified;
  return (
    <div className="mx-auto grid w-full max-w-md gap-6">
      <h1 className="text-3xl font-extrabold">Confirmar e-mail</h1>
      {info && (
        <div ref={infoRef} tabIndex={-1} className="outline-none">
          <Notice tone={info.tone} live>
            <p>{info.text}</p>
          </Notice>
        </div>
      )}
      {done ? (
        <div className="grid gap-3">
          {!info && (
            <Notice tone="success">
              <p>Seu e-mail já está confirmado.</p>
            </Notice>
          )}
          <p className="flex flex-wrap gap-2">
            <Link href="/" className="os-btn os-btn-primary">
              Ver os feeds
            </Link>
            <Link href="/configuracoes" className="os-btn">
              Configurações
            </Link>
          </p>
        </div>
      ) : (
        <>
          <p className="flex items-start gap-2">
            <IconEmail size={20} className="mt-0.5 flex-none" />
            <span>
              Enviamos um código de 6 dígitos para <strong>{user.email}</strong>. Ele vale por 30 minutos. Sem confirmar,
              você lê, mas ainda não avalia nem interage.
            </span>
          </p>
          <form noValidate onSubmit={submit} className="grid gap-4">
            <div className="grid gap-1">
              <label htmlFor={`${uid}-codigo`} className="font-semibold">
                Código de 6 dígitos
              </label>
              <input
                id={`${uid}-codigo`}
                className="os-input max-w-xs font-mono text-lg tracking-widest"
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={6}
                pattern="[0-9]{6}"
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
                aria-invalid={codeError ? true : undefined}
                aria-describedby={codeError ? `${uid}-codigo-erro` : undefined}
                required
              />
              <FieldErrors id={`${uid}-codigo-erro`} errors={codeError} />
            </div>
            <div className="flex flex-wrap gap-2">
              <button type="submit" className="os-btn os-btn-primary" disabled={verify.isPending}>
                {verify.isPending ? 'Conferindo…' : 'Confirmar'}
              </button>
              <button type="button" className="os-btn" onClick={() => resend.mutate()} disabled={resend.isPending || wait > 0}>
                {wait > 0 ? `Reenviar em ${waitText(wait)}` : resend.isPending ? 'Reenviando…' : 'Reenviar código'}
              </button>
            </div>
          </form>
        </>
      )}
    </div>
  );
}
