import type { Metadata } from 'next';
import { Suspense } from 'react';
import { FeedView } from '@/components/feed/FeedView';

export const metadata: Metadata = { title: { absolute: 'Orange Social' } };

export default function HomePage() {
  return (
    <Suspense fallback={<p>Carregando…</p>}>
      <FeedView />
    </Suspense>
  );
}
