'use client';

import { useId, useState } from 'react';
import { Notice } from '@/components/Form';
import { IconCopy, IconDownload } from '@/components/icons';
import { formatDate } from '@/lib/format';

export const RECOVERY_FILE_NAME = 'orange-social-codigos-de-recuperacao.txt';

/** Texto do .txt: cabeçalho, data e um código por linha. */
export function recoveryCodesText(codes: string[], generatedAt: string, account?: string): string {
  return [
    'Orange Social · códigos de recuperação da verificação em duas etapas',
    account ? `Conta: ${account}` : null,
    `Gerados em: ${formatDate(generatedAt)}`,
    'Cada código vale um login. Guarde em lugar seguro; gerar novos códigos invalida estes.',
    '',
    ...codes,
    '',
  ]
    .filter((l) => l !== null)
    .join('\n');
}

interface RecoveryCodesProps {
  codes: string[];
  generatedAt: string;
  account?: string;
  onDone: () => void;
}

/**
 * Os 10 códigos de recuperação, mostrados uma única vez: copiar, baixar como .txt e só então concluir. Depois de
 * concluir, a tela não tem mais como mostrá-los (a API guarda só o hash).
 */
export function RecoveryCodes({ codes, generatedAt, account, onDone }: RecoveryCodesProps) {
  const uid = useId();
  const [saved, setSaved] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const text = recoveryCodesText(codes, generatedAt, account);

  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
      setStatus('Códigos copiados.');
    } catch {
      setStatus('Não deu para copiar automaticamente. Selecione os códigos e copie, ou baixe o arquivo.');
    }
  }

  function download() {
    const url = URL.createObjectURL(new Blob([text], { type: 'text/plain;charset=utf-8' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = RECOVERY_FILE_NAME;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 0);
    setStatus(`Arquivo ${RECOVERY_FILE_NAME} baixado.`);
  }

  return (
    <div className="grid gap-4" data-testid="codigos-recuperacao">
      <Notice>
        <p className="font-semibold">Guarde estes códigos agora: eles aparecem uma única vez.</p>
        <p>Se perder o celular, cada código vale um login no lugar do código do app.</p>
      </Notice>
      <ol aria-label="Códigos de recuperação" className="grid grid-cols-2 gap-x-6 gap-y-1 rounded-md border border-line-strong p-4 font-mono text-lg sm:w-fit">
        {codes.map((c) => (
          <li key={c}>{c}</li>
        ))}
      </ol>
      <div className="flex flex-wrap gap-2">
        <button type="button" className="os-btn" onClick={copy}>
          <IconCopy size={18} />
          Copiar códigos
        </button>
        <button type="button" className="os-btn" onClick={download}>
          <IconDownload size={18} />
          Baixar .txt
        </button>
      </div>
      <p role="status" className="text-sm font-semibold">
        {status}
      </p>
      <div className="flex min-h-11 items-start gap-2">
        <input id={`${uid}-guardei`} type="checkbox" className="mt-0.5 size-6 flex-none" checked={saved} onChange={(e) => setSaved(e.target.checked)} />
        <label htmlFor={`${uid}-guardei`} className="font-semibold">
          Guardei os códigos em lugar seguro
        </label>
      </div>
      <div>
        <button type="button" className="os-btn os-btn-primary" onClick={onDone} disabled={!saved}>
          Concluir
        </button>
      </div>
    </div>
  );
}
