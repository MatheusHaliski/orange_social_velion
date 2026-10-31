'use client';

import { isApiError, type SessionView } from '@orange-social/api';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useId, useRef, useState, type FormEvent } from 'react';
import { ErrorSummary, Field, Notice, useDeferredFocus } from '@/components/Form';
import { IconDesktop, IconPhone } from '@/components/icons';
import { Switch } from '@/components/Switch';
import { api } from '@/lib/api';
import { mapSudoError } from '@/lib/field-errors';
import { plural } from '@/lib/format';
import { PREFERENCES_KEY, SESSIONS_KEY, usePreferences, useSession } from '@/lib/queries';
import { MfaPanel } from './MfaPanel';
import { ResultNotice, type Result } from './PreferenceControls';
import { SectionHeading } from './SectionHeading';
import { checkSudo, SudoFields, type SudoValues } from './SudoFields';

/** Configurações → Senha e segurança (RF27). */
export function SecuritySection() {
  const session = useSession();
  const user = session.data;
  if (!user) return null;
  return (
    <>
      <SectionHeading description="Senha, verificação em duas etapas e os aparelhos em que você está conectado.">Senha e segurança</SectionHeading>
      <PasswordForm withCode={user.mfaEnabled} />
      <MfaPanel account={user.email} />
      <LoginAlerts />
      <Sessions />
    </>
  );
}

type Errors = { fields: Record<string, string[]>; general: string[] };
const NONE: Errors = { fields: {}, general: [] };

function PasswordForm({ withCode }: { withCode: boolean }) {
  const uid = useId();
  const queryClient = useQueryClient();
  const [sudo, setSudo] = useState<SudoValues>({ password: '', code: '' });
  const [next, setNext] = useState('');
  const [again, setAgain] = useState('');
  const [errors, setErrors] = useState<Errors>(NONE);
  const [done, setDone] = useState<string | null>(null);
  const [summaryRef, focusSummary] = useDeferredFocus<HTMLDivElement>();
  const [doneRef, focusDone] = useDeferredFocus<HTMLDivElement>();

  const change = useMutation({
    mutationFn: () =>
      api.me.changePassword({ currentPassword: sudo.password, code: withCode ? sudo.code.replace(/\s/g, '') : null, newPassword: next }),
    onSuccess: (r) => {
      setSudo({ password: '', code: '' });
      setNext('');
      setAgain('');
      const closed = r?.otherSessionsClosed ?? 0;
      setDone(`Senha trocada.${closed ? ` Encerramos ${plural(closed, 'outra sessão', 'outras sessões')}.` : ''}`);
      void queryClient.invalidateQueries({ queryKey: SESSIONS_KEY });
      focusDone();
    },
    onError: (e) => {
      if (isApiError(e, 403)) {
        const m = mapSudoError(e.detail, withCode);
        setErrors({ fields: Object.fromEntries(Object.entries(m.fields).map(([k, v]) => [k === 'password' ? 'currentPassword' : k, v])), general: [] });
      } else if (isApiError(e, 422)) {
        setErrors({ fields: { newPassword: e.errors.length ? e.errors : [e.detail] }, general: [] });
      } else {
        const wait = isApiError(e, 429) && e.retryAfterSeconds ? ` Aguarde ${plural(Math.ceil(e.retryAfterSeconds / 60), 'minuto', 'minutos')}.` : '';
        setErrors({ fields: {}, general: [isApiError(e) ? `${e.detail}${wait}` : 'Não foi possível trocar a senha agora. Tente de novo.'] });
      }
      focusSummary();
    },
  });

  function submit(e: FormEvent) {
    e.preventDefault();
    setDone(null);
    const local = checkSudo(sudo, withCode);
    const fields: Record<string, string[]> = {};
    if (local.password) fields.currentPassword = local.password;
    if (local.code) fields.code = local.code;
    if (next.length < 12) fields.newPassword = ['A senha precisa ter pelo menos 12 caracteres. Uma frase com várias palavras funciona bem.'];
    else if (next === sudo.password) fields.newPassword = ['A senha nova precisa ser diferente da atual.'];
    if (again !== next) fields.confirm = ['A confirmação não é igual à senha nova.'];
    if (Object.keys(fields).length) {
      setErrors({ fields, general: [] });
      focusSummary();
      return;
    }
    setErrors(NONE);
    change.mutate();
  }

  const summary = [
    ...Object.entries(errors.fields).flatMap(([f, msgs]) =>
      msgs.map((message) => ({ message, fieldId: f === 'currentPassword' ? `${uid}-password` : `${uid}-${f}` })),
    ),
    ...errors.general.map((message) => ({ message })),
  ];

  return (
    <form noValidate onSubmit={submit} aria-labelledby={`${uid}-titulo`} className="os-card grid gap-4 p-5">
      <h2 id={`${uid}-titulo`} className="text-xl font-bold">
        Trocar a senha
      </h2>
      <p className="text-sm text-muted">Trocar a senha encerra as suas sessões nos outros aparelhos.</p>
      <ErrorSummary ref={summaryRef} items={summary} />
      <SudoFields
        idPrefix={uid}
        values={sudo}
        onChange={setSudo}
        withCode={withCode}
        errors={{ password: errors.fields.currentPassword, code: errors.fields.code }}
      />
      <div className="grid gap-4 sm:grid-cols-2">
        <Field id={`${uid}-newPassword`} label="Senha nova" required hint="Pelo menos 12 caracteres." errors={errors.fields.newPassword}>
          {(a) => <input {...a} type="password" className="os-input" autoComplete="new-password" value={next} onChange={(e) => setNext(e.target.value)} />}
        </Field>
        <Field id={`${uid}-confirm`} label="Repita a senha nova" required errors={errors.fields.confirm}>
          {(a) => <input {...a} type="password" className="os-input" autoComplete="new-password" value={again} onChange={(e) => setAgain(e.target.value)} />}
        </Field>
      </div>
      <div ref={doneRef} tabIndex={-1} className="outline-none">
        {done && (
          <Notice tone="success" live>
            <p>{done}</p>
          </Notice>
        )}
      </div>
      <div>
        <button type="submit" className="os-btn os-btn-primary" disabled={change.isPending}>
          {change.isPending ? 'Trocando…' : 'Trocar a senha'}
        </button>
      </div>
    </form>
  );
}

function LoginAlerts() {
  const uid = useId();
  const prefs = usePreferences();
  const queryClient = useQueryClient();
  const [result, setResult] = useState<Result>(null);
  const resultRef = useRef<HTMLDivElement>(null);
  const save = useMutation({
    mutationFn: (loginAlerts: boolean) => api.me.updatePreferences({ loginAlerts }),
    onSuccess: (view) => {
      queryClient.setQueryData(PREFERENCES_KEY, view);
      setResult({ tone: 'success', text: view.loginAlerts ? 'Alertas de login ligados.' : 'Alertas de login desligados.' });
    },
    onError: (e) => setResult({ tone: 'error', text: isApiError(e) ? e.detail : 'Não foi possível salvar agora.' }),
  });
  if (!prefs.data) return null;
  return (
    <section aria-labelledby={`${uid}-titulo`} className="os-card grid gap-2 p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="grid gap-0.5">
          <h2 id={`${uid}-titulo`} className="text-xl font-bold">
            Alertas de login
          </h2>
          <p id={`${uid}-desc`} className="text-sm text-muted">
            E-mail a cada entrada nova na sua conta.
          </p>
        </div>
        <Switch
          id={`${uid}-chave`}
          checked={prefs.data.loginAlerts}
          onChange={(v) => save.mutate(v)}
          labelledBy={`${uid}-titulo`}
          describedBy={`${uid}-desc`}
          busy={save.isPending}
        />
      </div>
      <ResultNotice result={result} innerRef={resultRef} />
    </section>
  );
}

const dateTime = new Intl.DateTimeFormat('pt-BR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: 'America/Sao_Paulo' });

function when(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '' : dateTime.format(d);
}

const CHANNEL: Record<string, string> = { WEB: 'navegador', ANDROID: 'app Android', IOS: 'app iOS' };

function Sessions() {
  const uid = useId();
  const queryClient = useQueryClient();
  const sessions = useQuery({ queryKey: SESSIONS_KEY, queryFn: () => api.me.sessions() });
  const [result, setResult] = useState<Result>(null);
  const [resultRef, focusResult] = useDeferredFocus<HTMLDivElement>();
  const headingRef = useRef<HTMLHeadingElement>(null);

  const report = (r: Result) => {
    setResult(r);
    focusResult();
  };

  const end = useMutation({
    mutationFn: (s: SessionView) => api.me.endSession(s.id),
    onSuccess: (_v, s) => {
      queryClient.setQueryData<SessionView[]>(SESSIONS_KEY, (old) => old?.filter((x) => x.id !== s.id));
      report({ tone: 'success', text: `Sessão encerrada: ${s.device ?? 'aparelho desconhecido'}.` });
    },
    onError: (e) => {
      void queryClient.invalidateQueries({ queryKey: SESSIONS_KEY });
      report({ tone: 'error', text: isApiError(e, 404) ? 'Essa sessão já tinha terminado.' : isApiError(e) ? e.detail : 'Não foi possível encerrar agora.' });
    },
  });

  const endOthers = useMutation({
    mutationFn: () => api.me.endOtherSessions(),
    onSuccess: (r) => {
      queryClient.setQueryData<SessionView[]>(SESSIONS_KEY, (old) => old?.filter((x) => x.current));
      const n = r?.closed ?? 0;
      report({ tone: 'success', text: n ? `Você saiu de ${plural(n, 'outro aparelho', 'outros aparelhos')}.` : 'Não havia outros aparelhos conectados.' });
    },
    onError: (e) => report({ tone: 'error', text: isApiError(e) ? e.detail : 'Não foi possível encerrar agora.' }),
  });

  const others = sessions.data?.filter((s) => !s.current).length ?? 0;

  return (
    <section aria-labelledby={`${uid}-titulo`} className="grid gap-3">
      <h2 id={`${uid}-titulo`} ref={headingRef} tabIndex={-1} className="text-xl font-bold outline-none">
        Onde você está conectado
      </h2>
      <div ref={resultRef} tabIndex={-1} className="outline-none">
        {result && (
          <Notice tone={result.tone} live>
            <p>{result.text}</p>
          </Notice>
        )}
      </div>
      {sessions.isPending && <p className="text-muted">Carregando…</p>}
      {sessions.isError && (
        <Notice tone="error">
          <p>Não foi possível carregar as sessões.</p>
        </Notice>
      )}
      {sessions.data && (
        <ul className="os-card divide-y divide-line" data-testid="lista-sessoes">
          {sessions.data.map((s) => {
            const mobile = s.channel === 'ANDROID' || s.channel === 'IOS' || /android|ios|iphone/i.test(s.device ?? '');
            const Icon = mobile ? IconPhone : IconDesktop;
            const name = s.device ?? 'Aparelho desconhecido';
            return (
              <li key={s.id} className="flex flex-wrap items-center gap-3 p-4">
                <Icon size={22} className="flex-none" />
                <div className="grid min-w-0 flex-1 gap-0.5">
                  <p className="font-bold">{name}</p>
                  <p className="text-sm text-muted">
                    {s.current && <span className="font-semibold text-fg">Esta sessão · </span>}
                    {CHANNEL[s.channel ?? ''] ?? s.channel ?? 'navegador'} · último acesso em {when(s.lastAccessAt)} · desde {when(s.createdAt)}
                  </p>
                </div>
                {!s.current && (
                  <button
                    type="button"
                    className="os-btn os-btn-sm"
                    onClick={() => end.mutate(s)}
                    disabled={end.isPending && end.variables?.id === s.id}
                    aria-label={`Sair de ${name}`}
                  >
                    Sair
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      )}
      {others > 0 && (
        <div>
          <button type="button" className="os-btn" onClick={() => endOthers.mutate()} disabled={endOthers.isPending}>
            {endOthers.isPending ? 'Encerrando…' : 'Sair de todos os outros aparelhos'}
          </button>
        </div>
      )}
    </section>
  );
}
