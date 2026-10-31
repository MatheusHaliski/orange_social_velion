'use client';

import { isApiError, type MfaSetupView, type MfaStatusView, type RecoveryCodesView } from '@orange-social/api';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useId, useRef, useState, type FormEvent } from 'react';
import { describedBy, ErrorSummary, FieldErrors, Notice, useDeferredFocus } from '@/components/Form';
import { IconMfaOn } from '@/components/icons';
import { api } from '@/lib/api';
import { mapSudoError } from '@/lib/field-errors';
import { formatDate, plural } from '@/lib/format';
import { MFA_KEY, SESSION_KEY } from '@/lib/queries';
import { QrCode } from './QrCode';
import { RecoveryCodes } from './RecoveryCodes';
import { checkSudo, SudoFields, sudoBody, type SudoValues } from './SudoFields';

type Step = 'inicio' | 'senha' | 'qr' | 'codigos' | 'regenerar' | 'desativar';
type Errors = { fields: Record<string, string[]>; general: string[] };
const NONE: Errors = { fields: {}, general: [] };

const timeFmt = new Intl.DateTimeFormat('pt-BR', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Sao_Paulo' });

/** "JBSWY3DPEHPK3PXP" → "JBSW Y3DP EHPK 3PXP" (mais fácil de digitar). */
export function groupSecret(secret: string): string {
  return secret.replace(/\s/g, '').replace(/(.{4})(?=.)/g, '$1 ');
}

function apiErrors(e: unknown, withCode: boolean): Errors {
  if (isApiError(e, 403)) return mapSudoError(e.detail, withCode);
  if (isApiError(e, 429)) {
    const wait = e.retryAfterSeconds ? ` Tente de novo em ${plural(Math.ceil(e.retryAfterSeconds / 60), 'minuto', 'minutos')}.` : '';
    return { fields: {}, general: [`${e.detail}${wait}`] };
  }
  if (isApiError(e)) return { fields: {}, general: e.errors.length ? e.errors : [e.detail] };
  return { fields: {}, general: ['Não foi possível concluir agora. Verifique a conexão e tente de novo.'] };
}

/** Verificação em duas etapas (RF27): ativar com QR code, códigos de recuperação, gerar novos e desativar. */
export function MfaPanel({ account }: { account: string }) {
  const uid = useId();
  const queryClient = useQueryClient();
  const status = useQuery({ queryKey: MFA_KEY, queryFn: () => api.me.mfa.status() });
  const [step, setStep] = useState<Step>('inicio');
  const [sudo, setSudo] = useState<SudoValues>({ password: '', code: '' });
  const [setup, setSetup] = useState<MfaSetupView | null>(null);
  const [code, setCode] = useState('');
  const [codes, setCodes] = useState<RecoveryCodesView | null>(null);
  const [errors, setErrors] = useState<Errors>(NONE);
  const [done, setDone] = useState<string | null>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const [summaryRef, focusSummary] = useDeferredFocus<HTMLDivElement>();
  const doneRef = useRef<HTMLDivElement>(null);
  const firstRender = useRef(true);

  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    if (step === 'inicio') requestAnimationFrame(() => (done ? doneRef.current : headingRef.current)?.focus());
    else headingRef.current?.focus();
  }, [step, done]);

  const enabled = status.data?.enabled === true;

  function go(next: Step) {
    setErrors(NONE);
    setSudo({ password: '', code: '' });
    setCode('');
    setStep(next);
  }

  function fail(e: unknown, withCode: boolean) {
    const mapped = apiErrors(e, withCode);
    setErrors(mapped);
    if (isApiError(e, 409)) void queryClient.invalidateQueries({ queryKey: MFA_KEY });
    focusSummary();
  }

  function refresh(view?: MfaStatusView) {
    if (view) queryClient.setQueryData(MFA_KEY, view);
    else void queryClient.invalidateQueries({ queryKey: MFA_KEY });
    void queryClient.invalidateQueries({ queryKey: SESSION_KEY });
  }

  const start = useMutation({
    mutationFn: () => api.me.mfa.start(sudoBody(sudo, false)),
    onSuccess: (view) => {
      setSetup(view);
      go('qr');
    },
    onError: (e) => fail(e, false),
  });

  const confirm = useMutation({
    mutationFn: () => api.me.mfa.confirm(code.trim()),
    onSuccess: (view) => {
      setSetup(null);
      setCodes(view);
      refresh();
      setDone('Verificação em duas etapas ativada.');
      go('codigos');
    },
    onError: (e) => {
      if (isApiError(e, 422)) {
        setErrors({ fields: { code: e.errors.length ? e.errors : [e.detail] }, general: [] });
        if (/expirou/.test(e.detail)) setErrors({ fields: {}, general: [e.detail] });
        focusSummary();
      } else fail(e, false);
    },
  });

  const regenerate = useMutation({
    mutationFn: () => api.me.mfa.regenerateCodes(sudoBody(sudo, true)),
    onSuccess: (view) => {
      setCodes(view);
      refresh();
      setDone('Códigos novos gerados. Os antigos não valem mais.');
      go('codigos');
    },
    onError: (e) => fail(e, true),
  });

  const disable = useMutation({
    mutationFn: () => api.me.mfa.disable(sudoBody(sudo, true)),
    onSuccess: (view) => {
      refresh(view);
      setDone('Verificação em duas etapas desativada. Para entrar, agora basta a senha.');
      go('inicio');
    },
    onError: (e) => fail(e, true),
  });

  function submitSudo(e: FormEvent) {
    e.preventDefault();
    const withCode = step !== 'senha';
    const local = checkSudo(sudo, withCode);
    if (Object.keys(local).length) {
      setErrors({ fields: local, general: [] });
      focusSummary();
      return;
    }
    setErrors(NONE);
    setDone(null);
    if (step === 'senha') start.mutate();
    else if (step === 'regenerar') regenerate.mutate();
    else disable.mutate();
  }

  function submitCode(e: FormEvent) {
    e.preventDefault();
    if (!/^\d{6}$/.test(code.trim())) {
      setErrors({ fields: { code: ['O código tem 6 números.'] }, general: [] });
      focusSummary();
      return;
    }
    setErrors(NONE);
    confirm.mutate();
  }

  const summaryItems = [
    ...Object.entries(errors.fields).flatMap(([f, msgs]) => msgs.map((message) => ({ message, fieldId: `${uid}-${f}` }))),
    ...errors.general.map((message) => ({ message })),
  ];
  const busy = start.isPending || confirm.isPending || regenerate.isPending || disable.isPending;
  const titles: Record<Step, string> = {
    inicio: 'Verificação em duas etapas',
    senha: 'Ativar a verificação em duas etapas',
    qr: 'Leia o QR code no app autenticador',
    codigos: 'Seus códigos de recuperação',
    regenerar: 'Gerar novos códigos de recuperação',
    desativar: 'Desativar a verificação em duas etapas',
  };

  return (
    <section aria-labelledby={`${uid}-titulo`} className="os-card grid gap-4 p-5" data-testid="painel-2fa">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 id={`${uid}-titulo`} ref={headingRef} tabIndex={-1} className="text-xl font-bold outline-none">
          {titles[step]}
        </h2>
        {step === 'inicio' && status.data && (
          <span className="os-tag" data-testid="status-2fa">
            {enabled ? <IconMfaOn size={16} className="text-success" /> : null}
            {enabled ? 'Ativada' : 'Desativada'}
          </span>
        )}
      </div>

      <ErrorSummary ref={summaryRef} items={summaryItems} />

      {step === 'inicio' && (
        <>
          <div ref={doneRef} tabIndex={-1} className="outline-none">
            {done && (
              <Notice tone="success" live>
                <p>{done}</p>
              </Notice>
            )}
          </div>
          {status.isPending && <p className="text-muted">Carregando…</p>}
          {status.isError && (
            <Notice tone="error">
              <p>Não foi possível conferir o 2FA agora.</p>
            </Notice>
          )}
          {status.data && !enabled && (
            <>
              <p>Além da senha, peça um código do app autenticador (Google Authenticator, Aegis, 1Password…) para entrar. Sem SMS.</p>
              <div>
                <button type="button" className="os-btn os-btn-primary" onClick={() => go('senha')}>
                  Ativar
                </button>
              </div>
            </>
          )}
          {status.data && enabled && (
            <>
              <p>
                App autenticador{status.data.enabledAt ? `, desde ${formatDate(status.data.enabledAt)}` : ''} ·{' '}
                {status.data.recoveryCodesLeft} de 10 códigos de recuperação
              </p>
              {status.data.recoveryCodesLeft <= 3 && (
                <Notice>
                  <p>Restam poucos códigos de recuperação. Gere novos para não ficar sem acesso se perder o celular.</p>
                </Notice>
              )}
              <div className="flex flex-wrap gap-2">
                <button type="button" className="os-btn" onClick={() => go('regenerar')}>
                  Gerar novos códigos
                </button>
                <button type="button" className="os-btn" onClick={() => go('desativar')}>
                  Desativar
                </button>
              </div>
            </>
          )}
        </>
      )}

      {(step === 'senha' || step === 'regenerar' || step === 'desativar') && (
        <form noValidate onSubmit={submitSudo} className="grid gap-4">
          <p>
            {step === 'senha'
              ? 'Para mexer na segurança da conta, confirme a sua senha.'
              : step === 'regenerar'
                ? 'Os códigos atuais deixam de valer. Confirme a senha e o código do app.'
                : 'A conta fica protegida só pela senha. Confirme a senha e o código do app.'}
          </p>
          <SudoFields idPrefix={uid} values={sudo} onChange={setSudo} withCode={step !== 'senha'} errors={errors.fields} />
          <div className="flex flex-wrap gap-2">
            <button type="submit" className="os-btn os-btn-primary" disabled={busy}>
              {busy ? 'Conferindo…' : step === 'senha' ? 'Continuar' : step === 'regenerar' ? 'Gerar novos códigos' : 'Desativar o 2FA'}
            </button>
            <button type="button" className="os-btn" onClick={() => go('inicio')}>
              Cancelar
            </button>
          </div>
        </form>
      )}

      {step === 'qr' && setup && (
        <form noValidate onSubmit={submitCode} className="grid gap-4">
          <ol className="grid list-decimal gap-1 pl-5">
            <li>Abra o app autenticador e escolha adicionar uma conta.</li>
            <li>Leia o QR code ou digite a chave.</li>
            <li>Digite o código de 6 dígitos que o app mostrar.</li>
          </ol>
          <div className="flex flex-wrap items-start gap-6">
            <QrCode value={setup.otpauthUri} label={`QR code para adicionar ${setup.issuer} (${setup.account}) ao app autenticador`} />
            <div className="grid gap-2">
              <p className="text-sm text-muted">Não consegue ler? Digite a chave:</p>
              <p className="font-mono text-lg font-bold break-all" data-testid="chave-2fa">
                {groupSecret(setup.secret)}
              </p>
              <p className="text-sm text-muted">
                Conta: {setup.issuer} · {setup.account}
                <br />A chave vale até {timeFmt.format(new Date(setup.expiresAt))}.
              </p>
            </div>
          </div>
          <div className="grid gap-1 sm:max-w-xs">
            <label htmlFor={`${uid}-code`} className="font-semibold">
              Código de 6 dígitos
            </label>
            <input
              id={`${uid}-code`}
              className="os-input font-mono text-lg tracking-widest"
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
              aria-invalid={errors.fields.code ? true : undefined}
              aria-describedby={describedBy(errors.fields.code && `${uid}-code-erro`)}
            />
            <FieldErrors id={`${uid}-code-erro`} errors={errors.fields.code} />
          </div>
          <div className="flex flex-wrap gap-2">
            <button type="submit" className="os-btn os-btn-primary" disabled={busy}>
              {confirm.isPending ? 'Conferindo…' : 'Confirmar e ativar'}
            </button>
            <button
              type="button"
              className="os-btn"
              onClick={() => {
                setSetup(null);
                go('inicio');
              }}
            >
              Cancelar
            </button>
          </div>
        </form>
      )}

      {step === 'codigos' && codes && (
        <>
          <Notice tone="success" live>
            <p>{done}</p>
          </Notice>
          <RecoveryCodes
            codes={codes.codes}
            generatedAt={codes.generatedAt}
            account={account}
            onDone={() => {
              setCodes(null);
              setDone(null);
              go('inicio');
            }}
          />
        </>
      )}
    </section>
  );
}
