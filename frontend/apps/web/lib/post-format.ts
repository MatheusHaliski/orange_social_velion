// Formatação dos posts (RF24): tempo relativo no card ("há 3 min"), data absoluta no fuso de quem vê no modal,
// rótulos de mídia, classificação, tendência e alerta, e os links da tela a partir dos caminhos da API.
import type { AlertInfoView, AuthorView, MediaKind, PostCardView, PostDetailView, TrendingCode } from '@orange-social/api';
import { plural } from './format';

const absolute = new Intl.DateTimeFormat('pt-BR', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' });
const shortDate = new Intl.DateTimeFormat('pt-BR', { day: 'numeric', month: 'short' });
const shortDateYear = new Intl.DateTimeFormat('pt-BR', { day: 'numeric', month: 'short', year: 'numeric' });
const monthYear = new Intl.DateTimeFormat('pt-BR', { month: 'long', year: 'numeric' });
const timeOnly = new Intl.DateTimeFormat('pt-BR', { hour: '2-digit', minute: '2-digit' });

/** "agora", "há 3 min", "há 2 h", "ontem", "há 4 dias" e, depois de uma semana, "12 de out.". */
export function formatRelative(iso: string, now: Date = new Date()): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const s = Math.round((now.getTime() - d.getTime()) / 1000);
  if (s < 60) return 'agora';
  const min = Math.floor(s / 60);
  if (min < 60) return `há ${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `há ${h} h`;
  const days = Math.floor(h / 24);
  if (days === 1) return 'ontem';
  if (days < 7) return `há ${days} dias`;
  return (d.getFullYear() === now.getFullYear() ? shortDate : shortDateYear).format(d);
}

/** "25 de outubro de 2026 às 11:20", no fuso de quem vê. */
export function formatDateTime(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '' : absolute.format(d);
}

/** "outubro de 2026". */
export function formatMonthYear(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '' : monthYear.format(d);
}

/** Validade do alerta: "hoje, 23:00", "amanhã, 08:00" ou a data absoluta. */
export function formatUntil(iso: string, now: Date = new Date()): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const day = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const diff = Math.round((day(d) - day(now)) / 86_400_000);
  if (diff === 0) return `hoje, ${timeOnly.format(d)}`;
  if (diff === 1) return `amanhã, ${timeOnly.format(d)}`;
  return formatDateTime(iso);
}

/** Alerta emitido há menos de 5 minutos aparece como "AGORA" (TAXONOMIA §5.3, alerta oficial). */
export function alertIssued(iso: string, now: Date = new Date()): string {
  return now.getTime() - new Date(iso).getTime() < 5 * 60_000 ? 'agora' : formatRelative(iso, now);
}

export function countsText(counts: { likes: number; comments: number; shares: number }): string {
  return [plural(counts.likes, 'curtida', 'curtidas'), plural(counts.comments, 'comentário', 'comentários'), plural(counts.shares, 'compartilhamento', 'compartilhamentos')].join(', ');
}

export const MEDIA_LABELS: Record<MediaKind, string> = { TEXT: 'Texto', IMAGE: 'Imagem', VIDEO: 'Vídeo', AUDIO: 'Áudio' };

export const TRENDING_LABELS: Record<TrendingCode, string> = { HOT: 'em alta', RISING: 'subindo', STABLE: 'estável', FALLING: 'caindo' };

/** Rótulo por extenso da classificação para o leitor de tela. */
export function ratingText(code: string, label: string): string {
  switch (code) {
    case 'LIVRE':
      return 'Classificação: livre para todos os públicos';
    case 'SENSITIVE':
      return 'Classificação: conteúdo sensível';
    default:
      return `Classificação: não recomendado para menores de ${label.replace(/\D/g, '')} anos`;
  }
}

export const SEVERITY_LABELS: Record<string, string> = {
  EXTREME: 'Alerta extremo',
  SEVERE: 'Alerta severo',
  MODERATE: 'Alerta moderado',
  MINOR: 'Aviso',
};

/** Linha de cima do card de alerta: "Alerta severo · Chuva forte", ou "Vaga". */
export function alertHeadline(alert: AlertInfoView): string {
  if (alert.category === 'JOB_OPENING') return 'Vaga';
  const sev = alert.severity ? SEVERITY_LABELS[alert.severity] : 'Comunicado oficial';
  return alert.event ? `${sev} · ${alert.event}` : (sev ?? 'Alerta');
}

// ------------------------------------------------------------ links da tela (a API manda os caminhos dela)

export const postHref = (p: Pick<PostCardView | PostDetailView, 'id'>) => `/posts/${encodeURIComponent(p.id)}`;

/** Perfil público do autor (RF25); null quando a conta foi eliminada ou está fora do ar (sem link). */
export function profileHref(a: Pick<AuthorView, 'id' | 'profilePath'>): string | null {
  return a.profilePath && a.id != null ? `/u/${a.id}` : null;
}

/**
 * Abre a página do post com navegação completa. O endereço /posts/{id} é interceptado pelo modal (@modal) em
 * navegação dentro do app; fora dos feeds (publicar, editar, entrar) a pessoa deve cair na página, não num modal
 * por cima do formulário.
 */
export function openPostPage(path: string): void {
  window.location.assign(path);
}

export const isPostPath = (path: string) => /^\/posts\/[^/?#]+(?:[?#].*)?$/.test(path);
