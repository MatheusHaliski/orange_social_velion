// Peças do card e do modal do post (RF24): autor com a bolinha, tipo de mídia, classificação, tendência e o bloco
// do alerta oficial. Nenhuma informação só pela cor: sempre glifo ou ícone + texto.
import type { AgeRatingCode, AlertInfoView, AuthorView, MediaKind, TrendingCode } from '@orange-social/api';
import Link from 'next/link';
import { CategoryDot } from '@/components/CategoryBadge';
import { IconAlert, IconDeadline, IconJob, IconOfficialSource, MEDIA_ICONS, TRENDING_ICONS } from '@/components/icons';
import { formatKm } from '@/lib/format';
import { initials } from '@/lib/photo';
import {
  alertHeadline,
  alertIssued,
  formatDateTime,
  formatRelative,
  formatUntil,
  MEDIA_LABELS,
  profileHref,
  ratingText,
  TRENDING_LABELS,
} from '@/lib/post-format';

export function Avatar({ name, url, size = 40 }: { name: string; url: string | null; size?: number }) {
  const style = { width: size, height: size, fontSize: size * 0.38 };
  if (url) {
    // eslint-disable-next-line @next/next/no-img-element -- URL pública do bucket, já recortada sem EXIF
    return <img src={url} alt="" width={size} height={size} style={style} className="flex-none rounded-full border border-line object-cover" />;
  }
  return (
    <span aria-hidden="true" style={style} className="grid flex-none place-items-center rounded-full border-2 border-line-strong bg-sunken font-bold">
      {initials(name)}
    </span>
  );
}

/** Bolinha + glifo + rótulo da categoria (numa pílula com o fundo do tema dentro do card emoldurado). */
export function AuthorBadge({ author }: { author: Pick<AuthorView, 'category'> }) {
  if (!author.category) return null;
  return (
    <span className="os-badge-pill" data-testid="categoria">
      <CategoryDot code={author.category.code} size={16} />
      <span>{author.category.label}</span>
    </span>
  );
}

/**
 * Foto + nome (um único link para o perfil do autor, RF25), a categoria e quando foi publicado (`<time>` com a
 * data absoluta no title). Autor indisponível: nome sem link.
 */
export function AuthorLine({ author, publishedAt, absolute = false }: { author: AuthorView; publishedAt: string; absolute?: boolean }) {
  const href = profileHref(author);
  const who = (
    <>
      <Avatar name={author.name} url={author.avatarUrl} />
      <span className="font-bold [overflow-wrap:anywhere]">
        {href && <span className="sr-only">Ver perfil de </span>}
        {author.name}
      </span>
    </>
  );
  return (
    <div className="grid min-w-0 gap-1">
      {href ? (
        <Link
          href={href}
          className="flex min-h-11 min-w-0 items-center gap-3 self-start rounded-md underline decoration-1 underline-offset-4 hover:decoration-2"
          data-testid="autor-link"
        >
          {who}
        </Link>
      ) : (
        <p className="flex min-h-11 min-w-0 items-center gap-3" data-testid="autor-sem-link">
          {who}
        </p>
      )}
      <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-muted">
        <AuthorBadge author={author} />
        <span aria-hidden="true">·</span>
        <time dateTime={publishedAt} title={formatDateTime(publishedAt)}>
          {absolute ? formatDateTime(publishedAt) : formatRelative(publishedAt)}
        </time>
      </p>
    </div>
  );
}

/** Tipo de mídia: ícone Lucide + texto (nunca só o ícone). */
export function MediaBadge({ media }: { media: MediaKind }) {
  const Icon = MEDIA_ICONS[media];
  return (
    <span className="os-tag" data-testid="tipo-midia">
      {Icon && <Icon size={14} />}
      <span className="sr-only">Tipo: </span>
      {MEDIA_LABELS[media]}
    </span>
  );
}

/** Chip de classificação com texto visível e o rótulo por extenso para o leitor de tela. */
export function RatingChip({ code, label }: { code: AgeRatingCode; label: string }) {
  return (
    <span className="os-rating" data-rating={code} data-testid="classificacao">
      <span aria-hidden="true">{label}</span>
      <span className="sr-only">{ratingText(code, label)}</span>
    </span>
  );
}

/** Indicador de tendência (OS-36): ícone + texto, discreto; ⏳ o backend ainda não manda o campo. */
export function Trending({ code }: { code: TrendingCode | null | undefined }) {
  if (!code) return null;
  const Icon = TRENDING_ICONS[code];
  return (
    <span className={`inline-flex items-center gap-1 font-mono text-sm ${code === 'HOT' ? 'font-bold text-brand' : 'text-muted'}`} data-testid="tendencia">
      {Icon && <Icon size={16} />}
      {TRENDING_LABELS[code]}
    </span>
  );
}

/** Cabeçalho do alerta: severidade + evento (CAP) e "emitido há"; a vaga mostra só "Vaga". */
export function AlertHeader({ alert, publishedAt }: { alert: AlertInfoView; publishedAt: string }) {
  const job = alert.category === 'JOB_OPENING';
  const Icon = job ? IconJob : IconAlert;
  return (
    <div className="flex flex-wrap items-center justify-between gap-2">
      <p className={`inline-flex items-center gap-1.5 font-mono text-sm font-bold uppercase tracking-wider ${job ? '' : 'text-alert'}`} data-testid="severidade">
        <Icon size={18} />
        {alertHeadline(alert)}
      </p>
      <span className="os-tag">
        <IconDeadline size={14} />
        <span className="sr-only">Emitido </span>
        <time dateTime={publishedAt} title={formatDateTime(publishedAt)}>
          {alertIssued(publishedAt)}
        </time>
      </span>
    </div>
  );
}

/** Fonte (verificada), área, validade e o que fazer: tudo em texto (o mapa é só enfeite). */
export function AlertDetails({ alert, author }: { alert: AlertInfoView; author: AuthorView }) {
  const area = [alert.areaDesc, alert.radiusKm ? `raio ${formatKm(alert.radiusKm)}` : null].filter(Boolean).join(' · ');
  return (
    <dl className="grid gap-2 text-sm" data-testid="dados-alerta">
      <div className="grid gap-0.5 sm:grid-cols-[7rem_1fr]">
        <dt className="text-muted">Fonte</dt>
        <dd className="flex flex-wrap items-center gap-x-2 gap-y-1">
          {author.category && <CategoryDot code={author.category.code} size={16} />}
          <span className="font-semibold">{author.name}</span>
          {alert.verifiedSource && (
            <span className="inline-flex items-center gap-1 font-semibold text-success" data-testid="fonte-verificada">
              <IconOfficialSource size={16} />
              fonte verificada
            </span>
          )}
        </dd>
      </div>
      {area && (
        <div className="grid gap-0.5 sm:grid-cols-[7rem_1fr]">
          <dt className="text-muted">Área</dt>
          <dd>{area}</dd>
        </div>
      )}
      {alert.expiresAt && (
        <div className="grid gap-0.5 sm:grid-cols-[7rem_1fr]">
          <dt className="text-muted">Válido até</dt>
          <dd>
            <time dateTime={alert.expiresAt} title={formatDateTime(alert.expiresAt)}>
              {formatUntil(alert.expiresAt)}
            </time>
          </dd>
        </div>
      )}
      {alert.instruction && (
        <div className="grid gap-0.5 sm:grid-cols-[7rem_1fr]">
          <dt className="text-muted">O que fazer</dt>
          <dd className="font-semibold">{alert.instruction}</dd>
        </div>
      )}
    </dl>
  );
}
