'use client';

import type { AuraPlusMedia, BackgroundView, CategoryCode } from '@orange-social/api';
import { tokens } from '@orange-social/tokens';
import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { artCss, bestInk, DARK_INK, mixHex, softerInk } from '@/lib/frame';

/**
 * Variáveis do container emoldurado: a cor e a tinta vêm da moldura (RF28); os tons secundários são derivados da
 * tinta até passarem de 4,5:1 (texto) e 3:1 (contorno). As cores de categoria usam o tema que combina com o
 * container e ficam numa pílula com o fundo desse tema, onde foram medidas.
 */
export function containerStyle(color: string, ink: string): CSSProperties {
  const theme = bestInk(color) === DARK_INK ? tokens.light : tokens.dark;
  const vars: Record<string, string> = {};
  for (const [name, value] of Object.entries(theme)) vars[`--os-${name}`] = value;
  Object.assign(vars, {
    '--os-color-bg': color,
    '--os-color-surface': color,
    '--os-color-text': ink,
    '--os-color-text-muted': softerInk(ink, color, 0.62, 4.5),
    '--os-color-border': mixHex(ink, color, 0.25),
    '--os-color-border-strong': softerInk(ink, color, 0.45, 3),
    '--os-color-surface-sunken': mixHex(ink, color, 0.1),
    '--os-color-focus': ink,
    '--os-color-brand': ink,
    '--os-badge-bg': theme['color-bg'],
    '--os-badge-ink': theme['color-text'],
  });
  return { ...vars, colorScheme: theme === tokens.light ? 'light' : 'dark' } as CSSProperties;
}

// ------------------------------------------------------------ Aura Plus: vídeo curto, nunca GIF (RF28, critério 9)

/** Quantas Auras Plus tocam agora: no máximo 3 (2 no celular). */
let playing = 0;
const maxConcurrent = () => (typeof window !== 'undefined' && window.matchMedia('(max-width: 640px)').matches ? 2 : 3);

/** Economia de dados do navegador (Save-Data): fica no pôster. */
function saveData(): boolean {
  const nav = typeof navigator !== 'undefined' ? (navigator as Navigator & { connection?: { saveData?: boolean } }) : null;
  return !!nav?.connection?.saveData;
}

/**
 * Toca o vídeo uma vez quando ≥ 60 % do card aparece, por no máximo {@code maxPlaySeconds} (WCAG 2.2.2), e volta ao
 * pôster. Com "Reduzir movimento", economia de dados ou falha do play(), o vídeo nem é montado: só o pôster.
 */
function AuraPlusArt({ media, motion }: { media: AuraPlusMedia; motion: boolean }) {
  const ref = useRef<HTMLVideoElement>(null);
  const [state, setState] = useState<'poster' | 'playing' | 'done'>('poster');
  const allowed = motion && !saveData();

  useEffect(() => {
    const video = ref.current;
    if (!allowed || !video || typeof IntersectionObserver === 'undefined') return;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let counted = false;
    const stop = () => {
      video.pause();
      if (counted) playing--;
      counted = false;
      setState('done');
    };
    const io = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (!entry?.isIntersecting || entry.intersectionRatio < 0.6) return;
        io.disconnect();
        if (playing >= maxConcurrent()) return;
        playing++;
        counted = true;
        video
          .play()
          .then(() => {
            setState('playing');
            timer = setTimeout(stop, Math.min(media.maxPlaySeconds, 5) * 1000);
          })
          .catch(stop);
      },
      { threshold: [0.6] },
    );
    io.observe(video.parentElement ?? video);
    return () => {
      io.disconnect();
      if (timer) clearTimeout(timer);
      if (counted) playing--;
    };
  }, [allowed, media.maxPlaySeconds]);

  return (
    <span className="os-frame-paint os-aura-plus" data-state={allowed ? state : 'poster'} data-testid="aura-plus">
      {/* eslint-disable-next-line @next/next/no-img-element -- pôster do catálogo (WebP ≤ 25 KB) */}
      <img src={media.poster} alt="" className="os-aura-plus-poster" />
      {allowed && (
        <video ref={ref} muted playsInline loop preload="none" poster={media.poster} className="os-aura-plus-video" aria-hidden="true" tabIndex={-1}>
          <source src={media.av1} type='video/mp4; codecs="av01.0.05M.08"' />
          <source src={media.h264} type="video/mp4" />
        </video>
      )}
    </span>
  );
}

// ------------------------------------------------------------ moldura + container

interface FrameProps {
  background: BackgroundView | null;
  /** Feeds sem moldura (alerta): o card aparece sem a arte, mesmo que viesse uma. */
  framed: boolean;
  /** Categoria do autor: o filete fica dentro do container, nunca na arte. */
  category: CategoryCode | null;
  /** Post em alta: liga a Aura Hype escolhida pelo autor (o texto "em alta" continua sendo o sinal). */
  hot?: boolean;
  /** Semente da arte gerada no cliente (o id do post). */
  seed: string;
  /** Animação só quando a pessoa não pediu "Reduzir movimento". */
  motion: boolean;
  /** Elemento do container: article no feed, div na página do post. */
  as?: 'article' | 'div';
  feed?: string;
  labelledBy?: string;
  testId?: string;
  children: ReactNode;
}

/** Moldura (arte só na faixa de 11 px) + container opaco com o conteúdo; sem moldura, só o container. */
export function PostFrame({ background, framed, category, hot, seed, motion, as = 'article', feed, labelledBy, testId, children }: FrameProps) {
  const Tag = as;
  const bg = framed ? background : null;
  const container = (
    <Tag
      className="os-post"
      data-category={category ?? undefined}
      data-feed={feed}
      data-framed={bg ? 'true' : undefined}
      aria-labelledby={labelledBy}
      data-testid={testId}
      style={bg ? containerStyle(bg.container.color, bg.container.ink) : undefined}
    >
      {children}
    </Tag>
  );
  if (!bg) return container;
  const layout = bg.config.layoutId ?? 'CLASSICO';
  const css = artCss(bg, seed);
  const aura = bg.config.aura;
  const mosaic = bg.artKind === 'AURA' && aura?.format === 'MOSAICO';
  const animation = motion && bg.config.animationId && bg.config.animationId !== 'NONE' ? bg.config.animationId : undefined;
  const hype = hot && bg.config.auraHypeStyle && bg.config.auraHypeStyle !== 'OFF' ? bg.config.auraHypeStyle : undefined;
  const meta = bg.config.metamorphose?.mode && bg.config.metamorphose.mode !== 'OFF' ? bg.config.metamorphose.mode : undefined;
  const paint = (key?: number) =>
    bg.artKind === 'LAYOUT' ? (
      <span key={key} className="os-frame-paint os-frame-poster" />
    ) : bg.artKind === 'AURA_PLUS' && bg.auraPlus ? (
      <AuraPlusArt key={key} media={bg.auraPlus} motion={motion} />
    ) : (
      <span key={key} className="os-frame-paint" style={css ? { background: css } : undefined} />
    );
  return (
    <div
      className="os-frame"
      data-layout={layout}
      data-anim={animation}
      data-art={bg.artKind}
      data-hype={hype}
      data-motion={motion ? 'true' : undefined}
      data-testid={testId ? `${testId}-moldura` : undefined}
    >
      <div className="os-frame-art" aria-hidden="true" data-soft={aura?.variantId === 'SUAVE' ? 'true' : undefined} data-mosaic={mosaic ? 'true' : undefined}>
        {mosaic
          ? [0, 1, 2, 3].map((i) => (
              <span key={i} className="os-frame-tile">
                {paint()}
              </span>
            ))
          : paint()}
        {meta && <span className={`os-frame-meta os-meta-${meta.toLowerCase()}`} data-metamorphose={meta} />}
      </div>
      {bg.config.materialId && bg.artKind !== 'LAYOUT' && (
        <span className={`os-frame-mat os-mat-${bg.config.materialId}`} aria-hidden="true" data-material={bg.config.materialId} />
      )}
      {hype && <span className="os-frame-hype" aria-hidden="true" />}
      {container}
    </div>
  );
}
