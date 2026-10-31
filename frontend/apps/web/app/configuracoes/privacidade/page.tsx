import type { Metadata } from 'next';
import { PrivacySection } from '@/components/settings/PrivacySection';

export const metadata: Metadata = { title: 'Privacidade · Configurações' };

export default function Page() {
  return <PrivacySection />;
}
