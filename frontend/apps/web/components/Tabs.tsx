'use client';

import { useRef, type ReactNode } from 'react';

export interface TabItem<K extends string> {
  key: K;
  label: ReactNode;
  testId?: string;
}

interface Props<K extends string> {
  label: string;
  /** Segmented Switcher dos feeds: no celular o ícone fica em cima do rótulo para as 4 abas caberem numa linha. */
  compact?: boolean;
  idPrefix: string;
  items: TabItem<K>[];
  selected: K;
  onSelect: (key: K) => void;
}

/**
 * Abas (WAI-ARIA APG, "Tabs" com ativação automática): setas, Home e End movem e escolhem; só a aba escolhida
 * entra no Tab. Cada aba controla o painel `${idPrefix}-painel-${key}`.
 */
export function Tabs<K extends string>({ label, idPrefix, items, selected, onSelect, compact = false }: Props<K>) {
  const refs = useRef<Record<string, HTMLButtonElement | null>>({});
  const move = (to: number) => {
    const item = items[(to + items.length) % items.length]!;
    onSelect(item.key);
    refs.current[item.key]?.focus();
  };
  return (
    <div role="tablist" aria-label={label} className={compact ? 'os-tabs os-tabs-compact' : 'os-tabs'}>
      {items.map((it, i) => (
        <button
          key={it.key}
          ref={(el) => {
            refs.current[it.key] = el;
          }}
          type="button"
          role="tab"
          id={`${idPrefix}-aba-${it.key}`}
          aria-selected={it.key === selected}
          aria-controls={`${idPrefix}-painel-${it.key}`}
          tabIndex={it.key === selected ? 0 : -1}
          className="os-tab"
          data-testid={it.testId}
          onClick={() => onSelect(it.key)}
          onKeyDown={(e) => {
            if (e.key === 'ArrowRight') move(i + 1);
            else if (e.key === 'ArrowLeft') move(i - 1);
            else if (e.key === 'Home') move(0);
            else if (e.key === 'End') move(items.length - 1);
            else return;
            e.preventDefault();
          }}
        >
          {it.label}
        </button>
      ))}
    </div>
  );
}

export function TabPanel({ idPrefix, tab, children }: { idPrefix: string; tab: string; children: ReactNode }) {
  return (
    <div role="tabpanel" id={`${idPrefix}-painel-${tab}`} aria-labelledby={`${idPrefix}-aba-${tab}`} className="grid gap-6">
      {children}
    </div>
  );
}
