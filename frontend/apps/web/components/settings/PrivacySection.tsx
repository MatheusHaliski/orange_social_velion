'use client';

import { isApiError, type CommentAudience, type ConsentPurpose, type ConsentView, type PreferencesView, type SensitiveContent } from '@orange-social/api';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { useId, useState, type FormEvent } from 'react';
import { Notice, useDeferredFocus } from '@/components/Form';
import { api } from '@/lib/api';
import { CONSENTS_KEY, PROFILE_KEY, useConsents, usePreferences } from '@/lib/queries';
import { ConsentSwitch } from './ConsentSwitch';
import { CheckRow, MinorNotice, RadioPills, ResultNotice, useSavePreferences, type Result } from './PreferenceControls';
import { SectionHeading } from './SectionHeading';

/** Configurações → Privacidade (RF2 · RF3): quem vê e comenta e os 6 consentimentos opcionais (ConsentPurpose). */
export function PrivacySection() {
  const prefs = usePreferences();
  return (
    <>
      <SectionHeading description="Privacidade por padrão: todo uso opcional dos seus dados começa desligado. Revogar é o mesmo toque que autorizar.">
        Privacidade
      </SectionHeading>
      {prefs.data?.minorProtectionsLocked && <MinorNotice />}
      {prefs.isPending && <p className="text-muted">Carregando…</p>}
      {prefs.isError && (
        <Notice tone="error">
          <p>Não foi possível carregar as suas preferências. Recarregue a página.</p>
        </Notice>
      )}
      {prefs.data && <AudienceForm prefs={prefs.data} />}
      <Consents />
      <p className="text-sm">
        Como o Orange Social trata os seus dados está nos{' '}
        <Link href="/termos" className="font-semibold underline">
          Termos de Uso
        </Link>
        .
      </p>
    </>
  );
}

function AudienceForm({ prefs }: { prefs: PreferencesView }) {
  const uid = useId();
  const locked = prefs.minorProtectionsLocked;
  const [profilePrivate, setProfilePrivate] = useState(prefs.profilePrivate);
  const [whoCanComment, setWhoCanComment] = useState<CommentAudience>(prefs.whoCanComment);
  const [showBirthYear, setShowBirthYear] = useState(prefs.showBirthYear);
  const [sensitiveContent, setSensitiveContent] = useState<SensitiveContent>(prefs.sensitiveContent);
  const { mutation, result, resultRef } = useSavePreferences('Privacidade salva.');

  function submit(e: FormEvent) {
    e.preventDefault();
    mutation.mutate({ profilePrivate, whoCanComment, showBirthYear, sensitiveContent });
  }

  return (
    <form noValidate onSubmit={submit} aria-labelledby={`${uid}-titulo`} className="os-card grid gap-5 p-5">
      <h2 id={`${uid}-titulo`} className="text-xl font-bold">
        Quem vê e comenta
      </h2>
      <CheckRow
        id={`${uid}-privado`}
        label="Perfil privado"
        hint="Só quem você aprovar vê as suas publicações no seu perfil."
        checked={profilePrivate}
        onChange={setProfilePrivate}
        locked={locked && profilePrivate}
      />
      <RadioPills<CommentAudience>
        name={`${uid}-comenta`}
        legend="Quem pode comentar"
        value={whoCanComment}
        onChange={setWhoCanComment}
        options={[
          { value: 'EVERYONE', label: 'Todo mundo', locked },
          { value: 'FOLLOWERS', label: 'Quem me segue' },
          { value: 'NOBODY', label: 'Ninguém' },
        ]}
      />
      <CheckRow
        id={`${uid}-ano`}
        label="Mostrar o ano de nascimento no perfil"
        hint="O dia e o mês nunca aparecem."
        checked={showBirthYear}
        onChange={setShowBirthYear}
      />
      <RadioPills<SensitiveContent>
        name={`${uid}-sensivel`}
        legend="Conteúdo sensível"
        hint="Posts 18+ ou marcados como sensíveis aparecem cobertos, com aviso e “Mostrar”."
        value={sensitiveContent}
        onChange={setSensitiveContent}
        options={[
          { value: 'LIMIT', label: 'Limitar' },
          { value: 'ALLOW', label: 'Mostrar tudo', locked },
        ]}
      />
      <ResultNotice result={result} innerRef={resultRef} />
      <div>
        <button type="submit" className="os-btn os-btn-primary" disabled={mutation.isPending}>
          {mutation.isPending ? 'Salvando…' : 'Salvar privacidade'}
        </button>
      </div>
    </form>
  );
}

function Consents() {
  const consents = useConsents();
  const queryClient = useQueryClient();
  const [result, setResult] = useState<Result>(null);
  const [pending, setPending] = useState<ConsentPurpose | null>(null);
  const [resultRef, focusResult] = useDeferredFocus<HTMLDivElement>();

  const toggle = useMutation({
    mutationFn: ({ purpose, granted }: { purpose: ConsentPurpose; granted: boolean }) => api.me.setConsent(purpose, granted),
    onMutate: ({ purpose }) => {
      setPending(purpose);
      setResult(null);
    },
    onSuccess: (item) => {
      queryClient.setQueryData<ConsentView[]>(CONSENTS_KEY, (old) => old?.map((c) => (c.purpose === item.purpose ? item : c)));
      // revogar um consentimento pode limpar dados do perfil: lê o perfil de novo
      void queryClient.invalidateQueries({ queryKey: PROFILE_KEY });
      setResult({ tone: 'success', text: `${item.label}: ${item.granted ? 'ligado' : 'desligado'}.` });
    },
    onError: (e) => {
      setResult({ tone: 'error', text: isApiError(e) ? e.detail : 'Não foi possível mudar agora. Tente de novo.' });
      focusResult();
    },
    onSettled: () => setPending(null),
  });

  return (
    <section aria-labelledby="consentimentos" className="grid gap-3">
      <h2 id="consentimentos" tabIndex={-1} className="text-xl font-bold outline-none">
        Usos opcionais dos seus dados
      </h2>
      <p className="text-muted">
        Cada um começa desligado e vale só com a sua autorização (LGPD Art. 7º, I, e Art. 11, I, para os sensíveis). Dá para desligar quando quiser, com o mesmo toque.
      </p>
      <div ref={resultRef} tabIndex={-1} className="outline-none">
        {result && (
          <Notice tone={result.tone} live>
            <p>{result.text}</p>
          </Notice>
        )}
      </div>
      {consents.isPending && <p className="text-muted">Carregando…</p>}
      {consents.isError && (
        <Notice tone="error">
          <p>Não foi possível carregar os consentimentos. Recarregue a página.</p>
        </Notice>
      )}
      {consents.data && (
        <ul className="os-card divide-y divide-line">
          {consents.data.map((c) => (
            <ConsentSwitch
              key={c.purpose}
              consent={c}
              busy={pending === c.purpose}
              onToggle={(granted) => toggle.mutate({ purpose: c.purpose, granted })}
            />
          ))}
        </ul>
      )}
    </section>
  );
}
