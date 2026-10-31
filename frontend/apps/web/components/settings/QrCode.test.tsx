import { render, screen } from '@testing-library/react';
import { create } from 'qrcode';
import { describe, expect, it } from 'vitest';
import { groupSecret } from './MfaPanel';
import { QrCode, qrPath } from './QrCode';

const URI = 'otpauth://totp/Orange%20Social:julia%40example.com?secret=JBSWY3DPEHPK3PXP&issuer=Orange%20Social&algorithm=SHA1&digits=6&period=30';

describe('QrCode', () => {
  it('imagem com nome acessível, gerada no navegador', () => {
    render(<QrCode value={URI} label="QR code para o app autenticador" />);
    const img = screen.getByRole('img', { name: 'QR code para o app autenticador' });
    expect(img.tagName.toLowerCase()).toBe('svg');
    expect(img.querySelector('path')!.getAttribute('d')!.length).toBeGreaterThan(100);
  });

  it('um quadrado por módulo escuro, com a margem de 4 módulos', () => {
    const qr = create(URI, { errorCorrectionLevel: 'M' });
    const n = qr.modules.size;
    let dark = 0;
    for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) if (qr.modules.get(r, c)) dark++;
    const { size, d } = qrPath(URI);
    expect(size).toBe(n + 8);
    expect(d.match(/M/g)).toHaveLength(dark);
    // canto do padrão de posição (sempre escuro) começa depois da margem
    expect(d.startsWith('M4 4h1v1h-1z')).toBe(true);
  });

  it('mesma entrada, mesmo desenho; entradas diferentes, desenhos diferentes', () => {
    expect(qrPath(URI)).toEqual(qrPath(URI));
    expect(qrPath(URI).d).not.toBe(qrPath(URI.replace('JBSW', 'KBSW')).d);
  });

  it('a chave aparece em grupos de 4 para digitar', () => {
    expect(groupSecret('JBSWY3DPEHPK3PXP')).toBe('JBSW Y3DP EHPK 3PXP');
    expect(groupSecret('ABCDEF')).toBe('ABCD EF');
  });
});
