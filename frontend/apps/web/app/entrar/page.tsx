import type { Metadata } from 'next';
import { Suspense } from 'react';
import { AuthBackdrop } from '@/components/auth/AuthBackdrop';
import { LoginView } from '@/components/auth/LoginView';

export const metadata: Metadata = { title: 'Entrar' };

export default function EntrarPage() {
  return (
    <AuthBackdrop>
      <Suspense fallback={<p>Carregando…</p>}>
        <LoginView />
      </Suspense>
    </AuthBackdrop>
  );
}
