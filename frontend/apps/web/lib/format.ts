// Formatação pt-BR: vírgula decimal, números compactos e datas.

const decimal1 = new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
const compact = new Intl.NumberFormat('pt-BR', { notation: 'compact', maximumFractionDigits: 1 });
const dateFmt = new Intl.DateTimeFormat('pt-BR', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'America/Sao_Paulo' });

/** 4.25 → "4,3". */
export function formatDecimal(n: number): string {
  return decimal1.format(n);
}

/** Contagem no card (DESIGN_SYSTEM.md §6): 2100 → "2,1 mil"; o número exato fica no aria-label e no modal. */
export function formatCompact(n: number): string {
  return compact.format(n).replace(/\s/g, ' ');
}

/** 25 → "25 km". */
export function formatKm(km: number): string {
  return `${Number.isInteger(km) ? km : decimal1.format(km)} km`;
}

export function formatDate(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '' : dateFmt.format(d);
}

export function plural(n: number, um: string, varios: string): string {
  return `${n.toLocaleString('pt-BR')} ${n === 1 ? um : varios}`;
}

/** 768 s → "12:48"; 3725 s → "1:02:05". */
export function formatDuration(seconds: number): string {
  const s = Math.max(0, Math.round(seconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const ss = String(s % 60).padStart(2, '0');
  return h ? `${h}:${String(m).padStart(2, '0')}:${ss}` : `${m}:${ss}`;
}

/** Duração por extenso para o leitor de tela: "12 minutos e 48 segundos". */
export function durationText(seconds: number): string {
  const s = Math.max(0, Math.round(seconds));
  const m = Math.floor(s / 60);
  const parts = [m ? plural(m, 'minuto', 'minutos') : null, s % 60 ? plural(s % 60, 'segundo', 'segundos') : null].filter(Boolean);
  return parts.join(' e ') || '0 segundos';
}

/** Idade completa em anos numa data de referência (AAAA-MM-DD). */
export function ageOn(dateOfBirth: string, today: Date = new Date()): number | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateOfBirth);
  if (!m) return null;
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  let age = today.getFullYear() - y;
  if (today.getMonth() + 1 < mo || (today.getMonth() + 1 === mo && today.getDate() < d)) age -= 1;
  return age;
}
