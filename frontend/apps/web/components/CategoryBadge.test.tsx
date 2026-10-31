import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { CATEGORIES } from '@/lib/categories';
import { CategoryBadge, CategoryDot, VerifiedSeal } from './CategoryBadge';

describe('cor nunca é o único sinal (DESIGN_SYSTEM.md §4)', () => {
  it.each(CATEGORIES.map((t) => [t.code, t.glyph, t.label] as const))('%s: bolinha + glifo %s + rótulo', (code, glyph, label) => {
    const { container } = render(<CategoryBadge code={code} />);
    expect(screen.getByText(label)).toBeInTheDocument();
    const dot = container.querySelector('.os-dot')!;
    expect(dot).toHaveAttribute('data-category', code);
    expect(dot).toHaveAttribute('data-glyph', glyph);
    expect(dot).toHaveAttribute('aria-hidden', 'true');
    expect(dot.querySelector('.os-dot-glyph')?.childElementCount).toBeGreaterThan(0);
  });

  it('os 6 glifos são formas diferentes', () => {
    expect(new Set(CATEGORIES.map((c) => c.glyph)).size).toBe(6);
  });

  it('sozinha, a bolinha tem nome acessível', () => {
    render(<CategoryDot code="PRETO" labelled />);
    expect(screen.getByRole('img', { name: 'Categoria: Especial' })).toBeInTheDocument();
  });

  it('selo com rótulo acessível', () => {
    render(<VerifiedSeal />);
    expect(screen.getByText('Conta verificada')).toHaveClass('sr-only');
  });
});
