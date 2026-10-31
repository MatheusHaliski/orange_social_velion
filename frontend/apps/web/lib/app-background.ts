// Fundo do app (RF2, Configurações → Exibição): liso, rede com o logo ou um dos 6 mosaicos de design/brand/,
// sempre com o véu do tema por cima para os cards e textos continuarem legíveis (WCAG 1.4.3).
import type { AppBackground } from '@orange-social/api';

export interface AppBackgroundInfo {
  code: AppBackground;
  label: string;
  /** Miniatura do seletor; null = liso (a cor do tema). */
  thumb: string | null;
}

export const APP_BACKGROUNDS: readonly AppBackgroundInfo[] = [
  { code: 'PLAIN', label: 'Liso', thumb: null },
  { code: 'NETWORK', label: 'Rede Orange', thumb: '/brand/orange-social-logo.svg' },
  { code: 'MOSAIC', label: 'Mosaico laranja', thumb: '/brand/backgrounds/mosaico-laranja-thumb.webp' },
  { code: 'MOSAIC_CLASSIC', label: 'Clássico', thumb: '/brand/backgrounds/mosaico-classico-thumb.webp' },
  { code: 'MOSAIC_DEEP', label: 'Profundo', thumb: '/brand/backgrounds/mosaico-profundo-thumb.webp' },
  { code: 'MOSAIC_GLOW', label: 'Brilho', thumb: '/brand/backgrounds/mosaico-brilho-thumb.webp' },
  { code: 'MOSAIC_SKY', label: 'Céu', thumb: '/brand/backgrounds/mosaico-ceu-thumb.webp' },
  { code: 'MOSAIC_SAND', label: 'Areia', thumb: '/brand/backgrounds/mosaico-areia-thumb.webp' },
];

/** Marca o fundo no <html>; o CSS (globals.css, "Fundo do app") desenha a arte e o véu. */
export function applyAppBackground(code: AppBackground): void {
  const root = document.documentElement;
  if (code === 'PLAIN') delete root.dataset.appBg;
  else root.dataset.appBg = code;
}
