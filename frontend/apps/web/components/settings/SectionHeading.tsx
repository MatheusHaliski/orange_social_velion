'use client';

import { useEffect, useRef, type ReactNode } from 'react';

/**
 * Título da seção (h1). Recebe o foco ao abrir a seção, para quem usa leitor de tela ou teclado saber onde
 * chegou depois de escolher no menu.
 */
export function SectionHeading({ children, description }: { children: ReactNode; description?: ReactNode }) {
  const ref = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    ref.current?.focus({ preventScroll: true });
  }, []);
  return (
    <div className="grid gap-1">
      <p className="text-sm font-semibold uppercase tracking-wider text-muted">Configurações</p>
      <h1 ref={ref} tabIndex={-1} className="text-3xl font-extrabold outline-none">
        {children}
      </h1>
      {description && <p className="text-muted">{description}</p>}
    </div>
  );
}
