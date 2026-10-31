import { readFile } from 'node:fs/promises';
import path from 'node:path';
import type { Metadata } from 'next';
import { Markdown } from '@/lib/markdown';

export const metadata: Metadata = { title: 'Termos de Uso' };

// Gerada no build a partir do texto versionado no repositório (docs/legal/TERMOS_DE_USO.md).
export const dynamic = 'force-static';

const TERMS_PATH = path.join(process.cwd(), '..', '..', '..', 'docs', 'legal', 'TERMOS_DE_USO.md');

export default async function TermosPage() {
  const source = await readFile(TERMS_PATH, 'utf8');
  return (
    <article className="os-prose">
      <Markdown source={source} />
    </article>
  );
}
