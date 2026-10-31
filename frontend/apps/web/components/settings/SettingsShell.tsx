'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';
import { Notice } from '@/components/Form';
import { IconPrev } from '@/components/icons';
import { useRequireSession } from '@/lib/queries';
import { SettingsSideNav } from './SettingsNav';

/** Casca de /configuracoes: exige sessão, menu lateral na tela larga e "voltar" para a lista no celular. */
export function SettingsShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const session = useRequireSession(pathname);
  const isIndex = pathname === '/configuracoes';

  if (session.isError) {
    return (
      <Notice tone="error">
        <p>Não foi possível conferir a sua sessão. Verifique a conexão e recarregue a página.</p>
      </Notice>
    );
  }
  if (session.isPending || !session.data) return <p className="text-muted">Carregando…</p>;

  if (isIndex) return <div className="grid max-w-4xl gap-6">{children}</div>;

  return (
    <div className="grid gap-6 md:grid-cols-[15rem_minmax(0,1fr)] md:gap-10">
      <SettingsSideNav current={pathname} />
      <div className="grid min-w-0 max-w-3xl content-start gap-6">
        <Link href="/configuracoes" className="inline-flex min-h-11 w-fit items-center gap-1 font-semibold underline md:hidden">
          <IconPrev size={18} />
          Configurações
        </Link>
        {children}
      </div>
    </div>
  );
}
