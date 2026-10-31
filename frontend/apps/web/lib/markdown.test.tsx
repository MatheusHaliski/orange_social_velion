import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Markdown, parseMarkdown, slugify } from './markdown';

const SRC = `# Termos de Uso

**Versão 1** · vigente a partir de {{DATA}}

> Rascunho para **revisão**.

| Marcador | O que preencher |
|---|---|
| \`{{CNPJ}}\` | CNPJ da empresa |

## 2. Aceite

- primeiro item
  - item aninhado
- segundo com [link](https://exemplo.com) e [ruim](javascript:alert(1))

Parágrafo
em duas linhas.

---
`;

describe('Markdown mínimo dos Termos', () => {
  it('reconhece os blocos', () => {
    expect(parseMarkdown(SRC).map((b) => b.kind)).toEqual(['heading', 'paragraph', 'quote', 'table', 'heading', 'list', 'paragraph', 'hr']);
  });

  it('renderiza sem HTML cru e com links seguros', () => {
    render(<Markdown source={SRC} />);
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Termos de Uso');
    expect(screen.getByRole('heading', { level: 2 })).toHaveAttribute('id', '2-aceite');
    expect(screen.getByRole('columnheader', { name: 'Marcador' })).toBeInTheDocument();
    expect(screen.getByText('{{CNPJ}}').tagName).toBe('CODE');
    expect(screen.getByRole('link', { name: 'link' })).toHaveAttribute('href', 'https://exemplo.com');
    expect(screen.queryByRole('link', { name: 'ruim' })).toBeNull();
    expect(screen.getByText('item aninhado').closest('ul')?.parentElement?.tagName).toBe('LI');
    expect(screen.getByText('Parágrafo em duas linhas.')).toBeInTheDocument();
  });

  it('slug sem acento', () => {
    expect(slugify('3. Quem pode usar')).toBe('3-quem-pode-usar');
    expect(slugify('Ação é ótima')).toBe('acao-e-otima');
  });
});
