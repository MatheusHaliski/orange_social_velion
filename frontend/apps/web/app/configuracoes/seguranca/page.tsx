import type { Metadata } from 'next';
import { SecuritySection } from '@/components/settings/SecuritySection';

export const metadata: Metadata = { title: 'Senha e segurança · Configurações' };

export default function Page() {
  return <SecuritySection />;
}
