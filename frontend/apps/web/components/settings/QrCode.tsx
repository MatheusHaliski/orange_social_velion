'use client';

import { create } from 'qrcode';
import { useMemo } from 'react';

const QUIET = 4;

/** Caminho SVG dos módulos escuros do QR code, com a margem de 4 módulos que os leitores pedem. */
export function qrPath(value: string): { size: number; d: string } {
  const qr = create(value, { errorCorrectionLevel: 'M' });
  const n = qr.modules.size;
  let d = '';
  for (let r = 0; r < n; r++) {
    for (let c = 0; c < n; c++) {
      if (qr.modules.get(r, c)) d += `M${c + QUIET} ${r + QUIET}h1v1h-1z`;
    }
  }
  return { size: n + QUIET * 2, d };
}

/**
 * QR code gerado no navegador (a chave do 2FA nunca sai para um serviço de terceiros). Escuro sobre claro nos dois
 * temas; quem não pode ler o QR digita a chave mostrada ao lado.
 */
export function QrCode({ value, label }: { value: string; label: string }) {
  const { size, d } = useMemo(() => qrPath(value), [value]);
  return (
    <svg role="img" aria-label={label} viewBox={`0 0 ${size} ${size}`} className="os-qr" shapeRendering="crispEdges" data-testid="qr-code">
      <path d={d} fill="currentColor" />
    </svg>
  );
}
