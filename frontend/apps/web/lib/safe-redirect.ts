/** Aceita só caminhos internos em ?voltar= (evita redirecionamento aberto para outro site). */
export function safeRedirect(value: string | null | undefined, fallback = '/'): string {
  if (!value) return fallback;
  if (!value.startsWith('/') || value.startsWith('//') || value.startsWith('/\\')) return fallback;
  if (/[\u0000-\u001f]/.test(value)) return fallback;
  return value;
}

export function loginHref(voltar: string): string {
  return `/entrar?voltar=${encodeURIComponent(voltar)}`;
}
