import type { Metadata } from 'next';
import { PublishView } from '@/components/publish/PublishView';

export const metadata: Metadata = { title: 'Publicar' };

export default function PublicarPage() {
  return <PublishView />;
}
