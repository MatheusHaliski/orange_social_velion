'use client';

import { Field } from '@/components/Form';

export interface SudoValues {
  password: string;
  code: string;
}

/**
 * Confirmação de identidade do modo sudo (StepUp): a senha atual e, com o 2FA ativo, o código do app ou um código
 * de recuperação.
 */
export function SudoFields({
  idPrefix,
  values,
  onChange,
  withCode,
  errors,
  passwordLabel = 'Senha atual',
}: {
  idPrefix: string;
  values: SudoValues;
  onChange: (v: SudoValues) => void;
  withCode: boolean;
  errors: Record<string, string[] | undefined>;
  passwordLabel?: string;
}) {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <Field id={`${idPrefix}-password`} label={passwordLabel} required errors={errors.password}>
        {(a) => (
          <input
            {...a}
            type="password"
            className="os-input"
            autoComplete="current-password"
            value={values.password}
            onChange={(e) => onChange({ ...values, password: e.target.value })}
          />
        )}
      </Field>
      {withCode && (
        <Field id={`${idPrefix}-code`} label="Código do app" required hint="6 dígitos, ou um código de recuperação." errors={errors.code}>
          {(a) => (
            <input
              {...a}
              className="os-input font-mono tracking-widest"
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={32}
              value={values.code}
              onChange={(e) => onChange({ ...values, code: e.target.value })}
            />
          )}
        </Field>
      )}
    </div>
  );
}

/** Erros locais antes de mandar: senha vazia, código vazio. */
export function checkSudo(values: SudoValues, withCode: boolean): Record<string, string[]> {
  const out: Record<string, string[]> = {};
  if (!values.password) out.password = ['Digite a sua senha atual.'];
  if (withCode && values.code.replace(/\s/g, '').length < 6) out.code = ['Digite o código de 6 dígitos do app (ou um de recuperação).'];
  return out;
}

export function sudoBody(values: SudoValues, withCode: boolean) {
  return { password: values.password, code: withCode ? values.code.replace(/\s/g, '') : null };
}
