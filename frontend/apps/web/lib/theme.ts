// Preferência de tema: a única coisa guardada no localStorage (nunca token nem dado da conta).
// "Sistema" (SYSTEM em Configurações → Exibição) = sem escolha guardada: vale o prefers-color-scheme.
export type ThemeChoice = 'light' | 'dark';
export type ThemeMode = ThemeChoice | 'system';
export const THEME_STORAGE_KEY = 'os:tema';

export function readStoredTheme(): ThemeChoice | null {
  try {
    const v = window.localStorage.getItem(THEME_STORAGE_KEY);
    return v === 'light' || v === 'dark' ? v : null;
  } catch {
    return null;
  }
}

export function storeTheme(theme: ThemeChoice | null): void {
  try {
    if (theme) window.localStorage.setItem(THEME_STORAGE_KEY, theme);
    else window.localStorage.removeItem(THEME_STORAGE_KEY);
  } catch {
    // modo privado ou armazenamento bloqueado: o tema vale só nesta visita
  }
}

export function effectiveTheme(): ThemeChoice {
  const attr = document.documentElement.dataset.theme;
  if (attr === 'light' || attr === 'dark') return attr;
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

const listeners = new Set<() => void>();

/** Para useSyncExternalStore: avisa quando o tema escolhido ou o do sistema mudam. */
export function subscribeTheme(cb: () => void): () => void {
  listeners.add(cb);
  const mq = window.matchMedia('(prefers-color-scheme: dark)');
  mq.addEventListener('change', cb);
  return () => {
    listeners.delete(cb);
    mq.removeEventListener('change', cb);
  };
}

/** Aplica o tema no app inteiro: 'system' tira a escolha e volta a seguir o sistema. */
export function applyTheme(mode: ThemeMode): void {
  if (mode === 'system') delete document.documentElement.dataset.theme;
  else document.documentElement.dataset.theme = mode;
  storeTheme(mode === 'system' ? null : mode);
  listeners.forEach((l) => l());
}

/** UserPreference.Theme (API) ↔ modo do app. */
export function modeFromPreference(theme: 'SYSTEM' | 'DARK' | 'LIGHT'): ThemeMode {
  return theme === 'DARK' ? 'dark' : theme === 'LIGHT' ? 'light' : 'system';
}

/** Roda antes da pintura (no <head>) para não piscar o tema errado. */
export const THEME_BOOT_SCRIPT = `(function(){try{var t=localStorage.getItem(${JSON.stringify(THEME_STORAGE_KEY)});if(t==='light'||t==='dark'){document.documentElement.dataset.theme=t;}}catch(e){}})();`;
