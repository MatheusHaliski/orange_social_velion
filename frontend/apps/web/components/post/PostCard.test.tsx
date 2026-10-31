import type { BackgroundView, FrameCatalog, FrameConfig, PostCardView, PostDetailView } from '@orange-social/api';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, within } from '@testing-library/react';
import type { ReactElement } from 'react';
import { describe, expect, it, vi } from 'vitest';
import catalogJson from '../../e2e/fixtures/catalogo-molduras.json';
import postsJson from '../../e2e/fixtures/posts.json';
import { fromConfig, previewBackground } from '@/lib/frame';
import { PostCard } from './PostCard';
import { containerStyle } from './PostFrame';

vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn(), back: vi.fn() }) }));

type Stored = Omit<PostDetailView, 'background'> & { background: FrameConfig | null };
const catalog = catalogJson as unknown as FrameCatalog;
const posts = postsJson as unknown as Stored[];

function card(n: number, patch: Partial<PostCardView> = {}): PostCardView {
  const p = posts.find((x) => x.id.endsWith(String(n).padStart(12, '0')))!;
  const background: BackgroundView | null = p.background ? previewBackground(fromConfig(p.background), catalog) : null;
  return { ...p, publishedAt: new Date(Date.now() - 180_000).toISOString(), detailPath: `/api/v1/posts/${p.id}`, background, ...patch };
}

function renderCard(ui: ReactElement) {
  const qc = new QueryClient({ defaultOptions: { queries: { enabled: false, retry: false } } });
  return render(<QueryClientProvider client={qc}>{ui}</QueryClientProvider>);
}

describe('PostCard (OS-32 · RF24 · RF28)', () => {
  it('arte só na faixa externa (decorativa); categoria com glifo, mídia, classificação e título no container', () => {
    const { container } = renderCard(<PostCard post={card(1)} motion={false} />);
    const art = container.querySelector('.os-frame-art')!;
    expect(art).toHaveAttribute('aria-hidden', 'true');
    expect(art.textContent).toBe('');
    const article = screen.getByRole('article', { name: 'O que ninguém te conta sobre começar a programar' });
    expect(article).toHaveClass('os-post');
    expect(article).toHaveAttribute('data-category', 'AMARELO');
    expect(within(article).getByTestId('categoria')).toHaveTextContent('Networking');
    expect(article.querySelector('svg.os-dot')).toHaveAttribute('data-glyph', 'star');
    expect(within(article).getByTestId('tipo-midia')).toHaveTextContent('Vídeo');
    expect(within(article).getByTestId('classificacao')).toHaveTextContent('Livre');
    expect(within(article).getByTestId('autor-link')).toHaveAttribute('href', '/u/101');
    expect(within(article).getByTestId('autor-link')).toHaveTextContent('Ver perfil de techblog.br');
    expect(within(article).getByRole('link', { name: 'O que ninguém te conta sobre começar a programar' })).toHaveAttribute(
      'href',
      '/posts/0199a1b2-c3d4-7e5f-8a9b-000000000001',
    );
    expect(within(article).getByText('há 3 min').closest('time')).toHaveAttribute('dateTime');
  });

  it('Aura Hype só liga com o post em alta; o texto "em alta" fica no rodapé', () => {
    const { container, rerender } = renderCard(<PostCard post={card(1, { trending: 'STABLE' })} motion={false} />);
    expect(container.querySelector('.os-frame')).not.toHaveAttribute('data-hype');
    rerender(
      <QueryClientProvider client={new QueryClient()}>
        <PostCard post={card(1)} motion={false} />
      </QueryClientProvider>,
    );
    expect(container.querySelector('.os-frame')).toHaveAttribute('data-hype', 'SCANNER');
    expect(screen.getByTestId('tendencia')).toHaveTextContent('em alta');
  });

  it('Aura Plus: pôster sempre; vídeo só com movimento', () => {
    const { container, rerender } = renderCard(<PostCard post={card(4)} motion={false} />);
    expect(screen.getByTestId('aura-plus').querySelector('img')).toHaveAttribute('src', '/brand/auras/brasa-poster.webp');
    expect(container.querySelector('video')).toBeNull();
    rerender(
      <QueryClientProvider client={new QueryClient()}>
        <PostCard post={card(4)} motion />
      </QueryClientProvider>,
    );
    expect(container.querySelector('video source')).toHaveAttribute('src', '/brand/auras/brasa-hq.mp4');
  });

  it('alerta oficial: severidade, fonte verificada, nunca moldura e só compartilhar', () => {
    const { container } = renderCard(<PostCard post={card(7, { background: card(2).background })} motion />);
    expect(container.querySelector('.os-frame')).toBeNull();
    expect(screen.getByTestId('severidade')).toHaveTextContent('Alerta severo · Chuva forte');
    expect(screen.getByTestId('fonte-verificada')).toHaveTextContent('fonte verificada');
    expect(screen.queryByTestId('curtir')).toBeNull();
    // o número visível (1,2 mil) faz parte do nome, com o exato por extenso (WCAG 2.5.3)
    expect(screen.getByTestId('compartilhar')).toHaveTextContent('Compartilhar, 1,2 mil (1.200 compartilhamentos)');
  });

  it('container emoldurado: tinta e tons secundários com 4,5:1 e a pílula da bolinha no fundo do tema', () => {
    const s = containerStyle('#F5EDE3', '#17120D') as Record<string, string>;
    expect(s['--os-color-text']).toBe('#17120D');
    expect(s['--os-badge-bg']).toBe('#FFFFFF');
    expect(s.colorScheme).toBe('light');
    const d = containerStyle('#211A12', '#F5EDE3') as Record<string, string>;
    expect(d['--os-badge-bg']).toBe('#17120D');
    expect(d['--os-color-category-preto-ring']).toBe('#D6D0C8');
  });
});
