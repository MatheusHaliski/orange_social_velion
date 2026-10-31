import { notFound } from 'next/navigation';
import { PostModal } from '@/components/post/PostModal';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Toque no card dentro do app: o post abre em modal por cima do feed (RF24); link direto abre a página. */
export default async function PostModalRoute({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!UUID.test(id)) notFound();
  return <PostModal id={id} />;
}
