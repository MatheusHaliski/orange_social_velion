'use client';

import type { FrameCatalog } from '@orange-social/api';
import { useId, useState } from 'react';
import { Dialog } from '@/components/Dialog';
import { seasonGradient } from '@/lib/frame';

interface Props {
  open: boolean;
  catalog: FrameCatalog;
  current: { presetId: string | null; auto: boolean };
  onApply: (choice: { presetId: string | null; auto: boolean }) => void;
  onClose: () => void;
}

/**
 * Cartela sazonal: um rascunho dentro do modal. "Aplicar" leva a escolha para a moldura; "Cancelar" (ou Esc)
 * descarta. "Automática pela data" troca de cartela sozinha conforme o dia em São Paulo.
 */
export function SeasonDialog({ open, catalog, current, onApply, onClose }: Props) {
  if (!open) return null;
  return <SeasonDialogBody catalog={catalog} current={current} onApply={onApply} onClose={onClose} />;
}

function SeasonDialogBody({ catalog, current, onApply, onClose }: Omit<Props, 'open'>) {
  const uid = useId();
  const [draft, setDraft] = useState<string>(current.auto ? 'AUTO' : (current.presetId ?? 'AUTO'));
  const today = catalog.seasons.find((s) => s.id === catalog.activeSeasonId);
  const options = [
    { id: 'AUTO', name: 'Automática pela data', detail: today ? `Hoje: ${today.name}. Muda sozinha com a época.` : 'Muda sozinha com a época.', colors: today?.colors ?? [] },
    ...catalog.seasons.map((s) => ({ id: s.id, name: s.name, detail: `${s.window}${s.auto ? '' : ' · nunca entra no modo automático'}`, colors: s.colors })),
  ];
  return (
    <Dialog open onClose={onClose} labelledBy={`${uid}-titulo`} describedBy={`${uid}-desc`}>
      <form
        className="grid gap-4"
        onSubmit={(e) => {
          e.preventDefault();
          onApply(draft === 'AUTO' ? { presetId: null, auto: true } : { presetId: draft, auto: false });
        }}
      >
        <h2 id={`${uid}-titulo`} className="text-xl font-bold">
          Cartela sazonal
        </h2>
        <p id={`${uid}-desc`} className="text-sm text-muted">
          Cores da cozinha de cada época, no Hemisfério Sul. Nada muda na moldura até você aplicar.
        </p>
        <fieldset className="grid gap-2">
          <legend className="sr-only">Escolha a cartela</legend>
          {options.map((o) => (
            <label key={o.id} className="os-card flex cursor-pointer items-center gap-3 p-3 has-[:checked]:border-2 has-[:checked]:border-fg">
              <input type="radio" name="cartela" value={o.id} checked={draft === o.id} onChange={() => setDraft(o.id)} className="size-5 flex-none" />
              <span aria-hidden="true" className="h-8 w-14 flex-none rounded-sm border border-line-strong" style={{ background: seasonGradient(o.colors) ?? undefined }} />
              <span className="grid">
                <span className="font-semibold">{o.name}</span>
                <span className="text-sm text-muted">{o.detail}</span>
              </span>
            </label>
          ))}
        </fieldset>
        <div className="flex flex-wrap gap-2">
          <button type="submit" className="os-btn os-btn-primary">
            Aplicar
          </button>
          <button type="button" className="os-btn" onClick={onClose}>
            Cancelar
          </button>
        </div>
      </form>
    </Dialog>
  );
}
