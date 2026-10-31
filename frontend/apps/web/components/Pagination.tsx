import Link from 'next/link';
import { IconNext, IconPrev } from './icons';

interface Props {
  page: number;
  size: number;
  total: number;
  hrefFor?: (page: number) => string;
  onPage?: (page: number) => void;
  label?: string;
}

/** Paginação com links (Explorar, compartilhável) ou botões (avaliações). */
export function Pagination({ page, size, total, hrefFor, onPage, label = 'Paginação' }: Props) {
  const pages = Math.max(1, Math.ceil(total / size));
  if (pages <= 1) return null;
  const item = (target: number, text: string, Icon: typeof IconPrev, disabled: boolean, rel: 'prev' | 'next') => {
    const content = (
      <>
        {rel === 'prev' && <Icon size={18} />}
        {text}
        {rel === 'next' && <Icon size={18} />}
      </>
    );
    if (disabled) {
      return (
        <span className="os-btn" aria-disabled="true">
          {content}
        </span>
      );
    }
    return hrefFor ? (
      <Link className="os-btn" href={hrefFor(target)} rel={rel} scroll>
        {content}
      </Link>
    ) : (
      <button type="button" className="os-btn" onClick={() => onPage?.(target)}>
        {content}
      </button>
    );
  };
  return (
    <nav aria-label={label} className="flex flex-wrap items-center justify-between gap-3">
      {item(page - 1, 'Anterior', IconPrev, page <= 0, 'prev')}
      <span className="text-sm text-muted">
        Página {page + 1} de {pages}
      </span>
      {item(page + 1, 'Próxima', IconNext, page >= pages - 1, 'next')}
    </nav>
  );
}
