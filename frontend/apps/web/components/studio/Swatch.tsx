'use client';

import type { CSSProperties, ReactNode } from 'react';
import { IconClose, IconSuccess } from '@/components/icons';

interface Props {
  label: string;
  /** Texto extra para o leitor de tela (ex.: o clima do padrão). */
  description?: string;
  pressed: boolean;
  onClick: () => void;
  /** Prévia: CSS de fundo (cor, gradiente, cartela ou padrão do catálogo). */
  paint?: string | null;
  /** "Nenhum": mostra o X em vez da prévia. */
  none?: boolean;
  children?: ReactNode;
  disabled?: boolean;
  testId?: string;
}

/** Miniatura do estúdio: botão com aria-pressed, prévia decorativa e o nome sempre escrito. */
export function Swatch({ label, description, pressed, onClick, paint, none, children, disabled, testId }: Props) {
  const style: CSSProperties | undefined = paint ? { background: paint } : undefined;
  return (
    <button
      type="button"
      className="os-swatch"
      aria-pressed={pressed}
      onClick={onClick}
      disabled={disabled}
      title={description ? `${label}: ${description}` : label}
      data-testid={testId}
    >
      <span className="os-swatch-paint" style={style} aria-hidden="true">
        {none && (
          <span className="grid h-full place-items-center bg-surface text-muted">
            <IconClose size={20} />
          </span>
        )}
        {children}
        <span className="os-swatch-check">
          <IconSuccess size={14} />
        </span>
      </span>
      <span>
        {label}
        {description && <span className="sr-only">, {description}</span>}
      </span>
    </button>
  );
}
