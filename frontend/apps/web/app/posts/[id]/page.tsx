import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { PostPage } from '@/components/post/PostPage';

export const metadata: Metadata = { title: 'Post' };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function PostRoute({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!UUID.test(id)) notFound();
  return <PostPage id={id} />;
}
