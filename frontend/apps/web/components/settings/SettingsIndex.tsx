'use client';

import { useEffect, useRef } from 'react';
import { IconMfaOn } from '@/components/icons';
import { SettingsList } from './SettingsNav';

/** /configuracoes: a lista das seções, com o aviso de privacidade por padrão. */
export function SettingsIndex() {
  const ref = useRef<HTMLHeadingElement>(null);
  useEffect(() => ref.current?.focus({ preventScroll: true }), []);
  return (
    <>
      <h1 ref={ref} tabIndex={-1} className="text-3xl font-extrabold outline-none">
        Configurações
      </h1>
      <div className="flex items-start gap-2 rounded-md border-2 border-success p-3">
        <IconMfaOn size={20} className="mt-0.5 flex-none text-success" />
        <p>Privacidade por padrão: todo uso opcional dos seus dados começa desligado. Revogar é o mesmo toque que autorizar.</p>
      </div>
      <SettingsList />
    </>
  );
}
