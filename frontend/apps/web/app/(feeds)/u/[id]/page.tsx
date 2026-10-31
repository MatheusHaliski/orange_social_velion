import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { ProfileView } from '@/components/profile/ProfileView';

export const metadata: Metadata = { title: 'Perfil' };

export default async function PerfilPublicoPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^\d{1,18}$/.test(id)) notFound();
  return <ProfileView id={id} />;
}
