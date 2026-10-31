'use client';

import { isApiError, type PreferencesPatch, type PreferencesView } from '@orange-social/api';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState, type ReactNode, type RefObject } from 'react';
import { Notice, useDeferredFocus } from '@/components/Form';
import { IconLocked } from '@/components/icons';
import { api } from '@/lib/api';
import { PREFERENCES_KEY } from '@/lib/queries';

export type Result = { tone: 'success' | 'error'; text: string } | null;

/** PATCH /api/v1/me/preferences com o aviso de sucesso ou erro (focado, para o leitor de tela anunciar). */
export function useSavePreferences(successText: string, onSaved?: (view: PreferencesView) => void) {
  const queryClient = useQueryClient();
  const [result, setResult] = useState<Result>(null);
  const [resultRef, focusResult] = useDeferredFocus<HTMLDivElement>();
  const mutation = useMutation({
    mutationFn: (patch: PreferencesPatch) => api.me.updatePreferences(patch),
    onMutate: () => setResult(null),
    onSuccess: (view) => {
      queryClient.setQueryData(PREFERENCES_KEY, view);
      onSaved?.(view);
      setResult({ tone: 'success', text: successText });
      focusResult();
    },
    onError: (e) => {
      const text = isApiError(e) ? (e.errors.length ? e.errors.join(' ') : e.detail) : 'Não foi possível salvar agora. Tente de novo.';
      setResult({ tone: 'error', text });
      focusResult();
    },
  });
  return { mutation, result, setResult, resultRef };
}

export function ResultNotice({ result, innerRef }: { result: Result; innerRef: RefObject<HTMLDivElement | null> }) {
  return (
    <div ref={innerRef} tabIndex={-1} className="outline-none">
      {result && (
        <Notice tone={result.tone} live>
          <p>{result.text}</p>
        </Notice>
      )}
    </div>
  );
}

/** Aviso do ECA Digital para menor de 16. */
export function MinorNotice() {
  return (
    <div className="flex items-start gap-2 rounded-md border-2 border-line-strong p-3" data-testid="aviso-menor">
      <IconLocked size={20} className="mt-0.5 flex-none" />
      <p>
        Conta de menor de 16 anos: as proteções ficam ligadas e só o responsável pode alterá-las (ECA Digital). As travadas
        aparecem com o cadeado.
      </p>
    </div>
  );
}

/** Caixa de seleção com rótulo, dica e, se travada, o cadeado e o motivo. */
export function CheckRow({
  id,
  label,
  hint,
  checked,
  onChange,
  locked,
}: {
  id: string;
  label: ReactNode;
  hint?: ReactNode;
  checked: boolean;
  onChange: (v: boolean) => void;
  locked?: boolean;
}) {
  return (
    <div className="flex min-h-11 items-start gap-2">
      <input
        id={id}
        type="checkbox"
        className="mt-0.5 size-6 flex-none"
        checked={checked}
        disabled={locked}
        onChange={(e) => onChange(e.target.checked)}
        aria-describedby={hint || locked ? `${id}-dica` : undefined}
      />
      <div className="grid gap-0.5">
        <label htmlFor={id} className="flex items-center gap-1.5 font-semibold">
          {locked && <IconLocked size={16} />}
          {label}
        </label>
        {(hint || locked) && (
          <p id={`${id}-dica`} className="text-sm text-muted">
            {hint}
            {locked ? `${hint ? ' ' : ''}Travado: só o responsável altera.` : ''}
          </p>
        )}
      </div>
    </div>
  );
}

/** Grupo de rádio em pílulas; as opções travadas ficam desabilitadas com o cadeado. */
export function RadioPills<T extends string>({
  name,
  legend,
  hint,
  options,
  value,
  onChange,
}: {
  name: string;
  legend: ReactNode;
  hint?: ReactNode;
  options: ReadonlyArray<{ value: T; label: string; locked?: boolean }>;
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <fieldset className="grid gap-2" aria-describedby={hint ? `${name}-dica` : undefined}>
      <legend className="mb-1 font-semibold">{legend}</legend>
      {hint && (
        <p id={`${name}-dica`} className="text-sm text-muted">
          {hint}
        </p>
      )}
      <div className="flex flex-wrap gap-2">
        {options.map((o) => {
          const id = `${name}-${o.value}`;
          return (
            <div key={o.value} className="relative">
              <input
                id={id}
                type="radio"
                name={name}
                className="os-visually-hidden-input peer"
                value={o.value}
                checked={value === o.value}
                disabled={o.locked}
                onChange={() => onChange(o.value)}
              />
              <label htmlFor={id} className="os-pill peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                {o.locked && <IconLocked size={14} />}
                {o.label}
                {o.locked && <span className="sr-only"> (travado: só o responsável altera)</span>}
              </label>
            </div>
          );
        })}
      </div>
    </fieldset>
  );
}
