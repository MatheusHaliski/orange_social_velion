import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { PublishView } from '@/components/publish/PublishView';

export const metadata: Metadata = { title: 'Editar post' };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function EditarPostPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!UUID.test(id)) notFound();
  return <PublishView editId={id} />;
}
