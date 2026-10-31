'use client';

import { isApiError, type LoginResult } from '@orange-social/api';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useId, useState, type FormEvent } from 'react';
import { describedBy, FieldErrors, Notice, useDeferredFocus } from '@/components/Form';
import { IconDeadline, IconLogin } from '@/components/icons';
import { api } from '@/lib/api';
import { formatDate } from '@/lib/format';
import { SESSION_KEY } from '@/lib/queries';
import { safeRedirect } from '@/lib/safe-redirect';
import { isPostPath, openPostPage } from '@/lib/post-format';
import { useCountdown, waitText } from '@/lib/use-countdown';

type Step = 'senha' | 'codigo' | 'reativar';

/** Entrar (RF27): e-mail e senha → código do 2FA, se ativo → oferta de reativação, se a conta estiver em exclusão. */
export function LoginView() {
  const uid = useId();
  const router = useRouter();
  const params = useSearchParams();
  const voltar = safeRedirect(params.get('voltar'), '/');
  const queryClient = useQueryClient();
  const [step, setStep] = useState<Step>('senha');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [code, setCode] = useState('');
  const [recovery, setRecovery] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldError, setFieldError] = useState<Record<string, string[]>>({});
  const [result, setResult] = useState<LoginResult | null>(null);
  const [wait, startWait] = useCountdown();
  const [alertRef, focusAlert] = useDeferredFocus<HTMLDivElement>();
  const [headingRef, focusHeading] = useDeferredFocus<HTMLHeadingElement>();

  function handleResult(r: LoginResult) {
    setError(null);
    setResult(r);
    if (r.status === 'AUTHENTICATED' && r.user) {
      queryClient.setQueryData(SESSION_KEY, r.user);
      void queryClient.invalidateQueries();
      if (isPostPath(voltar)) openPostPage(voltar);
      else router.push(voltar);
      return;
    }
    setStep(r.status === 'MFA_REQUIRED' ? 'codigo' : 'reativar');
    focusHeading();
  }

  function handleError(e: unknown) {
    if (isApiError(e, 429)) {
      startWait(e.retryAfterSeconds ?? 60);
      setError(e.detail);
    } else if (isApiError(e)) {
      setError(e.detail);
      // etapa do código expirou ou errou demais: volta para o e-mail e senha
      if (step !== 'senha' && e.status === 401 && /de novo/.test(e.detail)) {
        setStep('senha');
        setCode('');
      }
    } else {
      setError('Não foi possível entrar agora. Verifique a conexão e tente de novo.');
    }
    focusAlert();
  }

  const login = useMutation({ mutationFn: () => api.auth.login({ email: email.trim(), password }), onSuccess: handleResult, onError: handleError });
  const secondFactor = useMutation({ mutationFn: () => api.auth.loginSecondFactor(code.trim()), onSuccess: handleResult, onError: handleError });
  const reactivate = useMutation({ mutationFn: () => api.auth.reactivate(), onSuccess: handleResult, onError: handleError });
  const busy = login.isPending || secondFactor.isPending || reactivate.isPending;
  const blocked = wait > 0;

  function submitPassword(e: FormEvent) {
    e.preventDefault();
    const errs: Record<string, string[]> = {};
    if (!email.trim()) errs.email = ['Informe o seu e-mail.'];
    if (!password) errs.password = ['Informe a sua senha.'];
    setFieldError(errs);
    if (Object.keys(errs).length) return;
    login.mutate();
  }

  function submitCode(e: FormEvent) {
    e.preventDefault();
    const c = code.trim();
    if (!recovery && !/^\d{6}$/.test(c)) {
      setFieldError({ code: ['O código tem 6 números.'] });
      return;
    }
    if (recovery && c.length < 6) {
      setFieldError({ code: ['Digite o código de recuperação completo.'] });
      return;
    }
    setFieldError({});
    secondFactor.mutate();
  }

  const title = step === 'codigo' ? 'Verificação em duas etapas' : step === 'reativar' ? 'Sua conta está em exclusão' : 'Entrar';
  const errorBox = error && (
    <div ref={alertRef} tabIndex={-1} className="outline-none">
      <Notice tone="error" live>
        <p>{error}</p>
        {blocked && <p className="font-semibold">Você poderá tentar de novo em {waitText(wait)}.</p>}
      </Notice>
    </div>
  );

  return (
    <div className="grid w-full gap-6">
      <h1 ref={headingRef} tabIndex={-1} className="text-3xl font-extrabold outline-none">
        {title}
      </h1>
      {errorBox}

      {step === 'senha' && (
        <form noValidate onSubmit={submitPassword} className="grid gap-4">
          <div className="grid gap-1">
            <label htmlFor={`${uid}-email`} className="font-semibold">
              E-mail
            </label>
            <input
              id={`${uid}-email`}
              type="email"
              className="os-input"
              autoComplete="username"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              aria-invalid={fieldError.email ? true : undefined}
              aria-describedby={fieldError.email ? `${uid}-email-erro` : undefined}
              required
            />
            <FieldErrors id={`${uid}-email-erro`} errors={fieldError.email} />
          </div>
          <div className="grid gap-1">
            <label htmlFor={`${uid}-senha`} className="font-semibold">
              Senha
            </label>
            <input
              id={`${uid}-senha`}
              type={showPassword ? 'text' : 'password'}
              className="os-input"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              aria-invalid={fieldError.password ? true : undefined}
              aria-describedby={fieldError.password ? `${uid}-senha-erro` : undefined}
              required
            />
            <FieldErrors id={`${uid}-senha-erro`} errors={fieldError.password} />
            <div className="flex min-h-11 items-center gap-2">
              <input id={`${uid}-mostrar`} type="checkbox" className="size-6" checked={showPassword} onChange={(e) => setShowPassword(e.target.checked)} />
              <label htmlFor={`${uid}-mostrar`}>Mostrar senha</label>
            </div>
          </div>
          <button type="submit" className="os-btn os-btn-primary" disabled={busy || blocked}>
            <IconLogin size={18} />
            {login.isPending ? 'Entrando…' : blocked ? `Aguarde ${waitText(wait)}` : 'Entrar'}
          </button>
          <p>
            Ainda não tem conta?{' '}
            <Link href="/cadastro" className="font-semibold underline">
              Criar conta
            </Link>
          </p>
        </form>
      )}

      {step === 'codigo' && (
        <form noValidate onSubmit={submitCode} className="grid gap-4">
          <p>{recovery ? 'Digite um dos seus códigos de recuperação. Cada um vale uma vez só.' : 'Abra o app autenticador e digite o código de 6 dígitos.'}</p>
          <div className="grid gap-1">
            <label htmlFor={`${uid}-codigo`} className="font-semibold">
              {recovery ? 'Código de recuperação' : 'Código de 6 dígitos'}
            </label>
            <input
              id={`${uid}-codigo`}
              className="os-input max-w-xs font-mono text-lg tracking-widest"
              inputMode={recovery ? 'text' : 'numeric'}
              autoComplete="one-time-code"
              maxLength={recovery ? 32 : 6}
              pattern={recovery ? undefined : '[0-9]{6}'}
              value={code}
              onChange={(e) => setCode(recovery ? e.target.value : e.target.value.replace(/\D/g, ''))}
              aria-invalid={fieldError.code ? true : undefined}
              aria-describedby={describedBy(fieldError.code && `${uid}-codigo-erro`)}
              required
            />
            <FieldErrors id={`${uid}-codigo-erro`} errors={fieldError.code} />
          </div>
          <button type="submit" className="os-btn os-btn-primary" disabled={busy || blocked}>
            {secondFactor.isPending ? 'Conferindo…' : 'Confirmar e entrar'}
          </button>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className="os-btn os-btn-sm"
              onClick={() => {
                setRecovery((v) => !v);
                setCode('');
                setFieldError({});
              }}
            >
              {recovery ? 'Usar o código do app' : 'Usar um código de recuperação'}
            </button>
            <button
              type="button"
              className="os-btn os-btn-sm"
              onClick={() => {
                setStep('senha');
                setCode('');
                setError(null);
              }}
            >
              Voltar
            </button>
          </div>
        </form>
      )}

      {step === 'reativar' && (
        <div className="grid gap-4">
          {result?.deletionScheduledFor ? (
            <p>
              Ela será excluída em <strong>{formatDate(result.deletionScheduledFor)}</strong>. Até lá você pode desistir: tudo volta como estava.
            </p>
          ) : (
            <p>{result?.message ?? 'Esta conta está marcada para exclusão. Até a data final, você pode desistir: tudo volta como estava.'}</p>
          )}
          <div className="grid gap-2 sm:flex sm:flex-wrap">
            <button type="button" className="os-btn os-btn-primary" onClick={() => reactivate.mutate()} disabled={busy}>
              {reactivate.isPending ? 'Reativando…' : 'Reativar minha conta'}
            </button>
            <button
              type="button"
              className="os-btn"
              onClick={() => {
                setStep('senha');
                setPassword('');
                setError(null);
                router.push('/');
              }}
            >
              Manter a exclusão e sair
            </button>
          </div>
          <p className="flex items-start gap-1.5 text-sm text-muted">
            <IconDeadline size={16} className="mt-0.5 flex-none" />
            Depois dessa data, o perfil, a foto, os posts e os comentários da conta são apagados de vez.
          </p>
        </div>
      )}
    </div>
  );
}
