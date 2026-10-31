'use client';

import { isApiError } from '@orange-social/api';
import { useMutation } from '@tanstack/react-query';
import Image from 'next/image';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';
import { api } from '@/lib/api';
import { useSession } from '@/lib/queries';
import { useLeaveAccount } from '@/lib/use-leave';
import { IconLogin, IconLogout, IconPublish, IconSettings } from './icons';
import { ThemeToggle } from './ThemeToggle';

function SessionLinks() {
  const { data: user, isPending } = useSession();
  const pathname = usePathname();
  const leave = useLeaveAccount();
  const [logoutFailed, setLogoutFailed] = useState(false);
  // sair encerra a sessão no servidor; as outras abas descobrem pelo BroadcastChannel (RF27). Só esquece a sessão
  // local depois que o servidor confirmou (ou disse que ela já não existe, 401): com erro de rede ou 5xx a sessão
  // continua válida no servidor, então a pessoa vê o aviso e tenta de novo.
  const logout = useMutation({
    mutationFn: () => api.auth.logout(),
    onMutate: () => setLogoutFailed(false),
    onSuccess: () => leave('/entrar'),
    onError: (e) => (isApiError(e, 401) ? leave('/entrar') : setLogoutFailed(true)),
  });
  if (isPending) return <span className="inline-block h-11 w-24" aria-hidden="true" />;
  if (!user) {
    return (
      <>
        <Link href="/entrar" className="os-btn os-btn-sm" data-testid="link-entrar" aria-current={pathname === '/entrar' ? 'page' : undefined}>
          <IconLogin size={18} />
          Entrar
        </Link>
        <Link href="/cadastro" className="os-btn os-btn-sm os-btn-primary" aria-current={pathname === '/cadastro' ? 'page' : undefined}>
          Criar conta
        </Link>
      </>
    );
  }
  return (
    <>
      <Link href="/publicar" className="os-btn os-btn-sm os-btn-primary" data-testid="link-publicar" aria-current={pathname === '/publicar' ? 'page' : undefined}>
        <IconPublish size={18} />
        <span>Publicar</span>
      </Link>
      <Link
        href="/configuracoes"
        className="os-btn os-btn-sm"
        data-testid="link-configuracoes"
        aria-current={pathname.startsWith('/configuracoes') ? 'page' : undefined}
      >
        <IconSettings size={18} />
        <span className="sr-only md:not-sr-only">Configurações</span>
        <span className="sr-only"> de @{user.handle}</span>
      </Link>
      <button type="button" className="os-btn os-btn-sm" onClick={() => logout.mutate()} disabled={logout.isPending} data-testid="sair">
        <IconLogout size={18} />
        <span className="sr-only md:not-sr-only">Sair</span>
      </button>
      <span role="status" aria-live="polite" className={logoutFailed ? 'basis-full text-right text-sm text-error' : 'sr-only'} data-testid="sair-erro">
        {logoutFailed ? 'Não foi possível sair agora. Você continua conectado; tente de novo.' : ''}
      </span>
    </>
  );
}

/**
 * Cabeçalho (TopBar): mark oficial + assinatura "orange." (DESIGN_SYSTEM.md §8), o tema e a conta. Os itens
 * quebram linha (flex-wrap) em vez de rolar na horizontal com fonte grande ou tela de 320 px.
 */
export function SiteHeader() {
  return (
    <header className="os-topbar sticky top-0 z-20 border-b border-line">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3">
        <Link href="/" className="mr-auto flex items-center gap-2 text-2xl font-extrabold tracking-tight no-underline" data-testid="logo">
          {/* mark oficial; decorativo porque o nome vem escrito ao lado */}
          <Image src="/brand/orange-social-mark.svg" alt="" width={40} height={40} unoptimized priority className="h-10 w-10" />
          <span>
            orange<span className="text-brand">.</span>
            <span className="sr-only"> Orange Social, início</span>
          </span>
        </Link>
        <nav aria-label="Conta e preferências" className="flex min-w-0 flex-wrap items-center justify-end gap-2">
          <ThemeToggle />
          <SessionLinks />
        </nav>
      </div>
    </header>
  );
}
