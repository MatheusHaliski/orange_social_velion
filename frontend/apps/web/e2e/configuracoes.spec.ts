import { fileURLToPath } from 'node:url';
import { CODIGO_2FA, fixture, problem, SENHA_CERTA, UPLOADS_BUCKET } from './support/mock-api';
import { expect, expectAccessibleInBothThemes, test } from './support/test';

const AVATAR = fileURLToPath(new URL('./fixtures/avatar.png', import.meta.url));
const SECOES = ['perfil', 'exibicao', 'privacidade', 'seguranca', 'conta'] as const;

test.describe('Configurações: casca', () => {
  test('sem sessão, cada seção vai para o login com voltar', async ({ page }) => {
    await page.goto('/configuracoes/perfil');
    await expect(page).toHaveURL(/\/entrar\?voltar=%2Fconfiguracoes%2Fperfil$/);
    await page.goto('/configuracoes');
    await expect(page).toHaveURL(/\/entrar\?voltar=%2Fconfiguracoes$/);
  });

  test('cabeçalho leva às Configurações; lista, menu lateral e foco no título da seção', async ({ page, api }) => {
    api.login();
    await page.goto('/');
    await page.getByTestId('link-configuracoes').click();
    await expect(page).toHaveURL(/\/configuracoes$/);
    await expect(page.getByRole('heading', { level: 1, name: 'Configurações' })).toBeFocused();
    const lista = page.getByRole('main').getByRole('navigation', { name: 'Seções das configurações' });
    await expect(lista.getByRole('link')).toHaveText([/^Perfil/, /^Exibição/, /^Privacidade/, /^Senha e segurança/, /^Conta/]);
    await expectAccessibleInBothThemes(page, 'Configurações (lista)');

    await lista.getByRole('link', { name: /^Privacidade/ }).click();
    await expect(page).toHaveURL(/\/configuracoes\/privacidade$/);
    await expect(page.getByRole('heading', { level: 1, name: 'Privacidade' })).toBeFocused();
    const menu = page.getByRole('navigation', { name: 'Seções das configurações' });
    await expect(menu.getByRole('link', { name: 'Privacidade' })).toHaveAttribute('aria-current', 'page');
    await menu.getByRole('link', { name: 'Senha e segurança' }).click();
    await expect(page.getByRole('heading', { level: 1, name: 'Senha e segurança' })).toBeFocused();
  });

  test('celular: a lista é o menu e cada seção tem "voltar"', async ({ page, api }) => {
    api.login();
    await page.setViewportSize({ width: 360, height: 780 });
    await page.goto('/configuracoes');
    await page.getByRole('link', { name: /^Exibição/ }).click();
    await expect(page.getByRole('heading', { level: 1, name: 'Exibição' })).toBeVisible();
    await expect(page.getByRole('navigation', { name: 'Seções das configurações' })).toBeHidden();
  
  for (const secao of SECOES) {
      await page.goto(`/configuracoes/${secao}`);
      await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
      await page.waitForLoadState('networkidle');
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      expect(overflow, `rolagem horizontal em ${secao}`).toBeLessThanOrEqual(0);
    }
    await page.getByRole('link', { name: 'Configurações', exact: true }).first().click();
    await expect(page).toHaveURL(/\/configuracoes$/);
  });

  for (const secao of SECOES) {
    test(`axe sem violações graves: ${secao}`, async ({ page, api }) => {
      api.login();
      await page.goto(`/configuracoes/${secao}`);
      await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
      await page.waitForLoadState('networkidle');
      await expect(page.getByText('Carregando…')).toHaveCount(0);
      await expectAccessibleInBothThemes(page, `Configurações → ${secao}`);
    });
  }
});

test.describe('Perfil (RF2)', () => {
  test('trocar a foto: URL pré-assinada, PUT direto no bucket e PUT /me/photo; remover volta às iniciais', async ({ page, api }) => {
    api.login();
    await page.goto('/configuracoes/perfil');
    await expect(page.getByRole('img', { name: 'Sua foto de perfil' })).toBeVisible();
    await page.getByRole('button', { name: 'Remover foto' }).click();
    await expect(page.getByTestId('iniciais')).toContainText('AR');
    await page.getByLabel('Escolher foto').setInputFiles(AVATAR);
    await expect(page.getByRole('status').filter({ hasText: 'Foto atualizada.' })).toBeVisible();
    await expect(page.getByRole('img', { name: 'Sua foto de perfil' })).toBeVisible();
    await expect.poll(() => page.getByRole('img', { name: 'Sua foto de perfil' }).evaluate((img: HTMLImageElement) => img.naturalWidth)).toBe(128);

    const ticket = api.last('POST', /\/media\/uploads$/)!;
    expect(ticket.body).toEqual({ kind: 'IMAGE', contentType: 'image/png', sizeBytes: 474 });
    expect(ticket.headers['x-xsrf-token']).toMatch(/^csrf-/);
    const put = api.account.bucketPuts[0]!;
    expect(put.method).toBe('PUT');
    expect(put.url).toContain('X-Amz-Signature=teste');
    // o original vai ao bucket privado de uploads, nunca ao público de mídias (PR #13)
    expect(new URL(put.url).pathname).toBe(`/${UPLOADS_BUCKET}/uploads/42/01991.png`);
    expect(put.headers['content-type']).toBe('image/png');
    expect(put.headers['x-xsrf-token']).toBeUndefined();
    expect(put.headers.cookie).toBeUndefined();
    expect(put.size).toBe(474);
    expect(api.last('PUT', /\/me\/photo$/)!.body).toEqual({ objectKey: 'uploads/42/01991.png' });

    await page.getByRole('button', { name: 'Remover foto' }).click();
    await expect(page.getByRole('status').filter({ hasText: 'Foto removida' })).toBeVisible();
    await expect(page.getByTestId('iniciais')).toBeVisible();
    expect(api.find('DELETE', /\/me\/photo$/)).toHaveLength(2);
  });

  test('foto em formato errado: erro no campo, sem pedir URL', async ({ page, api }) => {
    api.login();
    await page.goto('/configuracoes/perfil');
    await page.getByLabel('Trocar foto').setInputFiles({ name: 'eu.gif', mimeType: 'image/gif', buffer: Buffer.from('GIF89a') });
    await expect(page.getByLabel('Trocar foto')).toHaveAccessibleDescription(/Envie a foto em JPEG ou PNG\./);
    expect(api.find('POST', /\/media\/uploads$/)).toHaveLength(0);
  });

  test('salva só o que mudou; 422 e 409 aparecem no campo', async ({ page, api }) => {
    api.login();
    await page.goto('/configuracoes/perfil');
    await page.getByLabel('Bio').fill('Pedalo pela cidade e fotografo o pôr do sol.');
    await expect(page.getByText('44 de 150 caracteres')).toBeVisible();
    await page.getByLabel('Gênero').fill('mulher');
    await page.getByRole('button', { name: 'Salvar perfil' }).click();
    await expect(page.getByRole('status').filter({ hasText: 'Perfil salvo.' })).toBeVisible();
    expect(api.last('PATCH', /\/me\/profile$/)!.body).toEqual({ bio: 'Pedalo pela cidade e fotografo o pôr do sol.', gender: 'mulher' });

    await page.getByLabel('@usuário').fill('emuso');
    await page.getByRole('button', { name: 'Salvar perfil' }).click();
    await expect(page.getByTestId('error-summary')).toBeFocused();
    await expect(page.getByLabel('@usuário')).toHaveAccessibleDescription(/Esse @usuário já está em uso\. Tente outro\./);

    api.on('PATCH', /\/me\/profile$/, problem(422, 'Revise os campos.', { errors: ['Celular no formato internacional, ex.: +5541999990000.', 'A bio tem no máximo 150 caracteres.'] }));
    await page.getByLabel('@usuário').fill('ana.ribeiro');
    await page.getByRole('button', { name: 'Salvar perfil' }).click();
    await expect(page.getByLabel('Celular')).toHaveAccessibleDescription(/Celular no formato internacional/);
    await expect(page.getByLabel('Bio')).toHaveAttribute('aria-invalid', 'true');
    await page.getByTestId('error-summary').getByRole('link', { name: 'A bio tem no máximo 150 caracteres.' }).click();
    await expect(page.getByLabel('Bio')).toBeFocused();
  });

  test('dados da categoria: o subtipo Evento do PRETO pede nome, início e local', async ({ page, api }) => {
    api.login({ categoryCode: 'PRETO' });
    await page.goto('/configuracoes/perfil');
    await page.getByLabel('Subtipo').selectOption('EVENT');
    await page.getByLabel('Organizador ou conta responsável').fill('Coletivo Primavera');
    await page.getByRole('button', { name: 'Salvar perfil' }).click();
    await expect(page.getByLabel('Nome do evento')).toHaveAttribute('aria-invalid', 'true');
    await page.getByLabel('Nome do evento').fill('Festival Primavera');
    await page.getByLabel('Início do evento').fill('2026-12-05T19:00');
    await page.getByLabel('Local do evento').fill('Pedreira Paulo Leminski');
    await page.getByRole('button', { name: 'Salvar perfil' }).click();
    await expect(page.getByRole('status').filter({ hasText: 'Perfil salvo.' })).toBeVisible();
    const body = api.last('PATCH', /\/me\/profile$/)!.body as { typeDetails: Record<string, string> };
    expect(body.typeDetails).toMatchObject({ subtype: 'EVENT', organizer: 'Coletivo Primavera', eventName: 'Festival Primavera' });
    expect(body.typeDetails.eventStart).toMatch(/^2026-12-05T\d{2}:00:00Z$/);
  });
});

test.describe('Exibição (RF2)', () => {
  test('tema ligado ao app, fonte e notificações', async ({ page, api }) => {
    api.login();
    await page.emulateMedia({ colorScheme: 'light' });
    await page.goto('/configuracoes/exibicao');
    await page.getByRole('radio', { name: 'Escuro' }).check();
    await page.getByLabel('Tamanho do texto').fill('120');
    await expect(page.getByTestId('tamanho-fonte')).toHaveText('120%');
    await page.getByRole('radio', { name: 'Alertas' }).check();
    await page.getByLabel('Alertas oficiais').uncheck();
    await page.getByRole('button', { name: 'Salvar exibição' }).click();
    await expect(page.getByRole('status').filter({ hasText: 'Exibição salva.' })).toBeVisible();
    expect(api.last('PATCH', /\/me\/preferences$/)!.body).toMatchObject({
      theme: 'DARK',
      fontScale: 120,
      defaultFeed: 'ALERT',
      notifications: { likes: true, comments: true, shares: true, officialAlerts: false },
    });
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
    // o tamanho do texto vale no app inteiro, também depois de recarregar
    await expect(page.locator('html')).toHaveAttribute('style', /font-size: 120%/);
    await expect(page.getByTestId('alternar-tema')).toHaveAttribute('aria-pressed', 'true');
    expect(await page.evaluate(() => localStorage.getItem('os:tema'))).toBe('dark');

    await page.getByRole('radio', { name: 'Sistema' }).check();
    await page.getByRole('button', { name: 'Salvar exibição' }).click();
    await expect(page.locator('html')).not.toHaveAttribute('data-theme');
    expect(await page.evaluate(() => localStorage.getItem('os:tema'))).toBeNull();
  });

  test('fundo do app: 8 miniaturas, aparece na hora e vale no app depois de salvar', async ({ page, api }) => {
    api.login();
    await page.goto('/configuracoes/exibicao');
    const fundos = page.getByTestId('fundos').getByRole('radio');
    await expect(fundos).toHaveCount(8);
    await expect(page.getByRole('radio', { name: 'Liso' })).toBeChecked();
    await page.getByRole('radio', { name: 'Areia' }).check();
    await expect(page.locator('html')).toHaveAttribute('data-app-bg', 'MOSAIC_SAND');
    await expectAccessibleInBothThemes(page, 'Exibição com fundo Areia');
    await page.getByRole('button', { name: 'Salvar exibição' }).click();
    await expect(page.getByRole('status').filter({ hasText: 'Exibição salva.' })).toBeVisible();
    expect(api.last('PATCH', /\/me\/preferences$/)!.body).toMatchObject({ appBackground: 'MOSAIC_SAND' });
    await page.getByTestId('logo').click();
    await expect(page.locator('html')).toHaveAttribute('data-app-bg', 'MOSAIC_SAND');
    const bg = await page.evaluate(() => getComputedStyle(document.body).backgroundImage);
    expect(bg).toContain('mosaico-areia.webp');
    expect(bg).toContain('linear-gradient');
  });

  test('fundo escolhido e não salvo volta ao guardado ao sair', async ({ page, api }) => {
    api.login();
    await page.goto('/configuracoes/exibicao');
    await page.getByRole('radio', { name: 'Rede Orange' }).check();
    await expect(page.locator('html')).toHaveAttribute('data-app-bg', 'NETWORK');
    await page.getByRole('navigation', { name: 'Seções das configurações' }).getByRole('link', { name: 'Perfil' }).click();
    await expect(page.locator('html')).not.toHaveAttribute('data-app-bg');
  });
});

test.describe('Menor de 16 (RF2, RF3)', () => {
  test('proteções travadas e o aviso de que só o responsável altera', async ({ page, api }) => {
    api.login({ minor: true });
    await page.goto('/configuracoes/privacidade');
    await expect(page.getByTestId('aviso-menor')).toContainText('só o responsável pode alterá-las');
    await expect(page.getByLabel('Perfil privado')).toBeChecked();
    await expect(page.getByLabel('Perfil privado')).toBeDisabled();
    await expect(page.getByRole('radio', { name: /Todo mundo/ })).toBeDisabled();
    await expect(page.getByRole('radio', { name: /Mostrar tudo/ })).toBeDisabled();
    const local = page.getByRole('switch', { name: 'Guardar minha localização' });
    await expect(local).toBeDisabled();
    await expect(local).toHaveAccessibleDescription(/Disponível a partir dos 16 anos/);
    await expect(page.getByRole('switch', { name: 'Orientação sexual no perfil' })).toHaveAccessibleDescription(/Disponível a partir dos 18 anos/);
    await expect(page.getByRole('switch', { name: 'Reconhecimento facial no aparelho' })).toHaveAccessibleDescription(/Disponível a partir dos 18 anos/);
    await expect(page.getByRole('switch', { name: 'Compartilhar com parceiros' })).toBeEnabled();
    await expectAccessibleInBothThemes(page, 'Privacidade (menor)');

    await page.goto('/configuracoes/exibicao');
    await expect(page.getByTestId('aviso-menor')).toBeVisible();
    await expect(page.getByLabel('Lembrete de tempo de uso')).toBeDisabled();
    await expect(page.getByLabel('Lembrete de tempo de uso')).toHaveAccessibleDescription(/só o responsável altera/);
  });
});

test.describe('Senha e segurança (RF27)', () => {
  test('ativar o 2FA de ponta a ponta: senha, QR, código e códigos de recuperação uma vez', async ({ page, api, context }) => {
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);
    api.login();
    await page.goto('/configuracoes/seguranca');
    const painel = page.getByTestId('painel-2fa');
    await expect(painel.getByTestId('status-2fa')).toHaveText('Desativada');
    await painel.getByRole('button', { name: 'Ativar' }).click();
    await expect(painel.getByRole('heading', { name: 'Ativar a verificação em duas etapas' })).toBeFocused();

    await painel.getByLabel('Senha atual').fill('errada');
    await painel.getByRole('button', { name: 'Continuar' }).click();
    await expect(painel.getByLabel('Senha atual')).toHaveAccessibleDescription('Senha incorreta.');
    await painel.getByLabel('Senha atual').fill(SENHA_CERTA);
    await painel.getByRole('button', { name: 'Continuar' }).click();
    expect(api.last('POST', /\/mfa\/totp$/)!.body).toEqual({ password: SENHA_CERTA, code: null });

    await expect(painel.getByRole('heading', { name: 'Leia o QR code no app autenticador' })).toBeFocused();
    await expect(painel.getByRole('img', { name: /QR code para adicionar Orange Social \(ana@example\.com\)/ })).toBeVisible();
    await expect(painel.getByTestId('chave-2fa')).toHaveText('JBSW Y3DP EHPK 3PXP JBSW Y3DP EHPK 3PXP');
    await painel.getByLabel('Código de 6 dígitos').fill('000000');
    await painel.getByRole('button', { name: 'Confirmar e ativar' }).click();
    await expect(painel.getByLabel('Código de 6 dígitos')).toHaveAccessibleDescription(/Código incorreto/);
    await painel.getByLabel('Código de 6 dígitos').fill(CODIGO_2FA);
    await painel.getByRole('button', { name: 'Confirmar e ativar' }).click();

    await expect(painel.getByRole('heading', { name: 'Seus códigos de recuperação' })).toBeFocused();
    const codigos = painel.getByRole('list', { name: 'Códigos de recuperação' }).getByRole('listitem');
    await expect(codigos).toHaveCount(10);
    await expectAccessibleInBothThemes(page, 'Códigos de recuperação');
    await painel.getByRole('button', { name: 'Copiar códigos' }).click();
    await expect(painel.getByRole('status').filter({ hasText: 'Códigos copiados.' })).toBeVisible();
    expect(await page.evaluate(() => navigator.clipboard.readText())).toContain(api.account.mfa.codes[0]!);
    const [download] = await Promise.all([page.waitForEvent('download'), painel.getByRole('button', { name: 'Baixar .txt' }).click()]);
    expect(download.suggestedFilename()).toBe('orange-social-codigos-de-recuperacao.txt');
    await expect(painel.getByRole('button', { name: 'Concluir' })).toBeDisabled();
    await painel.getByLabel('Guardei os códigos em lugar seguro').check();
    await painel.getByRole('button', { name: 'Concluir' }).click();

    await expect(painel.getByTestId('status-2fa')).toHaveText('Ativada');
    await expect(painel).toContainText('10 de 10 códigos de recuperação');
    await expect(painel.getByRole('list', { name: 'Códigos de recuperação' })).toHaveCount(0);
    // com 2FA, trocar a senha passa a pedir o código
    await expect(page.getByRole('form', { name: 'Trocar a senha' }).getByLabel('Código do app')).toBeVisible();

    await painel.getByRole('button', { name: 'Desativar' }).click();
    await painel.getByLabel('Senha atual').fill(SENHA_CERTA);
    await painel.getByLabel('Código do app').fill(CODIGO_2FA);
    await painel.getByRole('button', { name: 'Desativar o 2FA' }).click();
    await expect(painel.getByRole('status').filter({ hasText: 'Verificação em duas etapas desativada.' })).toBeVisible();
    await expect(painel.getByTestId('status-2fa')).toHaveText('Desativada');
    expect(api.last('POST', /\/mfa\/disable$/)!.body).toEqual({ password: SENHA_CERTA, code: CODIGO_2FA });
  });

  test('2FA ligado em outra sessão no meio da configuração: o 409 volta ao início sem o QR velho', async ({ page, api }) => {
    api.login();
    await page.goto('/configuracoes/seguranca');
    const painel = page.getByTestId('painel-2fa');
    await painel.getByRole('button', { name: 'Ativar' }).click();
    await painel.getByLabel('Senha atual').fill(SENHA_CERTA);
    await painel.getByRole('button', { name: 'Continuar' }).click();
    await expect(painel.getByRole('heading', { name: 'Leia o QR code no app autenticador' })).toBeFocused();
    // outra sessão confirmou primeiro (MfaService.confirmSetup → 409, o fator ativo não é sobrescrito)
    const msg = 'O 2FA já está ativo. Desative antes de configurar outro aparelho.';
    api.on('POST', /\/mfa\/totp\/confirm$/, () => {
      api.account.mfa = { ...api.account.mfa, enabled: true, enabledAt: new Date().toISOString(), setup: false, codes: ['abcde-fghjk'] };
      return problem(409, msg);
    });
    await painel.getByLabel('Código de 6 dígitos').fill(CODIGO_2FA);
    await painel.getByRole('button', { name: 'Confirmar e ativar' }).click();
    await expect(painel.getByTestId('error-summary')).toBeFocused();
    await expect(painel.getByTestId('error-summary')).toContainText(msg);
    await expect(painel.getByTestId('status-2fa')).toHaveText('Ativada');
    await expect(painel.getByTestId('chave-2fa')).toHaveCount(0);
  });

  test('gerar novos códigos pede senha e código', async ({ page, api }) => {
    api.login({ mfaEnabled: true });
    await page.goto('/configuracoes/seguranca');
    const painel = page.getByTestId('painel-2fa');
    await expect(painel).toContainText('1 de 10 códigos de recuperação');
    await expect(painel).toContainText('Restam poucos códigos');
    await painel.getByRole('button', { name: 'Gerar novos códigos' }).click();
    await painel.getByLabel('Senha atual').fill(SENHA_CERTA);
    await painel.getByRole('button', { name: 'Gerar novos códigos' }).click();
    await expect(painel.getByLabel('Código do app')).toHaveAccessibleDescription(/Digite o código de 6 dígitos/);
    await painel.getByLabel('Código do app').fill(CODIGO_2FA);
    await painel.getByRole('button', { name: 'Gerar novos códigos' }).click();
    await expect(painel.getByRole('list', { name: 'Códigos de recuperação' }).getByRole('listitem')).toHaveCount(10);
  });

  test('trocar a senha, encerrar uma sessão e sair de todos os outros aparelhos', async ({ page, api }) => {
    api.login();
    await page.goto('/configuracoes/seguranca');
    const sessoes = page.getByTestId('lista-sessoes').getByRole('listitem');
    await expect(sessoes).toHaveCount(3);
    await expect(sessoes.first()).toContainText('Esta sessão');
    await expect(sessoes.first().getByRole('button')).toHaveCount(0);
    await page.getByRole('button', { name: 'Sair de Safari no iOS' }).click();
    await expect(page.getByRole('status').filter({ hasText: 'Sessão encerrada: Safari no iOS.' })).toBeVisible();
    await expect(sessoes).toHaveCount(2);
    expect(api.find('DELETE', /\/me\/sessions\/0f1e2d3c4b5a69788796a5b4$/)).toHaveLength(1);
    await page.getByRole('button', { name: 'Sair de todos os outros aparelhos' }).click();
    await expect(page.getByRole('status').filter({ hasText: 'Você saiu de 1 outro aparelho.' })).toBeVisible();
    await expect(sessoes).toHaveCount(1);

    const form = page.getByRole('form', { name: 'Trocar a senha' });
    await form.getByLabel('Senha atual').fill(SENHA_CERTA);
    await form.getByLabel(/^Senha nova/).fill('curta');
    await form.getByLabel('Repita a senha nova').fill('outra');
    await form.getByRole('button', { name: 'Trocar a senha' }).click();
    await expect(form.getByLabel(/^Senha nova/)).toHaveAccessibleDescription(/pelo menos 12 caracteres/);
    await expect(form.getByLabel('Repita a senha nova')).toHaveAccessibleDescription('A confirmação não é igual à senha nova.');
    await form.getByLabel(/^Senha nova/).fill('uma frase nova e comprida');
    await form.getByLabel('Repita a senha nova').fill('uma frase nova e comprida');
    await form.getByRole('button', { name: 'Trocar a senha' }).click();
    await expect(form.getByRole('status')).toHaveText('Senha trocada.');
    expect(api.last('POST', /\/me\/password$/)!.body).toEqual({ currentPassword: SENHA_CERTA, code: null, newPassword: 'uma frase nova e comprida' });
  });

  test('alertas de login: interruptor salva na hora', async ({ page, api }) => {
    api.login();
    await page.goto('/configuracoes/seguranca');
    const chave = page.getByRole('switch', { name: 'Alertas de login' });
    await expect(chave).toHaveAttribute('aria-checked', 'true');
    await chave.click();
    await expect(chave).toHaveAttribute('aria-checked', 'false');
    expect(api.last('PATCH', /\/me\/preferences$/)!.body).toEqual({ loginAlerts: false });
  });
});

test.describe('Excluir conta (RF23)', () => {
  const dataFinal = () =>
    new Intl.DateTimeFormat('pt-BR', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'America/Sao_Paulo' }).format(
      new Date(Date.now() + 30 * 86_400_000),
    );

  test('alertdialog com consequências, data final, "Entendo" e senha; depois sai da conta', async ({ page, api }) => {
    api.login();
    await page.goto('/configuracoes/conta');
    const abrir = page.getByRole('button', { name: 'Excluir minha conta…' });
    await abrir.click();
    const dialogo = page.getByRole('alertdialog', { name: 'Excluir sua conta do Orange Social?' });
    await expect(dialogo).toBeVisible();
    await expect(dialogo).toHaveAccessibleDescription(new RegExp(`Sua conta será excluída em 30 dias \\(em ${dataFinal()}\\)`));
    await expect(dialogo.getByRole('button', { name: 'Cancelar' })).toBeFocused();
    await expect(dialogo).toContainText('Depois do prazo, vamos apagar');
    await expect(dialogo).toContainText('registros de acesso (data, hora e IP) por 6 meses');
    await expect(dialogo.getByLabel('Código do app')).toHaveCount(0);

    // foco preso: dar a volta com Tab não sai do diálogo
    for (let i = 0; i < 8; i++) {
      await page.keyboard.press('Tab');
      expect(await dialogo.evaluate((d) => d.contains(document.activeElement))).toBe(true);
    }
    await expectAccessibleInBothThemes(page, 'Excluir conta (diálogo)');
    await page.keyboard.press('Escape');
    await expect(dialogo).toBeHidden();
    await expect(abrir).toBeFocused();

    await abrir.click();
    await dialogo.getByRole('button', { name: 'Excluir minha conta' }).click();
    await expect(dialogo.getByLabel(/Entendo que, passados 30 dias/)).toHaveAccessibleDescription('Marque a caixa para confirmar que entendeu.');
    await expect(dialogo.getByLabel('Senha')).toHaveAccessibleDescription('Digite a sua senha atual.');
    await dialogo.getByLabel(/Entendo que, passados 30 dias/).check();
    await dialogo.getByLabel('Senha').fill('errada');
    await dialogo.getByRole('button', { name: 'Excluir minha conta' }).click();
    await expect(dialogo.getByLabel('Senha')).toHaveAccessibleDescription('Senha incorreta.');
    await dialogo.getByLabel('Senha').fill(SENHA_CERTA);
    await dialogo.getByRole('button', { name: 'Excluir minha conta' }).click();

    const feito = page.getByRole('alertdialog', { name: 'Pedido de exclusão registrado' });
    await expect(feito).toContainText(`A sua conta será excluída em ${dataFinal()}`);
    await expect(feito.getByRole('button', { name: 'Ir para o início' })).toBeFocused();
    expect(api.last('POST', /\/me\/deletion$/)!.body).toEqual({ password: SENHA_CERTA, code: null, confirm: true });
    await feito.getByRole('button', { name: 'Ir para o início' }).click();
    await expect(page).toHaveURL(/127\.0\.0\.1:\d+\/$/);
    await expect(page.getByRole('link', { name: 'Entrar' })).toBeVisible();
  });

  test('com 2FA ativo pede também o código do app', async ({ page, api }) => {
    api.login({ mfaEnabled: true });
    await page.goto('/configuracoes/conta');
    await page.getByRole('button', { name: 'Excluir minha conta…' }).click();
    const dialogo = page.getByRole('alertdialog');
    await dialogo.getByLabel(/Entendo que/).check();
    await dialogo.getByLabel('Senha').fill(SENHA_CERTA);
    await dialogo.getByLabel('Código do app').fill('111111');
    await dialogo.getByRole('button', { name: 'Excluir minha conta' }).click();
    await expect(dialogo.getByLabel('Código do app')).toHaveAccessibleDescription(/Senha ou código do app autenticador incorretos\./);
    await dialogo.getByLabel('Código do app').fill(CODIGO_2FA);
    await dialogo.getByRole('button', { name: 'Excluir minha conta' }).click();
    await expect(page.getByRole('alertdialog', { name: 'Pedido de exclusão registrado' })).toBeVisible();
    expect(api.last('POST', /\/me\/deletion$/)!.body).toEqual({ password: SENHA_CERTA, code: CODIGO_2FA, confirm: true });
  });
});

test.describe('Consentimentos (RF3)', () => {
  test('as 6 finalidades da API, na ordem dela, desligadas; ligar e desligar é o mesmo toque', async ({ page, api }) => {
    api.login();
    await page.goto('/configuracoes/privacidade');
    const chaves = page.getByRole('switch');
    await expect(chaves).toHaveCount(6);
    const ordem = await page.locator('[data-testid^="consentimento-"]').evaluateAll((els) => els.map((e) => e.getAttribute('data-testid')!.replace('consentimento-', '')));
    expect(ordem).toEqual(['LOCATION_TRACKING', 'PERSONALIZED_FEED', 'SENSITIVE_PROFILE_DATA', 'FACIAL_RECOGNITION', 'MARKETING', 'THIRD_PARTY_SHARING']);
    for (const c of await chaves.all()) await expect(c).toHaveAttribute('aria-checked', 'false');
    const sensivel = page.getByRole('switch', { name: 'Orientação sexual no perfil' });
    await expect(page.getByTestId('consentimento-SENSITIVE_PROFILE_DATA')).toContainText('Dado sensível');
    await sensivel.click();
    await expect(sensivel).toHaveAttribute('aria-checked', 'true');
    await expect(page.getByRole('status').filter({ hasText: 'Orientação sexual no perfil: ligado.' })).toBeVisible();
    expect(api.last('PUT', /\/me\/consents\/SENSITIVE_PROFILE_DATA$/)!.body).toEqual({ granted: true });
    await sensivel.click();
    await expect(sensivel).toHaveAttribute('aria-checked', 'false');
    expect(api.last('PUT', /\/me\/consents\/SENSITIVE_PROFILE_DATA$/)!.body).toEqual({ granted: false });
  });
});

test('fixtures das Configurações seguem os records Java', () => {
  const perfil = fixture<Record<string, unknown>>('perfil');
  expect(Object.keys(perfil).sort()).toEqual(
    [
      'id', 'name', 'handle', 'email', 'recoveryEmail', 'cellphoneNumber', 'dateOfBirth', 'bio', 'pronouns', 'links', 'countryOfResidence',
      'stateOfResidence', 'cityOfResidence', 'category', 'categoryVerification', 'typeDetails', 'avatarObjectKey', 'avatarUrl', 'gender',
    ].sort(),
  );
  const prefs = fixture<Record<string, unknown>>('preferencias');
  expect(Object.keys(prefs).sort()).toEqual(
    [
      'theme', 'appBackground', 'language', 'fontScale', 'reduceMotion', 'profilePrivate', 'whoCanComment', 'showBirthYear', 'defaultFeed',
      'sensitiveContent', 'usageReminderMinutes', 'notifications', 'loginAlerts', 'minorProtectionsLocked',
    ].sort(),
  );
  const consent = fixture<{ items: Array<Record<string, unknown>> }>('consentimentos').items;
  expect(consent.map((c) => c.purpose)).toEqual(['LOCATION_TRACKING', 'PERSONALIZED_FEED', 'SENSITIVE_PROFILE_DATA', 'FACIAL_RECOGNITION', 'MARKETING', 'THIRD_PARTY_SHARING']);
  expect(consent.every((c) => c.granted === false)).toBe(true);
  expect(Object.keys(consent[0]!).sort()).toEqual(['purpose', 'label', 'description', 'legalBasis', 'sensitive', 'granted', 'updatedAt', 'lockedForMinor'].sort());
  // ConsentPurpose.getLegalBasis(): o código gravado em consent_event.legal_basis; a tela traduz
  expect(consent.map((c) => c.legalBasis)).toEqual(['ART_7_I', 'ART_7_I', 'ART_11_I', 'ART_11_I', 'ART_7_I', 'ART_7_I']);
});
