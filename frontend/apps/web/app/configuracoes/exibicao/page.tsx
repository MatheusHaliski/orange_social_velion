import type { Metadata } from 'next';
import { DisplaySection } from '@/components/settings/DisplaySection';

export const metadata: Metadata = { title: 'Exibição · Configurações' };

export default function Page() {
  return <DisplaySection />;
}
