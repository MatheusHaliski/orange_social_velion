import type { Metadata } from 'next';
import { SettingsIndex } from '@/components/settings/SettingsIndex';

export const metadata: Metadata = { title: 'Configurações' };

export default function ConfiguracoesPage() {
  return <SettingsIndex />;
}
