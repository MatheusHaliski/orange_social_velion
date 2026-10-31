import Image from 'next/image';
import type { ReactNode } from 'react';

/**
 * Fundo das telas de conta (entrar, cadastro): o mosaico laranja da marca com o véu do tema e o formulário num
 * cartão opaco (protótipo 13-login). O logo completo é decorativo: o nome vem escrito no cabeçalho.
 */
export function AuthBackdrop({ children, wide = false }: { children: ReactNode; wide?: boolean }) {
  return (
    <div className="os-auth-bg -mx-4 -my-6 px-4 py-8 sm:-my-8 sm:py-12">
      <div className={`os-card mx-auto grid gap-6 bg-bg p-5 sm:p-8 ${wide ? 'max-w-3xl' : 'max-w-md'}`}>
        <Image src="/brand/orange-social-logo.svg" alt="" width={72} height={72} unoptimized className="mx-auto h-18 w-18" />
        {children}
      </div>
    </div>
  );
}
