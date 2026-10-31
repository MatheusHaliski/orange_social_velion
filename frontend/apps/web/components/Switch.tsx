'use client';

interface SwitchProps {
  id: string;
  checked: boolean;
  onChange: (next: boolean) => void;
  /** id do texto que dá nome ao interruptor (o título da linha). */
  labelledBy: string;
  describedBy?: string;
  disabled?: boolean;
  /** Enquanto salva: fica ocupado e não aceita outro toque. */
  busy?: boolean;
}

/**
 * Interruptor liga/desliga (role="switch"). O estado aparece pela posição do botão e pelo texto "Ligado" ou
 * "Desligado" ao lado, nunca só pela cor (WCAG 1.4.1).
 */
export function Switch({ id, checked, onChange, labelledBy, describedBy, disabled, busy }: SwitchProps) {
  return (
    <button
      id={id}
      type="button"
      role="switch"
      aria-checked={checked}
      aria-labelledby={labelledBy}
      aria-describedby={describedBy}
      aria-busy={busy || undefined}
      disabled={disabled}
      className="os-switch"
      onClick={() => {
        if (!busy) onChange(!checked);
      }}
    >
      <span className="os-switch-track" aria-hidden="true" />
      <span className="os-switch-state" aria-hidden="true">
        {checked ? 'Ligado' : 'Desligado'}
      </span>
    </button>
  );
}
