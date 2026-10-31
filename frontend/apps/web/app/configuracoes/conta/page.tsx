import type { Metadata } from 'next';
import { AccountSection } from '@/components/settings/AccountSection';

export const metadata: Metadata = { title: 'Conta · Configurações' };

export default function Page() {
  return <AccountSection />;
}
