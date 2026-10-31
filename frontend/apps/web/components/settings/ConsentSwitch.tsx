'use client';

import type { ConsentView } from '@orange-social/api';
import { useId } from 'react';
import { describedBy } from '@/components/Form';
import { IconLocked } from '@/components/icons';
import { Switch } from '@/components/Switch';
import { formatDate } from '@/lib/format';

interface ConsentSwitchProps {
  consent: ConsentView;
  onToggle: (granted: boolean) => void;
  busy?: boolean;
}

/** Texto da chave travada (lockedForMinor): o sensível só aos 18 (LGPD Art. 14), os demais aos 16 (ECA Digital). */
export function lockedText(consent: Pick<ConsentView, 'sensitive'>): string {
  return consent.sensitive ? 'Disponível a partir dos 18 anos' : 'Disponível a partir dos 16 anos';
}

/**
 * Um consentimento (RF3): finalidade, base legal e o interruptor, desligado por padrão. Revogar é o mesmo toque
 * que autorizar (LGPD Art. 8º, §5º). Rótulo, descrição e base legal vêm da API (GET /api/v1/me/consents).
 */
export function ConsentSwitch({ consent, onToggle, busy }: ConsentSwitchProps) {
  const uid = useId();
  const titleId = `${uid}-titulo`;
  const descId = `${uid}-desc`;
  const lawId = `${uid}-base`;
  const lockId = `${uid}-trava`;
  const locked = consent.lockedForMinor;

  return (
    <li id={`consentimento-${consent.purpose}`} className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2 p-4" data-testid={`consentimento-${consent.purpose}`}>
      <div className="grid min-w-0 flex-1 basis-64 gap-1">
        <p id={titleId} className="font-bold">
          {consent.label}
        </p>
        <p id={descId} className="text-sm text-muted">
          {consent.description}
        </p>
        <p className="flex flex-wrap gap-2">
          <span id={lawId} className="os-law">
            <span className="sr-only">Base legal: </span>
            {consent.legalBasis}
          </span>
          {consent.sensitive && <span className="os-law">Dado sensível</span>}
        </p>
        {locked && (
          <p id={lockId} className="flex items-center gap-1.5 text-sm font-semibold">
            <IconLocked size={16} />
            {lockedText(consent)}
          </p>
        )}
        {consent.updatedAt && <p className="text-sm text-muted">Alterado em {formatDate(consent.updatedAt)}.</p>}
      </div>
      <Switch
        id={`${uid}-chave`}
        checked={consent.granted}
        onChange={onToggle}
        labelledBy={titleId}
        describedBy={describedBy(descId, lawId, locked && lockId)}
        disabled={locked}
        busy={busy}
      />
    </li>
  );
}
