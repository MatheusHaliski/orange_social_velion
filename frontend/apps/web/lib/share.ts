// Folha de compartilhamento do post (RF26): os canais de ShareChannel. O link é o público do post
// ({public-base-url}/p/{id}), sem dizer quem compartilhou.
import type { ShareChannelCode } from '@orange-social/api';

/** Canais na ordem da folha (DESIGN_SYSTEM.md §6, ShareSheet). */
export const SHARE_CHANNELS: ReadonlyArray<{ code: ShareChannelCode; label: string }> = [
  { code: 'COPY_LINK', label: 'Copiar link' },
  { code: 'WHATSAPP', label: 'WhatsApp' },
  { code: 'TELEGRAM', label: 'Telegram' },
  { code: 'X', label: 'X' },
  { code: 'EMAIL', label: 'E-mail' },
  { code: 'NATIVE', label: 'Mais opções' },
];

/** Endereço que abre o app ou o site do canal; null para os que não abrem página (copiar, folha do sistema). */
export function shareTarget(channel: ShareChannelCode, url: string, title: string): string | null {
  const u = encodeURIComponent(url);
  const t = encodeURIComponent(title);
  switch (channel) {
    case 'WHATSAPP':
      return `https://wa.me/?text=${encodeURIComponent(`${title} ${url}`)}`;
    case 'TELEGRAM':
      return `https://t.me/share/url?url=${u}&text=${t}`;
    case 'X':
      return `https://x.com/intent/post?url=${u}&text=${t}`;
    case 'EMAIL':
      return `mailto:?subject=${t}&body=${u}`;
    default:
      return null;
  }
}

/** A folha do sistema (Web Share API) só aparece onde existe. */
export function canShareNatively(): boolean {
  return typeof navigator !== 'undefined' && typeof navigator.share === 'function';
}

/** Copia o texto; devolve false quando o navegador não deixa (a tela mostra o link para copiar à mão). */
export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}
