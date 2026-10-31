'use client';

import { useSyncExternalStore } from 'react';
import { applyTheme, effectiveTheme, subscribeTheme, type ThemeChoice } from '@/lib/theme';
import { IconThemeDark, IconThemeLight } from './icons';

/** Alterna claro/escuro; a escolha fica só no localStorage (a única preferência guardada no navegador). */
export function ThemeToggle() {
  const theme = useSyncExternalStore<ThemeChoice | null>(subscribeTheme, effectiveTheme, () => null);
  const dark = theme === 'dark';
  return (
    <button
      type="button"
      className="os-btn os-btn-sm"
      aria-pressed={theme === null ? undefined : dark}
      onClick={() => applyTheme(dark ? 'light' : 'dark')}
      data-testid="alternar-tema"
    >
      {dark ? <IconThemeDark size={18} /> : <IconThemeLight size={18} />}
      <span className="sr-only sm:not-sr-only">Tema escuro</span>
    </button>
  );
}
