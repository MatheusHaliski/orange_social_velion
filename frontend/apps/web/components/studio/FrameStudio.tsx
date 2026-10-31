'use client';

import type { CategoryCode, FrameCatalog, HypeStyle, MediaKind, MetamorphoseMode, PostCardView } from '@orange-social/api';
import { useId, useState, type ReactNode } from 'react';
import { TabPanel, Tabs } from '@/components/Tabs';
import { FieldErrors, Notice } from '@/components/Form';
import { IconFormError, IconSuccess } from '@/components/icons';
import { PostCard } from '@/components/post/PostCard';
import {
  DARK_INK,
  LIGHT_INK,
  applyStudio,
  containerOf,
  confeteArt,
  eclipseArt,
  isHex,
  previewBackground,
  seasonGradient,
  type FrameState,
  type StudioAction,
} from '@/lib/frame';
import { useFrameRecommendations, useMotionAllowed } from '@/lib/post-queries';
import { SeasonDialog } from './SeasonDialog';
import { Swatch } from './Swatch';

type StudioTab = 'cor' | 'aura' | 'layout' | 'container';

interface Props {
  catalog: FrameCatalog;
  state: FrameState;
  onChange: (state: FrameState) => void;
  /** Alerta oficial: sem moldura, o estúdio fica desligado. */
  disabled: boolean;
  category: CategoryCode;
  media: MediaKind;
  /** Menor de 16 (ECA Digital): só artes do catálogo, sem envio nem IA. */
  minor?: boolean;
  /** Card montado com o que já foi digitado, para a prévia ao vivo. */
  preview: PostCardView;
  errors?: string[];
}

const MATERIAL_PREVIEW = '#5B3A29';

const HYPE_LABELS: Record<HypeStyle, string> = { OFF: 'Desligada', SCANNER: 'Scanner', BRILHO: 'Brilho' };
const META_LABELS: Record<MetamorphoseMode, string> = {
  OFF: 'Desligada',
  PRISMA: 'Prisma',
  CONSTELACAO: 'Constelação',
  FIO_VIVO: 'Fio Vivo',
  HOLOGRAFIA: 'Holografia',
};

/** Amostra de uma aura: o CSS do catálogo, ou a arte gerada no cliente (Eclipse, Confete). */
function auraPaint(a: FrameCatalog['auras'][number]): string {
  if (a.css) return a.css;
  return a.id === 'confete' ? confeteArt(a.palette, 'amostra') : eclipseArt(a.palette, 'amostra');
}

/**
 * Background Studio (RF28): 4 abas (Cor · Aura e Material · Layout e Estilo · Container) com a prévia ao vivo do
 * card (Normal ou Em alta). Uma fonte de arte por vez, com limpeza automática e o aviso do que saiu; o Pôster
 * limpa a arte, o material e a Metamorfose; o contraste da tinta sobre o container é o mesmo cálculo do servidor.
 */
export function FrameStudio({ catalog, state, onChange, disabled, category, media, minor = false, preview, errors }: Props) {
  const uid = useId();
  const [tab, setTab] = useState<StudioTab>('cor');
  const [notice, setNotice] = useState('');
  const [seasonOpen, setSeasonOpen] = useState(false);
  const motion = useMotionAllowed();
  const [hot, setHot] = useState(false);
  const recs = useFrameRecommendations(category, media, !disabled);

  if (disabled) {
    return (
      <Notice>
        <p className="font-semibold">Alerta oficial não tem moldura.</p>
        <p>A faixa de alerta precisa ser reconhecida na hora, então o estúdio fica desligado para este feed.</p>
      </Notice>
    );
  }

  const act = (action: StudioAction) => {
    const r = applyStudio(state, action, catalog);
    onChange(r.state);
    setNotice(r.notice ?? '');
  };
  const poster = catalog.layouts.some((l) => l.id === state.layoutId && l.ownArt);
  const container = containerOf(state, catalog);
  const bg = previewBackground(state, catalog);
  const activeSeason = catalog.seasons.find((s) => s.id === catalog.activeSeasonId);
  const chosenSeason = state.seasonal.auto ? activeSeason : catalog.seasons.find((s) => s.id === state.seasonal.presetId);

  const posterNote = (
    <Notice>
      <p>
        O layout <strong>Pôster</strong> já traz arte própria (o mosaico da marca), então cor, gradiente, cartela, aura, Aura Plus, material e
        Metamorfose ficam de fora. Para escolher outra arte, volte para Clássico ou Polaroid.
      </p>
      <p>
        <button type="button" className="os-btn os-btn-sm" onClick={() => act({ type: 'layout', id: 'CLASSICO' })}>
          Voltar para Clássico
        </button>
      </p>
    </Notice>
  );

  return (
    <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,22rem)] lg:items-start" data-testid="estudio">
      <div className="grid min-w-0 gap-4">
        <Tabs<StudioTab>
          label="Estúdio de moldura"
          idPrefix={`${uid}-estudio`}
          selected={tab}
          onSelect={setTab}
          items={[
            { key: 'cor', label: 'Cor', testId: 'aba-estudio-cor' },
            { key: 'aura', label: 'Aura e Material', testId: 'aba-estudio-aura' },
            { key: 'layout', label: 'Layout e Estilo', testId: 'aba-estudio-layout' },
            { key: 'container', label: 'Container', testId: 'aba-estudio-container' },
          ]}
        />
        <TabPanel idPrefix={`${uid}-estudio`} tab={tab}>
          {tab === 'cor' && (
            <>
              {poster ? (
                posterNote
              ) : (
                <>
                  <Group title="Cor lisa">
                    <div className="os-strip">
                      <Swatch label="Sem arte" pressed={!bg || bg.artKind === 'NONE'} none onClick={() => act({ type: 'clearArt' })} />
                      {catalog.colors.map((c) => (
                        <Swatch key={c.id} label={c.name} paint={c.id} pressed={state.color === c.id.toUpperCase()} onClick={() => act({ type: 'color', id: c.id })} />
                      ))}
                    </div>
                  </Group>
                  <Group title="Gradientes">
                    <div className="os-strip">
                      {catalog.gradients.map((g) => (
                        <Swatch key={g.id} label={g.name} paint={g.css} pressed={state.gradientId === g.id} onClick={() => act({ type: 'gradient', id: g.id })} />
                      ))}
                    </div>
                  </Group>
                  <Group title="Cartela sazonal" hint="Hemisfério Sul, pela data de São Paulo. Nada muda até você aplicar.">
                    <div className="flex flex-wrap items-center gap-3">
                      <span aria-hidden="true" className="h-10 w-20 rounded-sm border border-line-strong" style={{ background: seasonGradient((chosenSeason ?? activeSeason)?.colors ?? []) ?? undefined }} />
                      <p className="min-w-0 flex-1" data-testid="cartela-atual">
                        {chosenSeason ? (
                          <>
                            <strong>{chosenSeason.name}</strong>
                            {state.seasonal.auto ? ' · automática pela data' : ''}
                          </>
                        ) : (
                          <>Hoje: {activeSeason?.name ?? 'nenhuma cartela automática'}</>
                        )}
                      </p>
                      <button type="button" className="os-btn os-btn-sm" onClick={() => setSeasonOpen(true)} aria-haspopup="dialog">
                        Escolher cartela…
                      </button>
                    </div>
                  </Group>
                </>
              )}
              <Group title="Animação leve" hint={`Toca uma vez, por até ${catalog.rules.maxAnimationSeconds} s, e não toca com "Reduzir movimento".`}>
                <div className="os-seg" role="group" aria-label="Animação">
                  {catalog.animations.map((a) => (
                    <button key={a.id} type="button" aria-pressed={state.animationId === a.id} onClick={() => act({ type: 'animation', id: a.id })}>
                      {a.name}
                    </button>
                  ))}
                </div>
              </Group>
            </>
          )}

          {tab === 'aura' &&
            (poster ? (
              posterNote
            ) : (
              <>
                {recs.data && recs.data.length > 0 && (
                  <Group title="Direção recomendada">
                    <ul className="grid gap-2" data-testid="recomendacoes">
                      {recs.data.map((r) => {
                        const aura = catalog.auras.find((a) => a.id === r.auraId);
                        const material = catalog.materials.find((m) => m.id === r.materialId);
                        const season = catalog.seasons.find((s) => s.id === r.seasonId);
                        const name = aura ? `${aura.name}${material ? ` + ${material.name}` : ''}` : (season?.name ?? '');
                        return (
                          <li key={`${r.auraId}-${r.materialId}-${r.seasonId}`} className="os-card flex flex-wrap items-center gap-3 p-3">
                            <span className="grid min-w-0 flex-1">
                              <span className="font-semibold">{name}</span>
                              <span className="text-sm text-muted">{r.reason}</span>
                            </span>
                            <button type="button" className="os-btn os-btn-sm" onClick={() => act({ type: 'recommendation', rec: r })}>
                              Aplicar<span className="sr-only"> {name}</span>
                            </button>
                          </li>
                        );
                      })}
                    </ul>
                  </Group>
                )}
                <Group title="Aura" hint="Arte procedural da Velion, com arquétipo e paleta.">
                  <div className="os-strip">
                    {catalog.auras.map((a) => (
                      <Swatch
                        key={a.id}
                        label={a.name}
                        description={a.archetype}
                        paint={auraPaint(a)}
                        pressed={state.aura?.presetId === a.id}
                        onClick={() => act({ type: 'aura', id: a.id })}
                      />
                    ))}
                  </div>
                </Group>
                {state.aura && (
                  <Group title="Variação e formato">
                    <div className="flex flex-wrap gap-3">
                      <div className="os-seg" role="group" aria-label="Variação">
                        <button type="button" aria-pressed={state.aura.variantId === 'ORIGINAL'} onClick={() => act({ type: 'auraVariant', variantId: 'ORIGINAL' })}>
                          Original
                        </button>
                        <button type="button" aria-pressed={state.aura.variantId === 'SUAVE'} onClick={() => act({ type: 'auraVariant', variantId: 'SUAVE' })}>
                          Suave
                        </button>
                      </div>
                      <div className="os-seg" role="group" aria-label="Formato">
                        <button type="button" aria-pressed={state.aura.format === 'IMAGEM_UNICA'} onClick={() => act({ type: 'auraFormat', format: 'IMAGEM_UNICA' })}>
                          Imagem única
                        </button>
                        <button type="button" aria-pressed={state.aura.format === 'MOSAICO'} onClick={() => act({ type: 'auraFormat', format: 'MOSAICO' })}>
                          Mosaico
                        </button>
                      </div>
                    </div>
                  </Group>
                )}
                <Group title="Material" hint="Uma textura por cima da arte da faixa.">
                  <div className="os-strip">
                    <Swatch label="Nenhum" none pressed={!state.materialId} onClick={() => act({ type: 'material', id: null })} />
                    {catalog.materials.map((m) => (
                      <Swatch key={m.id} label={m.name} paint={MATERIAL_PREVIEW} pressed={state.materialId === m.id} onClick={() => act({ type: 'material', id: m.id })}>
                        <span className={`os-frame-mat os-mat-${m.id}`} />
                      </Swatch>
                    ))}
                  </div>
                </Group>
                <Group
                  title="Aura Plus"
                  hint={`Vídeo curto em loop (nunca GIF): toca até ${catalog.rules.maxAnimationSeconds} s quando o card aparece e volta ao pôster. Com "Reduzir movimento", só o pôster.`}
                >
                  <div className="os-strip" data-testid="aura-plus-opcoes">
                    {catalog.auraPlus.map((a) => (
                      <Swatch
                        key={a.id}
                        label={a.name}
                        description={a.archetype}
                        paint={`#17120D url("${a.poster}") center/cover`}
                        pressed={state.auraPlusId === a.id}
                        onClick={() => act({ type: 'auraPlus', id: a.id })}
                      />
                    ))}
                  </div>
                </Group>
                <Group title="Aura Hype" hint="O efeito só liga quando o post entra em alta. O texto “em alta” continua sendo o sinal.">
                  <div className="os-seg" role="group" aria-label="Aura Hype">
                    {catalog.hypeStyles.map((h) => (
                      <button key={h} type="button" aria-pressed={state.auraHypeStyle === h} onClick={() => act({ type: 'hype', style: h })}>
                        {HYPE_LABELS[h]}
                      </button>
                    ))}
                  </div>
                </Group>
                <Group title="Metamorfose" hint="Uma camada de efeito por cima da arte da faixa.">
                  <div className="os-seg" role="group" aria-label="Metamorfose">
                    {catalog.metamorphoseModes.map((m) => (
                      <button key={m} type="button" aria-pressed={state.metamorphose === m} onClick={() => act({ type: 'metamorphose', mode: m })}>
                        {META_LABELS[m]}
                      </button>
                    ))}
                  </div>
                </Group>
                <Group title="Arte própria">
                  <p className="text-sm" data-testid="arte-propria">
                    {minor
                      ? 'Para menores de 16 anos a moldura usa só artes do catálogo, sem envio nem IA (ECA Digital).'
                      : '⏳ Enviar a sua arte ou gerar por IA ainda não está disponível: precisa de moderação e da checagem de flashes (OS-69, OS-70).'}
                  </p>
                </Group>
              </>
            ))}

          {tab === 'layout' && (
            <>
              <Group title="Layout">
                <div className="os-strip">
                  {catalog.layouts.map((l) => (
                    <Swatch
                      key={l.id}
                      label={l.name}
                      paint={
                        l.id === 'POSTER'
                          ? undefined
                          : l.id === 'POLAROID'
                            ? 'linear-gradient(#F5EDE3 0 0) 50% 30%/70% 55% no-repeat, #E2D6C8'
                            : 'linear-gradient(#2A2119 0 0) center/72% 70% no-repeat, #8C847A'
                      }
                      pressed={state.layoutId === l.id}
                      onClick={() => act({ type: 'layout', id: l.id })}
                    >
                      {l.id === 'POSTER' && <span className="os-frame-paint os-frame-poster" />}
                    </Swatch>
                  ))}
                </div>
              </Group>
              <p className="text-sm text-muted">Pôster já traz arte própria (o mosaico da marca), então tira a arte, o material e a Metamorfose escolhidos.</p>
              <Group title="Skin (estilo do container)">
                <div className="os-strip">
                  {catalog.skins.map((k) => (
                    <Swatch key={k.id} label={k.name} paint={k.containerColor} pressed={state.skinId === k.id} onClick={() => act({ type: 'skin', id: k.id })} />
                  ))}
                </div>
              </Group>
            </>
          )}

          {tab === 'container' && (
            <>
              <Group title="Cor do container" hint="O container é opaco: autor, categoria, mídia e texto ficam nele, nunca sobre a arte.">
                <div className="os-strip">
                  <Swatch
                    label="Da skin"
                    paint={catalog.skins.find((k) => k.id === state.skinId)?.containerColor}
                    pressed={!state.container.color}
                    onClick={() => act({ type: 'containerColor', color: null })}
                  />
                  {catalog.containerColors.map((c) => (
                    <Swatch key={c.id} label={c.name} paint={c.id} pressed={state.container.color === c.id.toUpperCase()} onClick={() => act({ type: 'containerColor', color: c.id })} />
                  ))}
                </div>
                <ColorInput
                  id={`${uid}-cor-container`}
                  label="Outra cor do container"
                  value={state.container.color && !catalog.containerColors.some((c) => c.id.toUpperCase() === state.container.color) ? state.container.color : '#3A2A1A'}
                  onChange={(hex) => act({ type: 'containerColor', color: hex })}
                />
              </Group>
              <Group title="Cor dos textos (tinta)">
                <div className="os-strip">
                  <Swatch label="Automática" paint={`linear-gradient(135deg, ${LIGHT_INK} 50%, ${DARK_INK} 50%)`} pressed={state.container.ink === 'AUTO'} onClick={() => act({ type: 'ink', ink: 'AUTO' })} />
                  <Swatch label="Clara" paint={LIGHT_INK} pressed={state.container.ink === LIGHT_INK} onClick={() => act({ type: 'ink', ink: LIGHT_INK })} />
                  <Swatch label="Escura" paint={DARK_INK} pressed={state.container.ink === DARK_INK} onClick={() => act({ type: 'ink', ink: DARK_INK })} />
                </div>
                <ColorInput
                  id={`${uid}-tinta`}
                  label="Outra cor dos textos"
                  value={isHex(state.container.ink) && state.container.ink !== LIGHT_INK && state.container.ink !== DARK_INK ? state.container.ink : '#F7C948'}
                  onChange={(hex) => act({ type: 'ink', ink: hex })}
                />
              </Group>
            </>
          )}
        </TabPanel>

        {/* contraste: sempre visível, porque cor e tinta mudam em abas diferentes */}
        <div data-testid="contraste">
          {container.ok ? (
            <p role="status" className="flex items-start gap-2 text-sm">
              <IconSuccess size={18} className="mt-0.5 flex-none text-success" />
              <span>
                Texto com contraste <strong>{container.contrast}</strong> sobre o container: passa no WCAG AA (mínimo 4,5:1).
              </span>
            </p>
          ) : (
            <div role="alert" className="grid gap-2 rounded-md border-2 border-error p-3">
              <p className="flex items-start gap-2 font-semibold text-error">
                <IconFormError size={18} className="mt-0.5 flex-none" />
                <span>
                  Texto com contraste {container.contrast}: abaixo de 4,5:1, fica difícil de ler e o post não é salvo assim.
                </span>
              </p>
              <p>
                Sugestão: tinta {container.suggestion === DARK_INK ? 'escura' : 'clara'} ({container.suggestionContrast}).{' '}
                <button type="button" className="os-btn os-btn-sm" onClick={() => act({ type: 'ink', ink: 'AUTO' })}>
                  Usar a tinta sugerida
                </button>
              </p>
            </div>
          )}
        </div>
        <p role="status" aria-live="polite" className="text-sm font-semibold" data-testid="aviso-estudio">
          {notice}
        </p>
        <FieldErrors id="post-background-erro" errors={errors} />
      </div>

      <div className="order-first grid min-w-0 gap-2 lg:sticky lg:top-24 lg:order-last">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="font-mono text-sm font-bold uppercase tracking-widest text-muted" id={`${uid}-previa`}>
            Prévia ao vivo
          </p>
          <div className="os-seg" role="group" aria-label="Estado da prévia">
            <button type="button" aria-pressed={!hot} onClick={() => setHot(false)}>
              Normal
            </button>
            <button type="button" aria-pressed={hot} onClick={() => setHot(true)} data-testid="previa-em-alta">
              Em alta
            </button>
          </div>
        </div>
        <div aria-labelledby={`${uid}-previa`} role="group" data-testid="previa">
          <PostCard post={{ ...preview, background: bg, trending: hot ? 'HOT' : null }} motion={motion} preview />
        </div>
      </div>

      <SeasonDialog
        open={seasonOpen}
        catalog={catalog}
        current={state.seasonal}
        onClose={() => setSeasonOpen(false)}
        onApply={(choice) => {
          setSeasonOpen(false);
          act({ type: 'season', presetId: choice.presetId, auto: choice.auto });
        }}
      />
    </div>
  );
}

function Group({ title, hint, children }: { title: string; hint?: string; children: ReactNode }) {
  const id = useId();
  return (
    <section aria-labelledby={id} className="grid gap-2">
      <h3 id={id} className="font-bold">
        {title}
      </h3>
      {hint && <p className="text-sm text-muted">{hint}</p>}
      {children}
    </section>
  );
}

function ColorInput({ id, label, value, onChange }: { id: string; label: string; value: string; onChange: (hex: string) => void }) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <input id={id} type="color" value={value.toLowerCase()} onChange={(e) => onChange(e.target.value)} className="h-11 w-14 cursor-pointer rounded-sm border border-line-strong bg-surface" />
      <label htmlFor={id} className="text-sm font-semibold">
        {label}
      </label>
    </div>
  );
}
