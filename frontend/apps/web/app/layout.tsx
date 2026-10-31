import type { Metadata, Viewport } from 'next';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { Providers } from '@/components/Providers';
import { SiteHeader } from '@/components/SiteHeader';
import { THEME_BOOT_SCRIPT } from '@/lib/theme';
import './globals.css';

export const metadata: Metadata = {
  title: { default: 'Orange Social', template: '%s · Orange Social' },
  description: 'Rede social do ecossistema Velion: quatro feeds (perfis, posts, áudio e alertas), seis categorias e LGPD por construção.',
};

export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#FFFFFF' },
    { media: '(prefers-color-scheme: dark)', color: '#17120D' },
  ],
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="pt-BR" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_BOOT_SCRIPT }} />
      </head>
      <body className="flex flex-col bg-bg text-fg antialiased">
        <a href="#conteudo" className="sr-only-focusable fixed left-4 top-2 z-50 rounded-md bg-primary px-4 py-2 font-bold text-on-primary">
          Pular para o conteúdo
        </a>
        <Providers>
          <SiteHeader />
          <main id="conteudo" tabIndex={-1} className="mx-auto w-full max-w-6xl flex-1 px-4 py-6 outline-none sm:py-8">
            {children}
          </main>
        </Providers>
        <footer className="border-t border-line">
          <div className="mx-auto flex max-w-6xl flex-wrap gap-x-6 gap-y-2 px-4 py-6 text-sm text-muted">
            <span>Orange Social · ecossistema Velion</span>
            <Link href="/termos" className="inline-flex min-h-6 items-center underline">
              Termos de Uso
            </Link>
          </div>
        </footer>
      </body>
    </html>
  );
}
