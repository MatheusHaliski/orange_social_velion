'use client';

import { isApiError, type DeletionView } from '@orange-social/api';
import { useMutation } from '@tanstack/react-query';
import Link from 'next/link';
import { useId, useRef, useState, type FormEvent } from 'react';
import { Dialog } from '@/components/Dialog';
import { describedBy, ErrorSummary, FieldErrors, Notice, useDeferredFocus } from '@/components/Form';
import { IconDelete, IconInfo, IconLogout } from '@/components/icons';
import { api } from '@/lib/api';
import { mapSudoError } from '@/lib/field-errors';
import { formatDate } from '@/lib/format';
import { useSession } from '@/lib/queries';
import { useLeaveAccount } from '@/lib/use-leave';
import { SectionHeading } from './SectionHeading';
import { checkSudo, SudoFields, sudoBody, type SudoValues } from './SudoFields';

export const GRACE_DAYS = 30;

/** Data final da carência: hoje + 30 dias (a resposta da API confirma a data exata). */
export function deletionDate(now: Date = new Date()): Date {
  return new Date(now.getTime() + GRACE_DAYS * 24 * 60 * 60 * 1000);
}

/** Configurações → Conta (RF27 · RF23): sair e excluir a conta. */
export function AccountSection() {
  const uid = useId();
  const session = useSession();
  const leave = useLeaveAccount();
  const [open, setOpen] = useState(false);
  const [logoutError, setLogoutError] = useState<string | null>(null);
  const logout = useMutation({
    mutationFn: () => api.auth.logout(),
    onSuccess: () => leave('/'),
    onError: () => setLogoutError('Não foi possível sair agora. Tente de novo.'),
  });
  const user = session.data;
  if (!user) return null;

  return (
    <>
      <SectionHeading description="Sair deste aparelho ou excluir a conta.">Conta</SectionHeading>

      <section aria-labelledby={`${uid}-sair`} className="os-card grid gap-3 p-5">
        <h2 id={`${uid}-sair`} className="text-xl font-bold">
          Sair desta conta
        </h2>
        <p className="text-sm text-muted">
          Você está como <strong className="text-fg">@{user.handle}</strong>. Para sair dos outros aparelhos, use{' '}
          <Link href="/configuracoes/seguranca" className="font-semibold text-fg underline">
            Senha e segurança
          </Link>
          .
        </p>
        {logoutError && (
          <Notice tone="error" live>
            <p>{logoutError}</p>
          </Notice>
        )}
        <div>
          <button type="button" className="os-btn" onClick={() => logout.mutate()} disabled={logout.isPending}>
            <IconLogout size={18} />
            {logout.isPending ? 'Saindo…' : 'Sair'}
          </button>
        </div>
      </section>

      <section aria-labelledby={`${uid}-excluir`} className="os-card grid gap-3 p-5">
        <h2 id={`${uid}-excluir`} className="text-xl font-bold">
          Excluir conta
        </h2>
        <p>
          A conta fica oculta por {GRACE_DAYS} dias e depois é apagada. Nesse prazo, basta entrar de novo para reativar. <span className="os-law">Art. 18, VI — eliminação</span>
        </p>
        <div>
          <button type="button" className="os-btn" onClick={() => setOpen(true)}>
            <IconDelete size={18} />
            Excluir minha conta…
          </button>
        </div>
      </section>

      <DeleteAccountDialog open={open} onClose={() => setOpen(false)} withCode={user.mfaEnabled} onLeave={() => leave('/')} />
    </>
  );
}

type Errors = { fields: Record<string, string[]>; general: string[] };
const NONE: Errors = { fields: {}, general: [] };

/**
 * "Excluir sua conta?" (RF23): alertdialog com as consequências, a data final, a caixa "Entendo" e a confirmação de
 * identidade (senha e, com 2FA, o código). Depois do pedido a API encerra todas as sessões, inclusive esta.
 */
export function DeleteAccountDialog({
  open,
  onClose,
  withCode,
  onLeave,
}: {
  open: boolean;
  onClose: () => void;
  withCode: boolean;
  onLeave: () => void;
}) {
  const uid = useId();
  const cancelRef = useRef<HTMLButtonElement>(null);
  const [summaryRef, focusSummary] = useDeferredFocus<HTMLDivElement>();
  const [doneRef, focusDone] = useDeferredFocus<HTMLButtonElement>();
  const [understood, setUnderstood] = useState(false);
  const [sudo, setSudo] = useState<SudoValues>({ password: '', code: '' });
  const [errors, setErrors] = useState<Errors>(NONE);
  const [result, setResult] = useState<DeletionView | null>(null);
  const [until] = useState(() => deletionDate());

  const request = useMutation({
    mutationFn: () => api.me.requestDeletion({ ...sudoBody(sudo, withCode), confirm: true }),
    onSuccess: (view) => {
      setResult(view ?? { accountStatus: 'PENDING_DELETION', deletionScheduledFor: until.toISOString(), graceDays: GRACE_DAYS });
      // a API já encerrou todas as sessões; esta aba esquece a conta (e avisa as outras) quando o aviso fecha
      focusDone();
    },
    onError: (e) => {
      if (isApiError(e, 403)) setErrors(mapSudoError(e.detail, withCode));
      else if (isApiError(e, 422)) setErrors({ fields: {}, general: e.errors.length ? e.errors : [e.detail] });
      else setErrors({ fields: {}, general: [isApiError(e) ? e.detail : 'Não foi possível pedir a exclusão agora. Tente de novo.'] });
      focusSummary();
    },
  });

  function close() {
    if (result) {
      onLeave();
      return;
    }
    setUnderstood(false);
    setSudo({ password: '', code: '' });
    setErrors(NONE);
    onClose();
  }

  function submit(e: FormEvent) {
    e.preventDefault();
    const fields: Record<string, string[]> = { ...checkSudo(sudo, withCode) };
    if (!understood) fields.understood = ['Marque a caixa para confirmar que entendeu.'];
    if (Object.keys(fields).length) {
      setErrors({ fields, general: [] });
      focusSummary();
      return;
    }
    setErrors(NONE);
    request.mutate();
  }

  const titleId = `${uid}-titulo`;
  const whenId = `${uid}-quando`;
  const summary = [
    ...Object.entries(errors.fields).flatMap(([f, msgs]) => msgs.map((message) => ({ message, fieldId: `${uid}-${f}` }))),
    ...errors.general.map((message) => ({ message })),
  ];
  const finalDate = formatDate((result?.deletionScheduledFor ?? until.toISOString()) as string);

  return (
    <Dialog open={open} onClose={close} role="alertdialog" labelledBy={titleId} describedBy={whenId} initialFocus={cancelRef}>
      {result ? (
        <div className="grid gap-4">
          <h2 id={titleId} className="text-2xl font-extrabold">
            Pedido de exclusão registrado
          </h2>
          <div id={whenId} className="grid gap-2">
            <p>
              A sua conta será excluída em <strong>{finalDate}</strong>. Você saiu de todos os aparelhos.
            </p>
            <p>
              Mudou de ideia? Entre com o seu e-mail e senha antes dessa data e escolha <strong>Reativar minha conta</strong>.
            </p>
          </div>
          <div>
            <button ref={doneRef} type="button" className="os-btn os-btn-primary" onClick={onLeave}>
              Ir para o início
            </button>
          </div>
        </div>
      ) : (
        <form noValidate onSubmit={submit} className="grid gap-4">
          <h2 id={titleId} className="text-2xl font-extrabold">
            Excluir sua conta do Orange Social?
          </h2>
          <div id={whenId} className="rounded-md border-2 border-error p-3">
            <p>
              Sua conta será excluída em <strong>{GRACE_DAYS} dias</strong> (em <strong data-testid="data-exclusao">{finalDate}</strong>). Até lá ela fica
              oculta e você sai de todos os aparelhos.
            </p>
          </div>
          <p>
            <strong>Mudou de ideia?</strong> Entre com o seu e-mail e senha antes dessa data e escolha <strong>Reativar minha conta</strong>. Tudo volta
            como estava.
          </p>
          <div className="grid gap-1">
            <p className="font-bold">Durante os {GRACE_DAYS} dias:</p>
            <ul className="list-disc pl-5">
              <li>o seu perfil e os seus posts ficam ocultos para todo mundo;</li>
              <li>quem abrir um link seu vê que o conteúdo não está disponível.</li>
            </ul>
          </div>
          <div className="grid gap-1">
            <p className="font-bold">Depois do prazo, vamos apagar (não dá para recuperar):</p>
            <ul className="list-disc pl-5">
              <li>perfil, foto e configurações;</li>
              <li>publicações (com as fotos e as molduras), comentários, curtidas e salvos;</li>
              <li>verificação em duas etapas, códigos de recuperação e preferências.</li>
            </ul>
          </div>
          <div className="grid gap-1">
            <p className="font-bold">O que continua existindo:</p>
            <ul className="list-disc pl-5">
              <li>comentários que você deixou em posts de outras pessoas aparecem como “Conta excluída”, sem o texto;</li>
              <li>registros de acesso (data, hora e IP) por 6 meses, em sigilo — Marco Civil da Internet, art. 15.</li>
            </ul>
          </div>
          <p className="flex items-start gap-1.5 text-sm text-muted">
            <IconInfo size={16} className="mt-0.5 flex-none" />
            Exportar uma cópia dos seus dados ainda não está disponível pelo app; peça pelo suporte antes de excluir.
          </p>

          <ErrorSummary ref={summaryRef} items={summary} />

          <div className="grid gap-1">
            <div className="flex items-start gap-2">
              <input
                id={`${uid}-understood`}
                type="checkbox"
                className="mt-0.5 size-6 flex-none"
                checked={understood}
                onChange={(e) => setUnderstood(e.target.checked)}
                aria-invalid={errors.fields.understood ? true : undefined}
                aria-describedby={describedBy(errors.fields.understood && `${uid}-understood-erro`)}
              />
              <label htmlFor={`${uid}-understood`} className="font-semibold">
                Entendo que, passados {GRACE_DAYS} dias, a exclusão é definitiva.
              </label>
            </div>
            <div className="pl-8">
              <FieldErrors id={`${uid}-understood-erro`} errors={errors.fields.understood} />
            </div>
          </div>

          <SudoFields idPrefix={uid} values={sudo} onChange={setSudo} withCode={withCode} errors={errors.fields} passwordLabel="Senha" />

          <div className="flex flex-wrap justify-end gap-2">
            <button ref={cancelRef} type="button" className="os-btn" onClick={close}>
              Cancelar
            </button>
            <button type="submit" className="os-btn os-btn-primary" disabled={request.isPending}>
              <IconDelete size={18} />
              {request.isPending ? 'Excluindo…' : 'Excluir minha conta'}
            </button>
          </div>
        </form>
      )}
    </Dialog>
  );
}
