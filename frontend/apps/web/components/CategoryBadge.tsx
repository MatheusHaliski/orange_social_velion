import type { CategoryVerification } from '@orange-social/api';
import { category, type GlyphShape } from '@/lib/categories';
import { IconVerified } from './icons';

/** Desenho de cada glifo VSL num quadro 24 × 24 (OS-3A): forma diferente por categoria, nunca só a cor. */
function GlyphPath({ shape }: { shape: GlyphShape }) {
  switch (shape) {
    case 'diamond':
      return <path d="M12 5.5 18.5 12 12 18.5 5.5 12Z" />;
    case 'star':
      return <path d="M12 5.2 13.9 10.1 18.8 12 13.9 13.9 12 18.8 10.1 13.9 5.2 12 10.1 10.1Z" />;
    case 'triangle':
      return <path d="M12 6.2 18.2 17H5.8Z" />;
    case 'hexagon':
      return <path d="M12 5.6 17.6 8.8V15.2L12 18.4 6.4 15.2V8.8Z" />;
    case 'rectangle':
      return <rect x="6.2" y="8.6" width="11.6" height="6.8" rx="1" />;
    case 'double-circle':
      return (
        <>
          <circle cx="12" cy="12" r="5.6" fill="none" stroke="currentColor" strokeWidth="1.8" />
          <circle cx="12" cy="12" r="2.4" />
        </>
      );
  }
}

/**
 * Bolinha da categoria (DESIGN_SYSTEM.md §4): preenchimento da cor + glifo + anel no PRETO (tema escuro, 1,06:1
 * sem ele). Por padrão é decorativa (o rótulo vem ao lado); com {@code labelled} vira role=img com o rótulo.
 */
export function CategoryDot({ code, size = 20, labelled = false }: { code: string; size?: number; labelled?: boolean }) {
  const info = category(code);
  const a11y = labelled ? { role: 'img', 'aria-label': `Categoria: ${info.label}` } : { 'aria-hidden': true as const };
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      className="os-dot"
      data-category={info.code}
      data-glyph={info.glyph}
      focusable="false"
      {...a11y}
    >
      <circle className="os-dot-fill" cx="12" cy="12" r="11" />
      <g className="os-dot-glyph">
        <GlyphPath shape={info.glyph} />
      </g>
    </svg>
  );
}

/** Bolinha + rótulo (o rótulo pode vir da API, com o mesmo texto do enum). */
export function CategoryBadge({ code, label, size }: { code: string; label?: string; size?: number }) {
  const info = category(code);
  return (
    <span className="inline-flex items-center gap-1.5" data-testid="categoria">
      <CategoryDot code={info.code} size={size} />
      <span>{label ?? info.label}</span>
    </span>
  );
}

/** Selo badge-check: identidade conferida pela moderação (CategoryVerification.VERIFIED). */
export function VerifiedSeal() {
  return (
    <span className="inline-flex items-center" title="Conta verificada">
      <IconVerified size={18} className="text-fg" />
      <span className="sr-only">Conta verificada</span>
    </span>
  );
}

export function verificationText(v: CategoryVerification): string | null {
  switch (v) {
    case 'PENDING':
      return 'Verificação em andamento: você lê e interage, mas ainda não publica como instituição';
    case 'VERIFIED':
      return 'Conta verificada';
    case 'REJECTED':
      return 'Verificação recusada: revise os dados do cadastro';
    default:
      return null;
  }
}
