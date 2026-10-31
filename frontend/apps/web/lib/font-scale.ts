// Tamanho do texto (Configurações → Exibição, RF2): o app usa rem, então mudar o font-size da raiz escala tudo.
export const FONT_SCALE_MIN = 85;
export const FONT_SCALE_MAX = 150;

/** Aplica a escala salva da conta; {@code null} (sem conta ou 100 %) volta ao tamanho do navegador. */
export function applyFontScale(scale: number | null | undefined): void {
  const root = document.documentElement;
  if (scale == null || !Number.isFinite(scale) || scale === 100) {
    root.style.removeProperty('font-size');
    return;
  }
  const clamped = Math.min(FONT_SCALE_MAX, Math.max(FONT_SCALE_MIN, Math.round(scale)));
  root.style.fontSize = `${clamped}%`;
}
