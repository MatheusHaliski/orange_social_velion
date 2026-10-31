'use client';

import type { AppBackground, FeedType, NotificationKey, PreferencesPatch, PreferencesView, ThemePreference } from '@orange-social/api';
import { useEffect, useId, useState, type FormEvent } from 'react';
import { FieldErrors, Notice } from '@/components/Form';
import { APP_BACKGROUNDS, applyAppBackground } from '@/lib/app-background';
import { FEEDS } from '@/lib/feeds';
import { usePreferences } from '@/lib/queries';
import { applyTheme, modeFromPreference } from '@/lib/theme';
import { CheckRow, MinorNotice, RadioPills, ResultNotice, useSavePreferences } from './PreferenceControls';
import { SectionHeading } from './SectionHeading';

const NOTIFICATIONS: ReadonlyArray<{ key: NotificationKey; label: string; hint?: string }> = [
  { key: 'likes', label: 'Curtidas' },
  { key: 'comments', label: 'Comentários' },
  { key: 'shares', label: 'Compartilhamentos' },
  { key: 'officialAlerts', label: 'Alertas oficiais', hint: 'Defesa Civil e outras fontes verificadas da sua região.' },
];

/** Configurações → Exibição (RF2): tema, fundo do app, texto, feed inicial, idioma, bem-estar e notificações. */
export function DisplaySection() {
  const prefs = usePreferences();
  return (
    <>
      <SectionHeading description="Como o Orange Social aparece para você e o que ele avisa.">Exibição</SectionHeading>
      {prefs.data?.minorProtectionsLocked && <MinorNotice />}
      {prefs.isPending && <p className="text-muted">Carregando…</p>}
      {prefs.isError && (
        <Notice tone="error">
          <p>Não foi possível carregar as suas preferências. Recarregue a página.</p>
        </Notice>
      )}
      {prefs.data && <DisplayForm prefs={prefs.data} />}
    </>
  );
}

function DisplayForm({ prefs }: { prefs: PreferencesView }) {
  const uid = useId();
  const id = (s: string) => `${uid}-${s}`;
  const locked = prefs.minorProtectionsLocked;
  const [theme, setTheme] = useState<ThemePreference>(prefs.theme);
  const [appBackground, setAppBackground] = useState<AppBackground>(prefs.appBackground);
  const [fontScale, setFontScale] = useState(prefs.fontScale);
  const [reduceMotion, setReduceMotion] = useState(prefs.reduceMotion);
  const [defaultFeed, setDefaultFeed] = useState<FeedType>(prefs.defaultFeed);
  const [language, setLanguage] = useState(prefs.language);
  const [reminderOn, setReminderOn] = useState(prefs.usageReminderMinutes !== null);
  const [reminder, setReminder] = useState(String(prefs.usageReminderMinutes ?? 60));
  const [loginNotifications, setNotifications] = useState(() => ({ likes: true, comments: true, shares: true, officialAlerts: true, ...prefs.notifications }));
  const [reminderError, setReminderError] = useState<string[] | undefined>();
  const { mutation, result, resultRef } = useSavePreferences('Exibição salva.', (view) => applyTheme(modeFromPreference(view.theme)));
  // o fundo escolhido aparece na hora; sem salvar, volta ao que está guardado ao sair da tela
  const saved = prefs.appBackground;
  useEffect(() => {
    applyAppBackground(appBackground);
  }, [appBackground]);
  useEffect(() => () => applyAppBackground(saved), [saved]);

  function submit(e: FormEvent) {
    e.preventDefault();
    const patch: PreferencesPatch = { theme, appBackground, fontScale, reduceMotion, defaultFeed, language, notifications: loginNotifications };
    if (reminderOn) {
      const n = Number(reminder);
      if (!Number.isInteger(n) || n < 10 || n > 600) {
        setReminderError(['O lembrete de tempo de uso vai de 10 a 600 minutos.']);
        requestAnimationFrame(() => document.getElementById(id('lembrete-min'))?.focus());
        return;
      }
      patch.usageReminderMinutes = n;
    } else if (prefs.usageReminderMinutes !== null) {
      patch.clearUsageReminder = true;
    }
    setReminderError(undefined);
    mutation.mutate(patch);
  }

  return (
    <form noValidate onSubmit={submit} className="grid gap-6">
      <section aria-labelledby={id('tema')} className="os-card grid gap-5 p-5">
        <h2 id={id('tema')} className="text-xl font-bold">
          Tema e fundo
        </h2>
        <RadioPills<ThemePreference>
          name={id('tema-opcoes')}
          legend="Tema"
          hint="“Sistema” segue a configuração do aparelho. Vale para o app todo ao salvar."
          value={theme}
          onChange={setTheme}
          options={[
            { value: 'SYSTEM', label: 'Sistema' },
            { value: 'DARK', label: 'Escuro' },
            { value: 'LIGHT', label: 'Claro' },
          ]}
        />
        <BackgroundPicker id={id('fundo')} value={appBackground} onChange={setAppBackground} />
      </section>

      <section aria-labelledby={id('acess')} className="os-card grid gap-5 p-5">
        <h2 id={id('acess')} className="text-xl font-bold">
          Acessibilidade e idioma
        </h2>
        <div className="grid gap-1">
          <label htmlFor={id('fonte')} className="font-semibold">
            Tamanho do texto
          </label>
          <p id={id('fonte-dica')} className="text-sm text-muted">
            De 85% a 150%.
          </p>
          <div className="flex items-center gap-3">
            <input
              id={id('fonte')}
              type="range"
              min={85}
              max={150}
              step={5}
              className="h-11 w-full max-w-sm accent-primary"
              value={fontScale}
              onChange={(e) => setFontScale(Number(e.target.value))}
              aria-describedby={id('fonte-dica')}
              aria-valuetext={`${fontScale}%`}
            />
            <output htmlFor={id('fonte')} className="min-w-14 font-bold" data-testid="tamanho-fonte">
              {fontScale}%
            </output>
          </div>
          <p className="text-muted" style={{ fontSize: `${fontScale}%` }} aria-hidden="true">
            Prévia: Fim de tarde no Parque Barigui.
          </p>
        </div>
        <CheckRow id={id('movimento')} label="Reduzir movimento" hint="Menos animações e transições." checked={reduceMotion} onChange={setReduceMotion} />
        <RadioPills<FeedType>
          name={id('feed')}
          legend="Feed inicial"
          hint="O feed que abre primeiro no Segmented Switcher."
          value={defaultFeed}
          onChange={setDefaultFeed}
          options={FEEDS.map((f) => ({ value: f.type, label: f.label }))}
        />
        <div className="grid gap-1 sm:max-w-xs">
          <label htmlFor={id('idioma')} className="font-semibold">
            Idioma
          </label>
          <select id={id('idioma')} className="os-input" value={language} onChange={(e) => setLanguage(e.target.value)} aria-describedby={id('idioma-dica')}>
            <option value="pt-BR">Português (Brasil)</option>
          </select>
          <p id={id('idioma-dica')} className="text-sm text-muted">
            Por enquanto, só português.
          </p>
        </div>
      </section>

      <section aria-labelledby={id('bem-estar')} className="os-card grid gap-4 p-5">
        <h2 id={id('bem-estar')} className="text-xl font-bold">
          Bem-estar
        </h2>
        <CheckRow
          id={id('lembrete')}
          label="Lembrete de tempo de uso"
          hint="Avisa quando você passa do tempo escolhido no app."
          checked={reminderOn}
          onChange={setReminderOn}
          locked={locked && reminderOn}
        />
        {reminderOn && (
          <div className="grid gap-1 pl-8 sm:max-w-xs">
            <label htmlFor={id('lembrete-min')} className="font-semibold">
              Minutos por dia
            </label>
            <input
              id={id('lembrete-min')}
              type="number"
              inputMode="numeric"
              min={10}
              max={600}
              className="os-input"
              value={reminder}
              onChange={(e) => setReminder(e.target.value)}
              aria-invalid={reminderError ? true : undefined}
              aria-describedby={reminderError ? id('lembrete-min-erro') : undefined}
            />
            <FieldErrors id={id('lembrete-min-erro')} errors={reminderError} />
          </div>
        )}
      </section>

      <section aria-labelledby={id('notif')} className="os-card grid gap-1 p-5">
        <h2 id={id('notif')} className="mb-2 text-xl font-bold">
          Notificações
        </h2>
        {NOTIFICATIONS.map((n) => (
          <CheckRow
            key={n.key}
            id={id(`notif-${n.key}`)}
            label={n.label}
            hint={n.hint}
            checked={loginNotifications[n.key] !== false}
            onChange={(v) => setNotifications((cur) => ({ ...cur, [n.key]: v }))}
          />
        ))}
      </section>

      <ResultNotice result={result} innerRef={resultRef} />
      <div>
        <button type="submit" className="os-btn os-btn-primary" disabled={mutation.isPending}>
          {mutation.isPending ? 'Salvando…' : 'Salvar exibição'}
        </button>
      </div>
    </form>
  );
}

/**
 * Fundo do app (RF2): 8 miniaturas num radiogroup (liso, rede com o logo e os 6 mosaicos). A escolhida ganha borda,
 * fundo e o ✓ — não só a cor. A escolha aparece na hora atrás desta tela.
 */
function BackgroundPicker({ id, value, onChange }: { id: string; value: AppBackground; onChange: (v: AppBackground) => void }) {
  return (
    <fieldset className="grid gap-2" aria-describedby={`${id}-dica`}>
      <legend className="font-semibold">Fundo do app</legend>
      <p id={`${id}-dica`} className="text-sm text-muted">
        Um véu fica por cima do fundo para os posts continuarem legíveis. A escolha aparece na hora; salve para guardar.
      </p>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4" data-testid="fundos">
        {APP_BACKGROUNDS.map((b) => (
          <label key={b.code} className="relative">
            <input
              type="radio"
              name={id}
              value={b.code}
              className="os-visually-hidden-input peer"
              checked={value === b.code}
              onChange={() => onChange(b.code)}
            />
            <span className="os-bg-opt">
              <span
                aria-hidden="true"
                className="os-bg-thumb"
                data-kind={b.code === 'PLAIN' ? 'plain' : b.code === 'NETWORK' ? 'network' : 'mosaic'}
                style={b.thumb ? { backgroundImage: `url(${b.thumb})` } : undefined}
              />
              <span className="text-sm font-semibold">{b.label}</span>
            </span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}
