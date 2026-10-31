import { fixture, problem, SENHA_CERTA } from './support/mock-api';
import { expect, expectAccessibleInBothThemes, test } from './support/test';

test.describe('Entrar (RF27)', () => {
  test('e-mail e senha: busca o CSRF antes da primeira escrita e volta para a página pedida', async ({ page, api }) => {
    await page.goto('/entrar?voltar=%2Fu%2F42');
    await page.getByLabel('E-mail').fill('ana@example.com');
    await page.getByLabel('Senha', { exact: true }).fill(SENHA_CERTA);
    await page.getByRole('button', { name: 'Entrar', exact: true }).click();
    await expect(page).toHaveURL(/\/u\/42$/);
    await expect(page.getByTestId('link-configuracoes')).toBeVisible();
    const order = api.requests.filter((r) => r.method !== 'GET' || r.path.endsWith('/csrf')).map((r) => `${r.method} ${r.path}`);
    expect(order.slice(0, 2)).toEqual(['GET /api/v1/auth/csrf', 'POST /api/v1/auth/login']);
    const login = api.last('POST', /\/auth\/login$/)!;
    expect(login.headers['x-xsrf-token']).toMatch(/^csrf-/);
    expect(login.body).toEqual({ email: 'ana@example.com', password: SENHA_CERTA });
  });

  test('senha errada mostra a mensagem neutra da API', async ({ page }) => {
    await page.goto('/entrar');
    await page.getByLabel('E-mail').fill('ana@example.com');
    await page.getByLabel('Senha', { exact: true }).fill('errada');
    await page.getByRole('button', { name: 'Entrar', exact: true }).click();
    await expect(page.getByRole('main').getByRole('alert')).toHaveText('E-mail ou senha incorretos.');
  });

  test('MFA_REQUIRED pede o código de 6 dígitos', async ({ page, api }) => {
    api.on('POST', /\/auth\/login$/, { status: 200, body: { status: 'MFA_REQUIRED', user: null, deletionScheduledFor: null, message: null } });
    api.on('POST', /\/auth\/login\/2fa$/, (req, mock) => {
      if ((req.body as { code: string }).code !== '246810') return problem(401, 'Código incorreto.');
      const user = mock.login();
      return { status: 200, body: { status: 'AUTHENTICATED', user, deletionScheduledFor: null, message: null } };
    });
    await page.goto('/entrar');
    await page.getByLabel('E-mail').fill('ana@example.com');
    await page.getByLabel('Senha', { exact: true }).fill(SENHA_CERTA);
    await page.getByRole('button', { name: 'Entrar', exact: true }).click();
    await expect(page.getByRole('heading', { level: 1, name: 'Verificação em duas etapas' })).toBeFocused();
    await page.getByLabel('Código de 6 dígitos').fill('12ab3');
    await expect(page.getByLabel('Código de 6 dígitos')).toHaveValue('123');
    await page.getByRole('button', { name: 'Confirmar e entrar' }).click();
    await expect(page.getByText('O código tem 6 números.')).toBeVisible();
    await page.getByLabel('Código de 6 dígitos').fill('111111');
    await page.getByRole('button', { name: 'Confirmar e entrar' }).click();
    await expect(page.getByRole('main').getByRole('alert')).toHaveText('Código incorreto.');
    await page.getByLabel('Código de 6 dígitos').fill('246810');
    await page.getByRole('button', { name: 'Confirmar e entrar' }).click();
    await expect(page).toHaveURL(/\/$/);
    await expect(page.getByTestId('link-configuracoes')).toBeVisible();
  });

  test('REACTIVATION_AVAILABLE oferece reativar a conta', async ({ page, api }) => {
    api.on('POST', /\/auth\/login$/, {
      status: 200,
      body: { status: 'REACTIVATION_AVAILABLE', user: null, deletionScheduledFor: '2026-11-20T03:15:00Z', message: 'Sua conta está marcada para exclusão. Quer reativá-la?' },
    });
    api.on('POST', /\/auth\/reactivate$/, (_req, mock) => ({
      status: 200,
      body: { status: 'AUTHENTICATED', user: mock.login(), deletionScheduledFor: null, message: null },
    }));
    await page.goto('/entrar?voltar=/configuracoes/conta');
    await page.getByLabel('E-mail').fill('ana@example.com');
    await page.getByLabel('Senha', { exact: true }).fill(SENHA_CERTA);
    await page.getByRole('button', { name: 'Entrar', exact: true }).click();
    await expect(page.getByRole('heading', { level: 1, name: 'Sua conta está em exclusão' })).toBeFocused();
    await expect(page.getByText('Ela será excluída em 20 de novembro de 2026. Até lá você pode desistir: tudo volta como estava.')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Manter a exclusão e sair' })).toBeVisible();
    await expectAccessibleInBothThemes(page, 'Reativar conta');
    await page.getByRole('button', { name: 'Reativar minha conta' }).click();
    await expect(page).toHaveURL(/\/configuracoes\/conta$/);
    await expect(page.getByRole('heading', { level: 1, name: 'Conta' })).toBeVisible();
  });

  test('REACTIVATION_AVAILABLE: manter a exclusão volta ao início sem entrar', async ({ page, api }) => {
    api.on('POST', /\/auth\/login$/, {
      status: 200,
      body: { status: 'REACTIVATION_AVAILABLE', user: null, deletionScheduledFor: '2026-11-20T03:15:00Z', message: 'Sua conta está marcada para exclusão. Quer reativá-la?' },
    });
    await page.goto('/entrar');
    await page.getByLabel('E-mail').fill('ana@example.com');
    await page.getByLabel('Senha', { exact: true }).fill(SENHA_CERTA);
    await page.getByRole('button', { name: 'Entrar', exact: true }).click();
    await page.getByRole('button', { name: 'Manter a exclusão e sair' }).click();
    await expect(page).toHaveURL(/127\.0\.0\.1:\d+\/$/);
    await expect(page.getByTestId('link-entrar')).toBeVisible();
    expect(api.find('POST', /\/auth\/reactivate$/)).toHaveLength(0);
  });

  test('429 bloqueia pelo Retry-After e libera depois', async ({ page, api }) => {
    api.on('POST', /\/auth\/login$/, {
      ...problem(429, 'Muitas tentativas. Tente de novo em 2 segundos ou redefina sua senha.'),
      headers: { 'Retry-After': '2' },
    });
    await page.goto('/entrar');
    await page.getByLabel('E-mail').fill('ana@example.com');
    await page.getByLabel('Senha', { exact: true }).fill('qualquer');
    await page.getByRole('button', { name: 'Entrar', exact: true }).click();
    await expect(page.getByRole('main').getByRole('alert')).toContainText('Muitas tentativas.');
    await expect(page.getByRole('button', { name: /Aguarde \d segundos?/ })).toBeDisabled();
    await expect(page.getByRole('button', { name: 'Entrar', exact: true })).toBeEnabled({ timeout: 5_000 });
  });

  test('voltar externo é ignorado (sem redirecionamento aberto)', async ({ page }) => {
    await page.goto('/entrar?voltar=%2F%2Fexemplo.com');
    await page.getByLabel('E-mail').fill('ana@example.com');
    await page.getByLabel('Senha', { exact: true }).fill(SENHA_CERTA);
    await page.getByRole('button', { name: 'Entrar', exact: true }).click();
    await expect(page).toHaveURL(/127\.0\.0\.1:\d+\/$/);
  });

  test('sair encerra a sessão e as outras abas ficam deslogadas', async ({ page, api, context }) => {
    api.login();
    await page.goto('/');
    const outra = await context.newPage();
    await outra.goto('/termos');
    await expect(outra.getByTestId('link-configuracoes')).toBeVisible();
    await page.getByTestId('sair').click();
    await expect(page).toHaveURL(/\/entrar$/);
    expect(api.find('POST', /\/auth\/logout$/)).toHaveLength(1);
    await expect(outra.getByTestId('link-entrar')).toBeVisible();
  });

  test('o login fica sobre o mosaico da marca, com o logo oficial', async ({ page }) => {
    await page.goto('/entrar');
    const fundo = await page.locator('.os-auth-bg').evaluate((el) => getComputedStyle(el).backgroundImage);
    expect(fundo).toContain('mosaico-laranja.webp');
    await expect(page.locator('img[src="/brand/orange-social-logo.svg"]')).toHaveAttribute('alt', '');
  });

  test('sem violações graves de acessibilidade', async ({ page }) => {
    await page.goto('/entrar');
    await page.getByRole('button', { name: 'Entrar', exact: true }).click();
    await expect(page.getByText('Informe o seu e-mail.')).toBeVisible();
    await expectAccessibleInBothThemes(page, 'Entrar');
  });
});

test('fixture de sessão segue o SessionUserView', () => {
  const s = fixture<Record<string, unknown>>('sessao-usuario');
  expect(Object.keys(s).sort()).toEqual(
    ['accountStatus', 'category', 'categoryVerification', 'email', 'emailVerified', 'handle', 'id', 'mfaEnabled', 'minor', 'name', 'termsUpToDate'].sort(),
  );
});
