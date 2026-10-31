// Renderizador mínimo de Markdown para os Termos de Uso (docs/legal/TERMOS_DE_USO.md): títulos, parágrafos,
// listas (com um nível de aninhamento), citação, tabela, linha horizontal, negrito, itálico, código e links.
// Gera elementos React (sem HTML cru), então nada do texto vira marcação.
import type { ReactNode } from 'react';

type Block =
  | { kind: 'heading'; level: number; text: string }
  | { kind: 'paragraph'; text: string }
  | { kind: 'list'; ordered: boolean; items: { text: string; children: string[] }[] }
  | { kind: 'quote'; text: string }
  | { kind: 'table'; head: string[]; rows: string[][] }
  | { kind: 'hr' };

export function slugify(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-');
}

function cells(line: string): string[] {
  return line
    .trim()
    .replace(/^\|/, '')
    .replace(/\|$/, '')
    .split('|')
    .map((c) => c.trim());
}

export function parseMarkdown(src: string): Block[] {
  const lines = src.replace(/\r\n?/g, '\n').split('\n');
  const blocks: Block[] = [];
  let i = 0;
  const isListItem = (l: string) => /^(\s*)([-*]|\d+\.)\s+/.test(l);
  while (i < lines.length) {
    const line = lines[i]!;
    if (!line.trim()) {
      i++;
      continue;
    }
    const h = /^(#{1,6})\s+(.*)$/.exec(line);
    if (h) {
      blocks.push({ kind: 'heading', level: h[1]!.length, text: h[2]!.trim() });
      i++;
      continue;
    }
    if (/^(-{3,}|\*{3,})\s*$/.test(line)) {
      blocks.push({ kind: 'hr' });
      i++;
      continue;
    }
    if (line.startsWith('>')) {
      const buf: string[] = [];
      while (i < lines.length && lines[i]!.startsWith('>')) buf.push(lines[i++]!.replace(/^>\s?/, ''));
      blocks.push({ kind: 'quote', text: buf.join(' ') });
      continue;
    }
    if (line.trim().startsWith('|') && i + 1 < lines.length && /^\s*\|?[\s:|-]+\|?\s*$/.test(lines[i + 1]!)) {
      const head = cells(line);
      i += 2;
      const rows: string[][] = [];
      while (i < lines.length && lines[i]!.trim().startsWith('|')) rows.push(cells(lines[i++]!));
      blocks.push({ kind: 'table', head, rows });
      continue;
    }
    if (isListItem(line)) {
      const ordered = /^\s*\d+\./.test(line);
      const items: { text: string; children: string[] }[] = [];
      while (i < lines.length && (isListItem(lines[i]!) || (/^\s{2,}\S/.test(lines[i]!) && items.length))) {
        const l = lines[i]!;
        const m = /^(\s*)([-*]|\d+\.)\s+(.*)$/.exec(l);
        if (m && m[1]!.length === 0) {
          items.push({ text: m[3]!, children: [] });
        } else if (m) {
          items.at(-1)!.children.push(m[3]!);
        } else {
          const last = items.at(-1)!;
          if (last.children.length) last.children[last.children.length - 1] += ` ${l.trim()}`;
          else last.text += ` ${l.trim()}`;
        }
        i++;
      }
      blocks.push({ kind: 'list', ordered, items });
      continue;
    }
    const buf: string[] = [];
    while (
      i < lines.length &&
      lines[i]!.trim() &&
      !/^(#{1,6})\s/.test(lines[i]!) &&
      !lines[i]!.startsWith('>') &&
      !isListItem(lines[i]!) &&
      !lines[i]!.trim().startsWith('|') &&
      !/^(-{3,}|\*{3,})\s*$/.test(lines[i]!)
    ) {
      buf.push(lines[i++]!.trim());
    }
    blocks.push({ kind: 'paragraph', text: buf.join(' ') });
  }
  return blocks;
}

const INLINE = /(\*\*([^*]+)\*\*|\*([^*]+)\*|_([^_]+)_|`([^`]+)`|\[([^\]]+)\]\(([^)\s]+)\))/;

export function renderInline(text: string, keyPrefix = 'i'): ReactNode[] {
  const out: ReactNode[] = [];
  let rest = text;
  let n = 0;
  while (rest) {
    const m = INLINE.exec(rest);
    if (!m) {
      out.push(rest);
      break;
    }
    if (m.index > 0) out.push(rest.slice(0, m.index));
    const key = `${keyPrefix}-${n++}`;
    if (m[2] !== undefined) out.push(<strong key={key}>{renderInline(m[2], key)}</strong>);
    else if (m[3] !== undefined) out.push(<em key={key}>{renderInline(m[3], key)}</em>);
    else if (m[4] !== undefined) out.push(<em key={key}>{renderInline(m[4], key)}</em>);
    else if (m[5] !== undefined) out.push(<code key={key}>{m[5]}</code>);
    else if (m[6] !== undefined && m[7] !== undefined) {
      const href = m[7];
      const safe = /^(https?:|mailto:|\/|#)/.test(href);
      out.push(
        safe ? (
          <a key={key} href={href}>
            {renderInline(m[6], key)}
          </a>
        ) : (
          <span key={key}>{renderInline(m[6], key)}</span>
        ),
      );
    }
    rest = rest.slice(m.index + m[0].length);
  }
  return out;
}

export function Markdown({ source }: { source: string }) {
  const blocks = parseMarkdown(source);
  return (
    <>
      {blocks.map((b, idx) => {
        const key = `b${idx}`;
        switch (b.kind) {
          case 'heading': {
            const Tag = `h${Math.min(6, b.level)}` as 'h1';
            return (
              <Tag key={key} id={b.level > 1 ? slugify(b.text) : undefined}>
                {renderInline(b.text, key)}
              </Tag>
            );
          }
          case 'paragraph':
            return <p key={key}>{renderInline(b.text, key)}</p>;
          case 'quote':
            return (
              <blockquote key={key}>
                <p>{renderInline(b.text, key)}</p>
              </blockquote>
            );
          case 'hr':
            return <hr key={key} />;
          case 'table':
            return (
              <div key={key} className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      {b.head.map((c, j) => (
                        <th key={j} scope="col">
                          {renderInline(c, `${key}h${j}`)}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {b.rows.map((r, j) => (
                      <tr key={j}>
                        {r.map((c, k) => (
                          <td key={k}>{renderInline(c, `${key}r${j}c${k}`)}</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            );
          case 'list': {
            const List = b.ordered ? 'ol' : 'ul';
            return (
              <List key={key}>
                {b.items.map((it, j) => (
                  <li key={j}>
                    {renderInline(it.text, `${key}l${j}`)}
                    {it.children.length > 0 && (
                      <ul>
                        {it.children.map((c, k) => (
                          <li key={k}>{renderInline(c, `${key}l${j}c${k}`)}</li>
                        ))}
                      </ul>
                    )}
                  </li>
                ))}
              </List>
            );
          }
        }
      })}
    </>
  );
}
