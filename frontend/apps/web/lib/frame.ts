// Moldura do post (RF28 · Background Studio): o estado do estúdio, as regras que o servidor também aplica (BackgroundValidator) e a
// leitura para a prévia ao vivo (BackgroundService.resolve). O contraste é o mesmo cálculo WCAG do Contrast.java.
import type {
  BackgroundView,
  FeedType,
  FrameAuraFormat,
  FrameAuraVariant,
  FrameCatalog,
  FrameConfig,
  FrameLayoutId,
  FrameRecommendation,
  HypeStyle,
  MetamorphoseMode,
} from '@orange-social/api';

// ------------------------------------------------------------ contraste (application/background/Contrast.java)

export const AA_TEXT = 4.5;
/** Tinta clara (farinha) e escura (carvão) do modo AUTO. */
export const LIGHT_INK = '#F5EDE3';
export const DARK_INK = '#17120D';
const HEX = /^#[0-9A-Fa-f]{6}$/;

export function isHex(value: unknown): value is string {
  return typeof value === 'string' && HEX.test(value);
}

function channel(value: number): number {
  const c = value / 255;
  return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}

export function luminance(hex: string): number {
  const r = channel(parseInt(hex.slice(1, 3), 16));
  const g = channel(parseInt(hex.slice(3, 5), 16));
  const b = channel(parseInt(hex.slice(5, 7), 16));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function contrastRatio(a: string, b: string): number {
  const la = luminance(a);
  const lb = luminance(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

/** Tinta automática: entre a clara e a escura, a de maior contraste com o fundo (empate fica com a clara). */
export function bestInk(background: string): string {
  return contrastRatio(LIGHT_INK, background) >= contrastRatio(DARK_INK, background) ? LIGHT_INK : DARK_INK;
}

/** "4,5:1": uma casa decimal com vírgula (o String.format do Java arredonda meio para cima). */
export function formatRatio(ratio: number): string {
  const rounded = Math.round(ratio * 10 + 1e-9) / 10;
  return `${rounded.toFixed(1).replace('.', ',')}:1`;
}

/** Mistura duas cores #RRGGBB: t = 1 é {@code a}, t = 0 é {@code b}. */
export function mixHex(a: string, b: string, t: number): string {
  const part = (i: number) => {
    const x = parseInt(a.slice(i, i + 2), 16);
    const y = parseInt(b.slice(i, i + 2), 16);
    return Math.round(x * t + y * (1 - t))
      .toString(16)
      .padStart(2, '0');
  };
  return `#${part(1)}${part(3)}${part(5)}`.toUpperCase();
}

/**
 * Tom mais fraco da tinta (texto secundário, contorno) que ainda passa no mínimo pedido: parte de {@code start} e
 * se aproxima da tinta até chegar lá.
 */
export function softerInk(ink: string, bg: string, start: number, minimum: number): string {
  let t = start;
  while (t < 1 && contrastRatio(mixHex(ink, bg, t), bg) < minimum) t += 0.02;
  return mixHex(ink, bg, Math.min(t, 1));
}

// ------------------------------------------------------------ estado do estúdio

/** A configuração com todos os campos (a forma canônica do BackgroundValidator, sem customArt). */
export interface FrameState {
  v: 1;
  color: string | null;
  gradientId: string | null;
  seasonal: { presetId: string | null; auto: boolean };
  animationId: string;
  aura: { presetId: string; variantId: FrameAuraVariant; format: FrameAuraFormat } | null;
  auraPlusId: string | null;
  auraHypeStyle: HypeStyle;
  metamorphose: MetamorphoseMode;
  materialId: string | null;
  layoutId: FrameLayoutId;
  skinId: string;
  container: { color: string | null; ink: string };
}

export const DEFAULT_FRAME: FrameState = {
  v: 1,
  color: null,
  gradientId: null,
  seasonal: { presetId: null, auto: false },
  animationId: 'NONE',
  aura: null,
  auraPlusId: null,
  auraHypeStyle: 'OFF',
  metamorphose: 'OFF',
  materialId: null,
  layoutId: 'CLASSICO',
  skinId: 'PADRAO',
  container: { color: null, ink: 'AUTO' },
};

/** Configuração gravada no post (ou null) → estado do estúdio. */
export function fromConfig(config: FrameConfig | null | undefined): FrameState {
  if (!config) return structuredClone(DEFAULT_FRAME);
  return {
    v: 1,
    color: config.color ?? null,
    gradientId: config.gradientId ?? null,
    seasonal: { presetId: config.seasonal?.presetId ?? null, auto: config.seasonal?.auto === true },
    animationId: config.animationId ?? 'NONE',
    aura: config.aura?.presetId
      ? { presetId: config.aura.presetId, variantId: config.aura.variantId ?? 'ORIGINAL', format: config.aura.format ?? 'IMAGEM_UNICA' }
      : null,
    auraPlusId: config.auraPlusId ?? null,
    auraHypeStyle: config.auraHypeStyle ?? 'OFF',
    metamorphose: config.metamorphose?.mode ?? 'OFF',
    materialId: config.materialId ?? null,
    layoutId: config.layoutId ?? 'CLASSICO',
    skinId: config.skinId ?? 'PADRAO',
    container: { color: config.container?.color ?? null, ink: config.container?.ink ?? 'AUTO' },
  };
}

export function isDefaultFrame(s: FrameState): boolean {
  return JSON.stringify(fromConfig(toConfigRaw(s))) === JSON.stringify(DEFAULT_FRAME);
}

function toConfigRaw(s: FrameState): FrameConfig {
  const out: FrameConfig = { v: 1 };
  if (s.color) out.color = s.color;
  if (s.gradientId) out.gradientId = s.gradientId;
  if (s.seasonal.auto) out.seasonal = { auto: true };
  else if (s.seasonal.presetId) out.seasonal = { presetId: s.seasonal.presetId };
  if (s.animationId !== 'NONE') out.animationId = s.animationId;
  if (s.aura) out.aura = { ...s.aura };
  if (s.auraPlusId) out.auraPlusId = s.auraPlusId;
  if (s.auraHypeStyle !== 'OFF') out.auraHypeStyle = s.auraHypeStyle;
  if (s.metamorphose !== 'OFF') out.metamorphose = { mode: s.metamorphose };
  if (s.materialId) out.materialId = s.materialId;
  if (s.layoutId !== 'CLASSICO') out.layoutId = s.layoutId;
  if (s.skinId !== 'PADRAO') out.skinId = s.skinId;
  if (s.container.color || s.container.ink !== 'AUTO') {
    out.container = {};
    if (s.container.color) out.container.color = s.container.color;
    if (s.container.ink !== 'AUTO') out.container.ink = s.container.ink;
  }
  return out;
}

/** Estado → campo {@code background} do post: só as chaves escolhidas; tudo no padrão = null (moldura padrão). */
export function toConfig(s: FrameState): FrameConfig | null {
  return isDefaultFrame(s) ? null : toConfigRaw(s);
}

/** Fontes de arte escolhidas (cor, gradiente, cartela, aura, Aura Plus): o servidor aceita no máximo uma. */
export function artSources(s: FrameState): number {
  return [s.color, s.gradientId, s.seasonal.presetId || s.seasonal.auto ? 'x' : null, s.aura, s.auraPlusId].filter(Boolean).length;
}

export function ownArtLayout(catalog: Pick<FrameCatalog, 'layouts'>, layoutId: string): boolean {
  return catalog.layouts.some((l) => l.id === layoutId && l.ownArt);
}

export type StudioAction =
  | { type: 'color'; id: string }
  | { type: 'gradient'; id: string }
  | { type: 'season'; presetId: string | null; auto: boolean }
  | { type: 'aura'; id: string }
  | { type: 'auraVariant'; variantId: FrameAuraVariant }
  | { type: 'auraFormat'; format: FrameAuraFormat }
  | { type: 'auraPlus'; id: string }
  | { type: 'hype'; style: HypeStyle }
  | { type: 'metamorphose'; mode: MetamorphoseMode }
  | { type: 'clearArt' }
  | { type: 'material'; id: string | null }
  | { type: 'animation'; id: string }
  | { type: 'layout'; id: FrameLayoutId }
  | { type: 'skin'; id: string }
  | { type: 'containerColor'; color: string | null }
  | { type: 'ink'; ink: string }
  | { type: 'recommendation'; rec: FrameRecommendation };

export interface StudioResult {
  state: FrameState;
  /** Frase para o aria-live quando a escolha tirou outra coisa (uma arte por vez, Pôster). */
  notice: string | null;
}

/** Nome da arte atual ("o gradiente Brasa"), para avisar o que saiu. */
export function describeArt(s: FrameState, catalog: FrameCatalog): string | null {
  if (s.color) return `a cor ${catalog.colors.find((c) => c.id.toUpperCase() === s.color!.toUpperCase())?.name ?? s.color}`;
  if (s.gradientId) return `o gradiente ${catalog.gradients.find((g) => g.id === s.gradientId)?.name ?? s.gradientId}`;
  if (s.seasonal.auto) return 'a cartela automática pela data';
  if (s.seasonal.presetId) return `a cartela ${catalog.seasons.find((x) => x.id === s.seasonal.presetId)?.name ?? s.seasonal.presetId}`;
  if (s.aura) return `a aura ${catalog.auras.find((a) => a.id === s.aura!.presetId)?.name ?? s.aura.presetId}`;
  if (s.auraPlusId) return `a Aura Plus ${catalog.auraPlus.find((a) => a.id === s.auraPlusId)?.name ?? s.auraPlusId}`;
  return null;
}

function withoutArt(s: FrameState): FrameState {
  return { ...s, color: null, gradientId: null, seasonal: { presetId: null, auto: false }, aura: null, auraPlusId: null };
}

function layoutName(catalog: FrameCatalog, id: string): string {
  return catalog.layouts.find((l) => l.id === id)?.name ?? id;
}

/**
 * Aplica uma escolha do estúdio com a limpeza automática: uma fonte de arte por vez, e o layout com arte própria
 * (Pôster) tira a arte, o material e a Metamorfose; escolher um deles no Pôster volta o layout para Clássico.
 */
export function applyStudio(state: FrameState, action: StudioAction, catalog: FrameCatalog): StudioResult {
  const s: FrameState = structuredClone(state);
  const notes: string[] = [];
  const replaceArt = (next: FrameState, same: boolean): FrameState => {
    const before = describeArt(s, catalog);
    if (before && !same) notes.push(`Uma arte por vez: ${before} saiu.`);
    if (ownArtLayout(catalog, s.layoutId)) {
      notes.push(`O layout voltou para Clássico: ${layoutName(catalog, s.layoutId)} já traz arte própria.`);
      next.layoutId = 'CLASSICO';
    }
    return next;
  };

  let next: FrameState;
  switch (action.type) {
    case 'color':
      next = replaceArt({ ...withoutArt(s), color: action.id.toUpperCase() }, s.color?.toUpperCase() === action.id.toUpperCase());
      break;
    case 'gradient':
      next = replaceArt({ ...withoutArt(s), gradientId: action.id }, s.gradientId === action.id);
      break;
    case 'season': {
      const same = action.auto ? s.seasonal.auto : !!action.presetId && s.seasonal.presetId === action.presetId;
      next = replaceArt(
        { ...withoutArt(s), seasonal: { presetId: action.auto ? null : action.presetId, auto: action.auto } },
        same || (!action.auto && !action.presetId),
      );
      break;
    }
    case 'aura':
      next = replaceArt(
        {
          ...withoutArt(s),
          aura: { presetId: action.id, variantId: s.aura?.variantId ?? 'ORIGINAL', format: s.aura?.format ?? 'IMAGEM_UNICA' },
        },
        s.aura?.presetId === action.id,
      );
      break;
    case 'auraVariant':
      next = s.aura ? { ...s, aura: { ...s.aura, variantId: action.variantId } } : s;
      break;
    case 'auraFormat':
      next = s.aura ? { ...s, aura: { ...s.aura, format: action.format } } : s;
      break;
    case 'auraPlus':
      next = replaceArt({ ...withoutArt(s), auraPlusId: action.id }, s.auraPlusId === action.id);
      break;
    case 'hype':
      next = { ...s, auraHypeStyle: action.style };
      break;
    case 'metamorphose':
      next = { ...s, metamorphose: action.mode };
      if (action.mode !== 'OFF' && ownArtLayout(catalog, s.layoutId)) {
        notes.push(`O layout voltou para Clássico: ${layoutName(catalog, s.layoutId)} já traz arte própria.`);
        next.layoutId = 'CLASSICO';
      }
      break;
    case 'clearArt':
      next = withoutArt(s);
      break;
    case 'material':
      next = { ...s, materialId: action.id };
      if (action.id && ownArtLayout(catalog, s.layoutId)) {
        notes.push(`O layout voltou para Clássico: ${layoutName(catalog, s.layoutId)} já traz arte própria.`);
        next.layoutId = 'CLASSICO';
      }
      break;
    case 'animation':
      next = { ...s, animationId: action.id };
      break;
    case 'layout':
      next = { ...s, layoutId: action.id };
      if (ownArtLayout(catalog, action.id)) {
        const before = describeArt(s, catalog);
        const material = s.materialId ? catalog.materials.find((m) => m.id === s.materialId)?.name ?? s.materialId : null;
        const meta = s.metamorphose !== 'OFF' ? 'a Metamorfose' : null;
        const gone = [before, material ? `o material ${material}` : null, meta].filter(Boolean);
        if (gone.length) notes.push(`${layoutName(catalog, action.id)} já traz arte própria: ${new Intl.ListFormat('pt-BR', { type: 'conjunction' }).format(gone as string[])} ${gone.length > 1 ? 'saíram' : 'saiu'}.`);
        next = { ...withoutArt(next), materialId: null, metamorphose: 'OFF' };
      }
      break;
    case 'skin':
      next = { ...s, skinId: action.id };
      break;
    case 'containerColor':
      next = { ...s, container: { ...s.container, color: action.color ? action.color.toUpperCase() : null } };
      break;
    case 'ink':
      next = { ...s, container: { ...s.container, ink: action.ink === 'AUTO' ? 'AUTO' : action.ink.toUpperCase() } };
      break;
    case 'recommendation': {
      const r = action.rec;
      if (r.auraId) {
        const step = applyStudio(s, { type: 'aura', id: r.auraId }, catalog);
        next = { ...step.state, materialId: r.materialId };
        if (step.notice) notes.push(step.notice);
      } else if (r.seasonId) {
        const step = applyStudio(s, { type: 'season', presetId: r.seasonId, auto: false }, catalog);
        next = step.state;
        if (step.notice) notes.push(step.notice);
      } else {
        next = s;
      }
      break;
    }
  }
  return { state: next, notice: notes.length ? notes.join(' ') : null };
}

// ------------------------------------------------------------ container e contraste

export interface ContainerColors {
  color: string;
  ink: string;
  ratio: number;
  contrast: string;
  ok: boolean;
  /** Tinta que passaria (a do modo AUTO) e o contraste dela. */
  suggestion: string;
  suggestionContrast: string;
}

export function containerOf(s: FrameState, catalog: Pick<FrameCatalog, 'skins' | 'rules'>): ContainerColors {
  const skin = catalog.skins.find((k) => k.id === s.skinId) ?? catalog.skins[0];
  const color = (isHex(s.container.color) ? s.container.color : (skin?.containerColor ?? '#2A2119')).toUpperCase();
  const ink = s.container.ink !== 'AUTO' && isHex(s.container.ink) ? s.container.ink.toUpperCase() : bestInk(color);
  const ratio = contrastRatio(ink, color);
  const suggestion = bestInk(color);
  return {
    color,
    ink,
    ratio,
    contrast: formatRatio(ratio),
    ok: ratio >= (catalog.rules?.minContrast ?? AA_TEXT),
    suggestion,
    suggestionContrast: formatRatio(contrastRatio(suggestion, color)),
  };
}

// ------------------------------------------------------------ validação (as mesmas regras do BackgroundValidator)

export function validateFrame(s: FrameState, catalog: FrameCatalog, feed: FeedType): string[] {
  if (catalog.rules.feedsWithoutFrame.includes(feed) && !isDefaultFrame(s)) {
    return ['Alertas oficiais não têm moldura: a faixa de alerta precisa ser reconhecida na hora.'];
  }
  const errors: string[] = [];
  if (artSources(s) > 1) errors.push('Escolha uma única arte para a moldura: cor, gradiente, cartela, aura, Aura Plus ou arte própria.');
  const layout = catalog.layouts.find((l) => l.id === s.layoutId);
  if (layout?.ownArt && (artSources(s) > 0 || s.materialId || s.metamorphose !== 'OFF')) {
    errors.push(`O layout ${layout.name} já traz arte própria: não combina com outra arte, material ou Metamorfose.`);
  }
  if (s.container.color && !isHex(s.container.color)) errors.push('Cor do container deve ser #RRGGBB.');
  if (s.container.ink !== 'AUTO' && !isHex(s.container.ink)) errors.push('Cor dos textos deve ser AUTO ou #RRGGBB.');
  const c = containerOf(s, catalog);
  if (!c.ok) {
    errors.push(
      `Texto com contraste ${c.contrast} sobre o container (mínimo 4,5:1). Sugestão: tinta ${c.suggestion} (${c.suggestionContrast}).`,
    );
  }
  const bytes = new TextEncoder().encode(JSON.stringify(toConfigRaw(s))).length;
  if (bytes > catalog.rules.maxConfigBytes) errors.push(`A configuração da moldura passa de ${catalog.rules.maxConfigBytes} bytes.`);
  return errors;
}

// ------------------------------------------------------------ leitura para a prévia (BackgroundService.resolve)

/** Gradiente da cartela: as cores em 135°, de 0 a 100 % (divisão inteira, como no Java). */
export function seasonGradient(colors: string[]): string | null {
  if (colors.length === 0) return null;
  if (colors.length === 1) return colors[0]!;
  const stops = colors.map((c, i) => `${c} ${Math.floor((i * 100) / (colors.length - 1))}%`);
  return `linear-gradient(135deg,${stops.join(',')})`;
}

/** A moldura como o card a recebe da API, montada no cliente para a prévia ao vivo. */
export function previewBackground(s: FrameState, catalog: FrameCatalog): BackgroundView | null {
  const config = toConfig(s);
  if (!config) return null;
  let artKind: BackgroundView['artKind'] = 'NONE';
  let artId: string | null = null;
  let palette: string[] = [];
  let css: string | null = null;
  let auraPlus: BackgroundView['auraPlus'] = null;
  if (ownArtLayout(catalog, s.layoutId)) {
    artKind = 'LAYOUT';
    artId = s.layoutId;
  } else if (s.auraPlusId) {
    const p = catalog.auraPlus.find((x) => x.id === s.auraPlusId);
    artKind = 'AURA_PLUS';
    artId = s.auraPlusId;
    auraPlus = p
      ? { poster: p.poster, av1: p.av1, h264: p.h264, loopSeconds: p.loopSeconds, maxPlaySeconds: catalog.rules.maxAnimationSeconds }
      : null;
  } else if (s.aura) {
    const a = catalog.auras.find((x) => x.id === s.aura!.presetId);
    artKind = 'AURA';
    artId = s.aura.presetId;
    palette = a?.palette ?? [];
    css = a?.css ?? null;
  } else if (s.seasonal.auto || s.seasonal.presetId) {
    const id = s.seasonal.auto ? catalog.activeSeasonId : s.seasonal.presetId;
    const season = catalog.seasons.find((x) => x.id === id);
    artKind = 'SEASONAL';
    artId = season?.id ?? null;
    palette = season?.colors ?? [];
    css = seasonGradient(palette);
  } else if (s.gradientId) {
    const g = catalog.gradients.find((x) => x.id === s.gradientId);
    artKind = 'GRADIENT';
    artId = s.gradientId;
    palette = g?.palette ?? [];
    css = g?.css ?? null;
  } else if (s.color) {
    artKind = 'COLOR';
    artId = s.color;
    palette = [s.color];
    css = s.color;
  }
  const c = containerOf(s, catalog);
  return { config, artKind, artId, palette, css, auraPlus, container: { color: c.color, ink: c.ink, contrast: c.contrast } };
}

// ------------------------------------------------------------ arte gerada no cliente

function hashSeed(seed: string): number {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function rng(seed: number): () => number {
  let a = seed || 1;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Eclipse: aurora + constelação gerada com a seed do post (o catálogo manda css nulo). */
export function eclipseArt(palette: string[], seed: string): string {
  const [a = '#7B2FF7', b = '#4A93FF', base = '#1A1033', star = '#F5EDE3'] = palette;
  const next = rng(hashSeed(seed));
  const stars: string[] = [];
  for (let i = 0; i < 22; i++) {
    const x = Math.round(next() * 140);
    const y = Math.round(next() * 140);
    stars.push(`<circle cx='${x}' cy='${y}' r='${(0.6 + next() * 1.2).toFixed(1)}' fill='${star}' opacity='${(0.5 + next() * 0.5).toFixed(2)}'/>`);
  }
  const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='140' height='140'>${stars.join('')}</svg>`;
  const enc = svg.replace(/#/g, '%23');
  return `url("data:image/svg+xml,${enc}") 0 0/140px 140px,radial-gradient(60% 50% at 30% 30%,${a}cc,#0000 70%),radial-gradient(55% 45% at 75% 70%,${b}aa,#0000 70%),${base}`;
}

/** Confete: retângulos e círculos nas cores da paleta, sempre iguais para o mesmo post. */
export function confeteArt(palette: string[], seed: string): string {
  const colors = palette.length ? palette : ['#FF2E88', '#F7C948', '#3DDC6B', '#4A93FF', '#FF6A2B'];
  const next = rng(hashSeed(seed));
  const shapes: string[] = [];
  for (let i = 0; i < 26; i++) {
    const x = Math.round(next() * 120);
    const y = Math.round(next() * 120);
    const fill = colors[Math.floor(next() * colors.length)]!;
    if (next() > 0.5) shapes.push(`<circle cx='${x}' cy='${y}' r='${2 + Math.round(next() * 2)}' fill='${fill}'/>`);
    else shapes.push(`<rect x='${x}' y='${y}' width='7' height='3' rx='1' fill='${fill}' transform='rotate(${Math.round(next() * 180)} ${x} ${y})'/>`);
  }
  const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='120' height='120'><rect width='120' height='120' fill='#1E1622'/>${shapes.join('')}</svg>`;
  return `url("data:image/svg+xml,${svg.replace(/#/g, '%23')}") 0 0/120px 120px`;
}

/** CSS da arte da faixa externa; null = sem arte (fundo rebaixado do tema). Aura Plus usa o pôster. */
export function artCss(bg: BackgroundView, seed: string): string | null {
  if (bg.artKind === 'AURA' && !bg.css) return bg.artId === 'confete' ? confeteArt(bg.palette, seed) : eclipseArt(bg.palette, seed);
  if (bg.artKind === 'AURA_PLUS' && bg.auraPlus) return `#17120D url("${bg.auraPlus.poster}") center/cover`;
  return bg.css;
}
