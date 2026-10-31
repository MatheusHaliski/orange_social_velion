'use client';

import { isApiError, type PreferencesView } from '@orange-social/api';
import { QueryClient, QueryClientProvider, useQuery } from '@tanstack/react-query';
import { useEffect, useState, type ReactNode } from 'react';
import { api } from '@/lib/api';
import { applyAppBackground } from '@/lib/app-background';
import { applyFontScale } from '@/lib/font-scale';
import { PREFERENCES_KEY, SESSION_KEY, useSession } from '@/lib/queries';

export const SESSION_CHANNEL = 'os-sessao';

function makeClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        // 4xx não melhora repetindo (401, 404, 422); 5xx e rede tentam mais uma vez
        retry: (count, error) => !(isApiError(error) && error.status < 500) && count < 1,
        refetchOnWindowFocus: false,
      },
      mutations: { retry: false },
    },
  });
}

/** Avisa as outras abas que a sessão acabou (logout): elas passam a se ver deslogadas. */
export function broadcastLogout() {
  try {
    const ch = new BroadcastChannel(SESSION_CHANNEL);
    ch.postMessage('logout');
    ch.close();
  } catch {
    // navegador sem BroadcastChannel: a outra aba descobre no próximo 401
  }
}

/**
 * Preferências de exibição da conta que valem no app inteiro (RF2): o tamanho do texto e o fundo do app (liso, rede
 * ou mosaicos, com o véu por cima). Aplica ao carregar as preferências e de novo quando Configurações → Exibição
 * salva (o cache delas é atualizado); sem conta, volta ao padrão (liso).
 */
function AccountDisplay() {
  const session = useSession();
  const prefs = useQuery<PreferencesView>({
    queryKey: PREFERENCES_KEY,
    queryFn: () => api.me.preferences(),
    enabled: !!session.data,
    staleTime: 5 * 60_000,
  });
  const scale = session.data ? prefs.data?.fontScale : null;
  const background = session.data ? prefs.data?.appBackground : null;
  useEffect(() => {
    if (session.isPending || (session.data && prefs.isPending)) return;
    applyFontScale(scale);
    applyAppBackground(background ?? 'PLAIN');
  }, [scale, background, session.isPending, session.data, prefs.isPending]);
  return null;
}

export function Providers({ children }: { children: ReactNode }) {
  const [client] = useState(makeClient);
  useEffect(() => {
    if (typeof BroadcastChannel === 'undefined') return;
    const ch = new BroadcastChannel(SESSION_CHANNEL);
    ch.onmessage = (ev) => {
      if (ev.data === 'logout') {
        client.setQueryData(SESSION_KEY, null);
        void client.invalidateQueries();
      }
    };
    return () => ch.close();
  }, [client]);
  return (
    <QueryClientProvider client={client}>
      <AccountDisplay />
      {children}
    </QueryClientProvider>
  );
}
