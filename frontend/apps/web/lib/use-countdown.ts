'use client';

import { useEffect, useState } from 'react';

/** Contagem regressiva em segundos (Retry-After do 429). */
export function useCountdown(): [number, (seconds: number) => void] {
  const [until, setUntil] = useState<number | null>(null);
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (until === null) return;
    const t = window.setInterval(() => {
      const n = Date.now();
      setNow(n);
      if (n >= until) {
        setUntil(null);
        window.clearInterval(t);
      }
    }, 1000);
    return () => window.clearInterval(t);
  }, [until]);
  const left = until === null ? 0 : Math.max(0, Math.ceil((until - now) / 1000));
  const start = (seconds: number) => {
    const n = Date.now();
    setNow(n);
    setUntil(n + seconds * 1000);
  };
  return [left, start];
}

export function waitText(seconds: number): string {
  if (seconds < 60) return `${seconds} ${seconds === 1 ? 'segundo' : 'segundos'}`;
  const m = Math.ceil(seconds / 60);
  return `${m} ${m === 1 ? 'minuto' : 'minutos'}`;
}
