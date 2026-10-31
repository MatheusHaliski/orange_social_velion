import { problem } from './support/mock-api';
import { expect, expectAccessibleInBothThemes, test } from './support/test';

const TERMOS = 'Li e aceito os Termos de Uso da Velion';

async function preencherBasico(page: import('@playwright/test').Page, nascimento = '1990-04-12') {
  await page.getByLabel('Nome de exibição (obrigatório)').fill('Defesa Civil de Pinhais');
  await page.getByLabel('@usuário (obrigatório)').fill('@DefesaPinhais');
  await page.getByLabel('E-mail (obrigatório)', { exact: true }).fill('contato@pinhais.example');
  await page.getByLabel('Senha (obrigatório)').fill('uma frase longa e segura');
  await page.getByLabel('Data de nascimento (obrigatório)').fill(nascimento);
}

test.describe('Cadastro (RF1)', () => {
  test('6 categorias com cor, glifo e rótulo; Termos da Velion desmarcados com a versão da API', async ({ page }) => {
    await page.goto('/cadastro');
    const tipos = page.getByRole('group', { name: /Tipo de usuário/ }).getByRole('radio');
    await expect(tipos).toHaveCount(6);
    for (const [codigo, nome, glifo] of [
      ['VERDE', 'Pessoa Física', 'diamond'],
      ['AMARELO', 'Networking', 'star'],
      ['AZUL', 'Marketing', 'triangle'],
      ['LARANJA', 'Comunidade', 'hexagon'],
      ['VERMELHO', 'Instituição', 'rectangle'],
      ['PRETO', 'Especial', 'double-circle'],
    ] as const) {
      const opcao = page.getByTestId(`tipo-${codigo}`);
      await expect(opcao).toContainText(nome);
      await expect(opcao.locator('svg.os-dot')).toHaveAttribute('data-glyph', glifo);
    }
    await expect(page.getByRole('checkbox', { name: TERMOS })).not.toBeChecked();
    await expect(page.getByText('Versão 2026-10-25.1.')).toBeVisible();
    await expect(page.getByRole('link', { name: /Ler os Termos de Uso/ })).toHaveAttribute('href', '/termos');
  });

  test('Instituição: campos do tipo (subtipo, CNPJ, representante privado) e vai para /confirmar-email', async ({ page, api }) => {
    await page.goto('/cadastro');
    await preencherBasico(page);
    await page.getByRole('radio', { name: /^Instituição/ }).check();
    await page.getByLabel('Subtipo (obrigatório)').selectOption('GOVERNMENT');
    await page.getByLabel('CNPJ (obrigatório)').fill('11222333000181');
    await page.getByLabel('Razão social (obrigatório)').fill('Município de Pinhais');
    await page.getByLabel('Setor (obrigatório)').fill('Defesa Civil');
    await page.getByLabel('Site oficial (obrigatório)').fill('https://pinhais.example');
    await page.getByLabel(/^Nome do representante legal/).fill('Carlos Souza');
    await expect(page.getByLabel(/^Nome do representante legal/)).toHaveAccessibleName(/privado/);
    await page.getByLabel(/^Cargo do representante/).fill('Coordenador');
    await page.getByLabel(/^E-mail do representante/).fill('carlos@pinhais.example');
    await page.getByRole('checkbox', { name: TERMOS }).check();
    await page.getByRole('button', { name: 'Criar conta' }).click();
    await expect(page).toHaveURL(/\/confirmar-email$/);

    const body = api.last('POST', /\/auth\/register$/)!.body as Record<string, unknown>;
    expect(body).toMatchObject({
      name: 'Defesa Civil de Pinhais',
      handle: 'defesapinhais',
      userType: 'VERMELHO',
      dateOfBirth: '1990-04-12',
      acceptTerms: true,
      termsVersion: '2026-10-25.1',
    });
    expect(body.typeDetails).toEqual({
      subtype: 'GOVERNMENT',
      cnpj: '11222333000181',
      legalName: 'Município de Pinhais',
      sector: 'Defesa Civil',
      website: 'https://pinhais.example',
      representativeName: 'Carlos Souza',
      representativeRole: 'Coordenador',
      representativeEmail: 'carlos@pinhais.example',
    });
  });

  test('validação local e 422 por campo', async ({ page, api }) => {
    await page.goto('/cadastro');
    await page.getByRole('button', { name: 'Criar conta' }).click();
    const resumo = page.getByTestId('error-summary');
    await expect(resumo).toBeFocused();
    await expect(resumo).toContainText('A senha precisa ter pelo menos 12 caracteres.');
    await expect(resumo).toContainText('Escolha o tipo de usuário.');
    await expect(resumo).toContainText('Para criar a conta, leia e aceite os Termos de Uso da Velion.');
    expect(api.find('POST', /\/auth\/register$/)).toHaveLength(0);

    api.on('POST', /\/auth\/register$/, problem(422, 'Revise os campos destacados.', {
      errors: ['Essa senha é fácil de adivinhar. Escolha outra.', 'CNPJ inválido. Confira os 14 caracteres (o CNPJ pode ter letras desde 2026).'],
    }));
    await preencherBasico(page);
    await page.getByRole('radio', { name: /^Marketing/ }).check();
    await page.getByLabel('Segmento (obrigatório)').selectOption('AGENCY');
    await page.getByLabel('CNPJ (obrigatório)').fill('123');
    await page.getByLabel('Razão social (obrigatório)').fill('Faísca Ltda');
    await page.getByLabel('Site (obrigatório)').fill('https://faisca.example');
    await page.getByLabel(/^Nome do responsável/).fill('Lia');
    await page.getByLabel(/^Cargo do responsável/).fill('Sócia');
    await page.getByLabel(/^E-mail do responsável/).fill('lia@faisca.example');
    await page.getByRole('checkbox', { name: TERMOS }).check();
    await page.getByRole('button', { name: 'Criar conta' }).click();
    await expect(page.getByLabel('Senha (obrigatório)')).toHaveAccessibleDescription(/Essa senha é fácil de adivinhar/);
    await expect(page.getByLabel('CNPJ (obrigatório)')).toHaveAccessibleDescription(/CNPJ inválido/);
  });

  test('409 de @usuário em uso marca o campo', async ({ page, api }) => {
    api.on('POST', /\/auth\/register$/, problem(409, 'Esse @usuário já está em uso. Tente outro.'));
    await page.goto('/cadastro');
    await preencherBasico(page);
    await page.getByRole('radio', { name: /^Pessoa Física/ }).check();
    await page.getByRole('checkbox', { name: TERMOS }).check();
    await page.getByRole('button', { name: 'Criar conta' }).click();
    await expect(page.getByLabel('@usuário (obrigatório)')).toHaveAccessibleDescription(/Esse @usuário já está em uso/);
  });

  test('idade: 13+, menor de 16 com o e-mail do responsável e organização só 18+', async ({ page }) => {
    await page.goto('/cadastro');
    await page.getByRole('radio', { name: /^Pessoa Física/ }).check();
    await expect(page.getByLabel(/E-mail do responsável/)).toHaveCount(0);
    const ano = new Date().getFullYear();
    await page.getByLabel('Data de nascimento (obrigatório)').fill(`${ano - 14}-01-01`);
    await expect(page.getByLabel(/E-mail do responsável/)).toBeVisible();
    await expect(page.getByText('Menores de 16 anos entram com o e-mail de um responsável')).toBeVisible();
    await page.getByRole('radio', { name: /^Comunidade/ }).check();
    await expect(page.getByText('Contas de Comunidade precisam de um responsável maior de 18 anos.')).toBeVisible();
    await page.getByLabel('Data de nascimento (obrigatório)').fill(`${ano - 12}-01-01`);
    await page.getByRole('radio', { name: /^Pessoa Física/ }).check();
    await page.getByRole('button', { name: 'Criar conta' }).click();
    await expect(page.getByTestId('error-summary')).toContainText('O Orange Social é para maiores de 13 anos.');
  });

  test('Especial: o subtipo Evento pede nome, início e local', async ({ page }) => {
    await page.goto('/cadastro');
    await page.getByRole('radio', { name: /^Especial/ }).check();
    await expect(page.getByLabel('Nome do evento (obrigatório)')).toHaveCount(0);
    await page.getByLabel('Subtipo (obrigatório)').selectOption('EVENT');
    await expect(page.getByLabel('Nome do evento (obrigatório)')).toBeVisible();
    await expect(page.getByLabel('Início do evento (obrigatório)')).toHaveAttribute('type', 'datetime-local');
    await page.getByLabel('Subtipo (obrigatório)').selectOption('BANK');
    await expect(page.getByLabel('Código no Banco Central (obrigatório)')).toBeVisible();
  });

  test('sem violações graves de acessibilidade', async ({ page }) => {
    await page.goto('/cadastro');
    await page.getByRole('radio', { name: /^Instituição/ }).check();
    await expect(page.getByLabel('CNPJ (obrigatório)')).toBeVisible();
    await expectAccessibleInBothThemes(page, 'Cadastro');
  });
});
