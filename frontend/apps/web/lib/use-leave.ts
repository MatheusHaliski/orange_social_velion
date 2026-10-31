'use client';

import { useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { useCallback } from 'react';
import { broadcastLogout } from '@/components/Providers';
import { markLeaving, SESSION_KEY } from './queries';

/**
 * Depois de sair (logout) ou de pedir a exclusão (RF23, a API já encerrou todas as sessões): esquece os dados da
 * conta neste navegador, avisa as outras abas e vai para {@code to} sem passar pelo login.
 */
export function useLeaveAccount() {
  const router = useRouter();
  const queryClient = useQueryClient();
  return useCallback(
    (to = '/') => {
      markLeaving();
      router.push(to);
      queryClient.setQueryData(SESSION_KEY, null);
      queryClient.removeQueries({ predicate: (q) => q.queryKey[0] !== SESSION_KEY[0] });
      broadcastLogout();
    },
    [router, queryClient],
  );
}
