'use client';

import { forwardRef, useCallback, useEffect, useRef, useState, type ReactNode, type RefObject } from 'react';
import { IconFormError, IconInfo, IconSuccess } from './icons';

/** Mensagens de erro de um campo: ícone circle-alert + texto, nunca só a cor. */
export function FieldErrors({ id, errors }: { id: string; errors?: string[] }) {
  if (!errors?.length) return null;
  return (
    <div id={id} className="mt-1 grid gap-0.5 text-sm font-semibold text-error">
      {errors.map((e) => (
        <p key={e} className="flex items-start gap-1.5">
          <IconFormError size={16} className="mt-0.5 flex-none" />
          <span>{e}</span>
        </p>
      ))}
    </div>
  );
}

export function describedBy(...ids: Array<string | false | null | undefined>): string | undefined {
  const s = ids.filter(Boolean).join(' ');
  return s || undefined;
}

interface FieldProps {
  id: string;
  label: ReactNode;
  hint?: ReactNode;
  errors?: string[];
  required?: boolean;
  children: (aria: { id: string; 'aria-describedby'?: string; 'aria-invalid'?: true; required?: boolean }) => ReactNode;
  className?: string;
}

/** Rótulo, dica e erros ligados ao controle por id e aria-describedby. */
export function Field({ id, label, hint, errors, required, children, className }: FieldProps) {
  const hintId = hint ? `${id}-dica` : null;
  const errId = errors?.length ? `${id}-erro` : null;
  return (
    <div className={className ?? 'grid content-start gap-1'}>
      <label htmlFor={id} className="font-semibold">
        {label}
        {required ? <span className="text-muted font-normal"> (obrigatório)</span> : null}
      </label>
      {hint ? (
        <p id={hintId!} className="text-sm text-muted">
          {hint}
        </p>
      ) : null}
      {children({
        id,
        'aria-describedby': describedBy(hintId, errId),
        ...(errId ? { 'aria-invalid': true as const } : {}),
        ...(required ? { required: true } : {}),
      })}
      <FieldErrors id={`${id}-erro`} errors={errors} />
    </div>
  );
}

/**
 * Resumo dos erros no topo do formulário. Recebe o foco quando aparece, para quem usa leitor de tela ou teclado
 * saber o que corrigir; cada item leva ao campo.
 */
export const ErrorSummary = forwardRef<HTMLDivElement, { title?: string; items: Array<{ message: string; fieldId?: string }> }>(
  function ErrorSummary({ title = 'Revise os dados', items }, ref) {
    if (!items.length) return null;
    return (
      <div ref={ref} tabIndex={-1} role="alert" className="rounded-md border-2 border-error p-4" data-testid="error-summary">
        <p className="flex items-center gap-2 font-bold text-error">
          <IconFormError size={20} />
          {title}
        </p>
        <ul className="mt-2 grid gap-1 pl-7 list-disc">
          {items.map((it, i) => (
            <li key={`${i}-${it.message}`}>
              {it.fieldId ? (
                <a href={`#${it.fieldId}`} className="underline">
                  {it.message}
                </a>
              ) : (
                it.message
              )}
            </li>
          ))}
        </ul>
      </div>
    );
  },
);

/**
 * Foco depois do commit. Quem pede o foco no mesmo evento em que monta o elemento (ex.: `setErrors` + resumo de
 * erros) não pode usar `requestAnimationFrame`: com a máquina ocupada, o quadro roda antes de o React montar o
 * elemento e o `ref` ainda está nulo. Aqui o pedido vira estado, e o efeito foca só depois do render que o montou.
 */
export function useDeferredFocus<T extends HTMLElement>(): [RefObject<T | null>, () => void] {
  const ref = useRef<T>(null);
  const [request, setRequest] = useState(0);
  useEffect(() => {
    if (request) ref.current?.focus();
  }, [request]);
  const focus = useCallback(() => setRequest((n) => n + 1), []);
  return [ref, focus];
}

/** Foca o elemento quando a chave muda (ex.: novo envio com erro). */
export function useFocusOnChange<T extends HTMLElement>(key: unknown) {
  const ref = useRef<T>(null);
  useEffect(() => {
    if (key) ref.current?.focus();
  }, [key]);
  return ref;
}

export function Notice({ tone = 'info', children, live = false }: { tone?: 'info' | 'success' | 'error'; children: ReactNode; live?: boolean }) {
  const Icon = tone === 'success' ? IconSuccess : tone === 'error' ? IconFormError : IconInfo;
  const color = tone === 'success' ? 'border-success' : tone === 'error' ? 'border-error' : 'border-line-strong';
  const iconColor = tone === 'success' ? 'text-success' : tone === 'error' ? 'text-error' : 'text-fg';
  return (
    <div
      className={`flex items-start gap-2 rounded-md border-2 ${color} p-3`}
      role={live ? (tone === 'error' ? 'alert' : 'status') : undefined}
    >
      <Icon size={20} className={`mt-0.5 flex-none ${iconColor}`} />
      <div className="grid gap-1">{children}</div>
    </div>
  );
}
