import { notFound, redirect } from 'next/navigation';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Link público do post ({public-base-url}/p/{id}, RF26) → página do post. */
export default async function ShortPostLink({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!UUID.test(id)) notFound();
  redirect(`/posts/${id}`);
}
