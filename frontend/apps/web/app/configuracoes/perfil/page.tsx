import type { Metadata } from 'next';
import { ProfileSection } from '@/components/settings/ProfileSection';

export const metadata: Metadata = { title: 'Perfil · Configurações' };

export default function Page() {
  return <ProfileSection />;
}
