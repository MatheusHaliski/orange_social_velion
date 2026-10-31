import type { Metadata } from 'next';
import { AuthBackdrop } from '@/components/auth/AuthBackdrop';
import { RegisterView } from '@/components/auth/RegisterView';

export const metadata: Metadata = { title: 'Criar conta' };

export default function CadastroPage() {
  return (
    <AuthBackdrop wide>
      <RegisterView />
    </AuthBackdrop>
  );
}
