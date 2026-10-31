import type { Metadata } from 'next';
import { VerifyEmailView } from '@/components/auth/VerifyEmailView';

export const metadata: Metadata = { title: 'Confirmar e-mail' };

export default function ConfirmarEmailPage() {
  return <VerifyEmailView />;
}
