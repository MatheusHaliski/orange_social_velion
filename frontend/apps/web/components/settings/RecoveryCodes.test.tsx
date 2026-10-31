import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { RECOVERY_FILE_NAME, RecoveryCodes, recoveryCodesText } from './RecoveryCodes';

const codes = ['abcde-fghjk', '23456-789ab', 'mnpqr-stvwx'];

afterEach(() => vi.restoreAllMocks());

describe('RecoveryCodes', () => {
  it('mostra os códigos uma vez, em lista, com o aviso', () => {
    render(<RecoveryCodes codes={codes} generatedAt="2026-10-25T13:00:00Z" onDone={() => {}} />);
    expect(screen.getByText(/aparecem uma única vez/)).toBeInTheDocument();
    const items = screen.getByRole('list', { name: 'Códigos de recuperação' }).querySelectorAll('li');
    expect([...items].map((li) => li.textContent)).toEqual(codes);
  });

  it('copiar põe o texto com os códigos na área de transferência', async () => {
    const user = userEvent.setup();
    const writeText = vi.spyOn(navigator.clipboard, 'writeText').mockResolvedValue();
    render(<RecoveryCodes codes={codes} generatedAt="2026-10-25T13:00:00Z" account="julia@example.com" onDone={() => {}} />);
    await user.click(screen.getByRole('button', { name: 'Copiar códigos' }));
    expect(writeText).toHaveBeenCalledWith(recoveryCodesText(codes, '2026-10-25T13:00:00Z', 'julia@example.com'));
    expect(screen.getByRole('status')).toHaveTextContent('Códigos copiados.');
  });

  it('baixar gera um .txt', async () => {
    const created: Blob[] = [];
    URL.createObjectURL = vi.fn((b: Blob) => {
      created.push(b);
      return 'blob:codigos';
    });
    URL.revokeObjectURL = vi.fn();
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) {
      expect(this.download).toBe(RECOVERY_FILE_NAME);
      expect(this.href).toBe('blob:codigos');
    });
    render(<RecoveryCodes codes={codes} generatedAt="2026-10-25T13:00:00Z" onDone={() => {}} />);
    await userEvent.click(screen.getByRole('button', { name: 'Baixar .txt' }));
    expect(click).toHaveBeenCalledTimes(1);
    expect(created[0]!.type).toBe('text/plain;charset=utf-8');
    expect(await created[0]!.text()).toContain('mnpqr-stvwx');
  });

  it('concluir só depois de marcar que guardou', async () => {
    const onDone = vi.fn();
    render(<RecoveryCodes codes={codes} generatedAt="2026-10-25T13:00:00Z" onDone={onDone} />);
    const done = screen.getByRole('button', { name: 'Concluir' });
    expect(done).toBeDisabled();
    await userEvent.click(screen.getByLabelText('Guardei os códigos em lugar seguro'));
    await userEvent.click(done);
    expect(onDone).toHaveBeenCalled();
  });

  it('o texto do arquivo tem cabeçalho e um código por linha', () => {
    const text = recoveryCodesText(codes, '2026-10-25T13:00:00Z', 'julia@example.com');
    expect(text).toMatch(/^Orange Social · códigos de recuperação/);
    expect(text).toContain('Conta: julia@example.com');
    expect(text).toContain('Gerados em: 25 de outubro de 2026');
    expect(text.trim().split('\n').slice(-3)).toEqual(codes);
  });
});
