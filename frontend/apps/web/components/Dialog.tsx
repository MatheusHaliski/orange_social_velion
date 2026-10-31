'use client';

import { useEffect, useRef, type ReactNode, type RefObject } from 'react';
import { createPortal } from 'react-dom';

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

interface DialogProps {
  open: boolean;
  onClose: () => void;
  /** alertdialog para ação destrutiva (excluir conta); dialog para o resto. */
  role?: 'dialog' | 'alertdialog';
  labelledBy: string;
  describedBy?: string;
  /** Recebe o foco ao abrir; sem ele, o primeiro controle do diálogo. */
  initialFocus?: RefObject<HTMLElement | null>;
  /** sheet = painel alto (modal do post, até 92 % da altura). */
  variant?: 'dialog' | 'sheet';
  children: ReactNode;
}

/**
 * Diálogo modal: o resto da página fica inerte, Tab e Shift+Tab giram dentro dele, Esc fecha e o foco volta para
 * quem abriu (WAI-ARIA APG, "Dialog (Modal)").
 */
export function Dialog({ open, onClose, role = 'dialog', labelledBy, describedBy, initialFocus, variant = 'dialog', children }: DialogProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    if (!open) return;
    const opener = document.activeElement as HTMLElement | null;
    const panel = panelRef.current;
    const host = panel?.closest<HTMLElement>('[data-dialog-host]');
    // tudo o que não é o diálogo fica inerte (sem foco, sem clique, fora da árvore de acessibilidade)
    const others = [...document.body.children].filter((el) => el !== host && !el.hasAttribute('inert')) as HTMLElement[];
    others.forEach((el) => el.setAttribute('inert', ''));
    const first = initialFocus?.current ?? panel?.querySelector<HTMLElement>(FOCUSABLE) ?? panel;
    first?.focus();

    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        e.preventDefault();
        onCloseRef.current();
        return;
      }
      if (e.key !== 'Tab' || !panel) return;
      const items = [...panel.querySelectorAll<HTMLElement>(FOCUSABLE)].filter((el) => !el.closest('[hidden], [inert]'));
      if (!items.length) {
        e.preventDefault();
        return;
      }
      const firstItem = items[0]!;
      const lastItem = items[items.length - 1]!;
      if (e.shiftKey && (document.activeElement === firstItem || !panel.contains(document.activeElement))) {
        e.preventDefault();
        lastItem.focus();
      } else if (!e.shiftKey && (document.activeElement === lastItem || !panel.contains(document.activeElement))) {
        e.preventDefault();
        firstItem.focus();
      }
    }
    document.addEventListener('keydown', onKey);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      others.forEach((el) => el.removeAttribute('inert'));
      document.body.style.overflow = previousOverflow;
      if (opener?.isConnected) opener.focus();
    };
  }, [open, initialFocus]);

  if (!open || typeof document === 'undefined') return null;
  return createPortal(
    <div data-dialog-host="" className="os-backdrop">
      <div
        ref={panelRef}
        role={role}
        aria-modal="true"
        aria-labelledby={labelledBy}
        aria-describedby={describedBy}
        tabIndex={-1}
        className={`os-dialog p-5 outline-none sm:p-6${variant === 'sheet' ? ' os-sheet' : ''}`}
      >
        {children}
      </div>
    </div>,
    document.body,
  );
}
