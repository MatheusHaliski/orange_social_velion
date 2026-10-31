import { expect, expectAccessibleInBothThemes, test } from './support/test';

const id = (n: number) => `0199a1b2-c3d4-7e5f-8a9b-${String(n).padStart(12, '0')}`;
const BIKE = `/posts/${id(2)}`;
const BARIGUI = `/posts/${id(9)}`;
const ALERTA = `/posts/${id(7)}`;
const VAGA = `/posts/${id(8)}`;

test.describe('Modal do post (RF24)', () => {
  test('toque no título do card abre o modal por cima do feed; Esc fecha e devolve o foco', async ({ page }) => {
    await page.goto('/?feed=posts');
    const titulo = page.getByRole('link', { name: 'Troquei o carro pela bike por 30 dias. O resultado me surpreendeu' });
    await titulo.click();
    await expect(page).toHaveURL(new RegExp(`${BIKE}$`));
    const modal = page.getByRole('dialog', { name: 'Troquei o carro pela bike por 30 dias. O resultado me surpreendeu' });
    await expect(modal).toBeVisible();
    await expect(modal.getByRole('button', { name: 'Fechar' })).toBeFocused();
    await expect(modal.getByTestId('texto-post')).toContainText('banca da esquina');
    await expect(modal.getByTestId('publicado-em')).toContainText(/Publicado em \d{1,2} de \w+ de \d{4} às \d{2}:\d{2}/);
    await expect(modal.getByTestId('publicado-em')).toContainText('(há 12 min)');
    await expect(modal.getByTestId('contagens')).toHaveText('312 curtidas · 2 comentários · 9 compartilhamentos');
    await expect(modal.getByRole('link', { name: 'Ver perfil e posts de Ana Ribeiro' })).toHaveAttribute('href', '/u/42');
    // o feed continua por baixo, inerte
    await expect(page.getByTestId('lista-posts')).toBeAttached();
    await expectAccessibleInBothThemes(page, 'Modal do post');
    await page.keyboard.press('Escape');
    await expect(modal).toBeHidden();
    await expect(page).toHaveURL(/\/\?feed=posts$/);
    await expect(titulo).toBeFocused();
  });

  test('link direto abre a página do post; /p/{id} redireciona; removido diz que não está disponível', async ({ page }) => {
    await page.goto(BARIGUI);
    await expect(page.getByRole('heading', { level: 1, name: 'Fim de tarde no Parque Barigui' })).toBeVisible();
    await expect(page).toHaveTitle('Fim de tarde no Parque Barigui · Orange Social');
    await expect(page.getByTestId('post-moldura')).toHaveAttribute('data-art', 'COLOR');
    await expect(page.getByTestId('post-moldura').locator('[data-material="papel"]')).toBeAttached();
    await page.goto(`/p/${id(2)}`);
    await expect(page).toHaveURL(new RegExp(`${BIKE}$`));
    await page.goto(`/posts/${id(999)}`);
    await expect(page.getByTestId('post-indisponivel')).toContainText('Este post não está mais disponível');
  });
});

test.describe('Interações (RF26)', () => {
  test('curtir, salvar, comentar (com contador), apagar e compartilhar, com aria-live', async ({ page, api, context }) => {
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);
    api.login({ id: 777, name: 'Carla Dias', handle: 'carla' });
    await page.goto(BIKE);
    const curtir = page.getByTestId('curtir');
    await expect(curtir).toHaveAccessibleName(/Curtir.*312 curtidas/);
    await expect(curtir).toHaveAttribute('aria-pressed', 'false');
    await curtir.click();
    await expect(curtir).toHaveAttribute('aria-pressed', 'true');
    await expect(curtir).toHaveAccessibleName(/Curtido.*313 curtidas/);
    await expect(page.getByTestId('status-interacao')).toHaveText('Você curtiu. 313 curtidas.');
    expect(api.last('PUT', /\/like$/)!.headers['x-xsrf-token']).toBe(api.csrfToken);
    await curtir.click();
    await expect(page.getByTestId('status-interacao')).toHaveText('Curtida desfeita. 312 curtidas.');

    await page.getByTestId('salvar').click();
    await expect(page.getByTestId('salvar')).toHaveAttribute('aria-pressed', 'true');
    await expect(page.getByTestId('status-interacao')).toContainText('Post salvo');

    const comentarios = page.getByTestId('comentarios');
    await expect(comentarios.getByTestId('comentario')).toHaveCount(2);
    await comentarios.getByLabel('Seu comentário').fill('Inspirador!');
    await expect(comentarios.getByText('11/2.000 caracteres')).toBeVisible();
    await comentarios.getByRole('button', { name: 'Enviar comentário' }).click();
    await expect(page.getByTestId('status-comentarios')).toHaveText('Comentário publicado. 3 comentários.');
    expect(api.last('POST', /\/comments$/)?.body).toEqual({ body: 'Inspirador!' });
    await comentarios.getByRole('button', { name: 'Apagar o comentário de Carla Dias' }).click();
    const confirma = page.getByRole('alertdialog', { name: 'Apagar o comentário?' });
    await expect(confirma.getByRole('button', { name: 'Cancelar' })).toBeFocused();
    await confirma.getByRole('button', { name: 'Sim, apagar' }).click();
    await expect(page.getByTestId('status-comentarios')).toHaveText('Comentário apagado.');
    await expect(comentarios.getByTestId('comentario')).toHaveCount(2);

    await page.getByTestId('compartilhar').click();
    const folha = page.getByRole('dialog', { name: 'Compartilhar' });
    await expect(folha.getByRole('link', { name: /WhatsApp/ })).toHaveAttribute('href', /^https:\/\/wa\.me\/\?text=/);
    await expect(folha.getByRole('link', { name: /Telegram/ })).toHaveAttribute('href', /t\.me\/share\/url/);
    await expect(folha.getByRole('link', { name: /^X/ })).toHaveAttribute('href', /x\.com\/intent\/post/);
    await expect(folha.getByRole('link', { name: /E-mail/ })).toHaveAttribute('href', /^mailto:/);
    await folha.getByRole('button', { name: 'Copiar link' }).click();
    expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(`http://localhost:3000/p/${id(2)}`);
    await expect.poll(() => api.last('POST', /\/shares$/)?.body).toEqual({ channel: 'COPY_LINK' });
    await expectAccessibleInBothThemes(page, 'Folha de compartilhar');
    await folha.getByRole('button', { name: 'Fechar' }).click();
    await expect(page.getByTestId('compartilhar')).toBeFocused();
    await expect(page.getByTestId('compartilhar')).toHaveAccessibleName(/10 compartilhamentos/);
  });

  test('ações no card: curtir na hora com o número compacto e o por extenso no nome', async ({ page, api }) => {
    api.login({ id: 777, name: 'Carla Dias', handle: 'carla' });
    await page.goto('/?feed=posts');
    const card = page.getByRole('article', { name: 'O que ninguém te conta sobre começar a programar' });
    const curtir = card.getByTestId('curtir');
    await expect(curtir).toContainText('2,1 mil');
    await expect(curtir).toHaveAccessibleName('Curtir, 2,1 mil (2.100 curtidas)');
    await curtir.click();
    await expect(curtir).toHaveAttribute('aria-pressed', 'true');
    await expect(curtir).toHaveAccessibleName('Curtir, 2,1 mil (2.101 curtidas)');
    await expect(card.getByTestId('tendencia')).toHaveText('em alta');
  });

  test('visitante: curtir leva ao login e o comentário mostra o convite', async ({ page }) => {
    await page.goto(BIKE);
    await expect(page.getByTestId('aviso-comentarios')).toHaveText('Entre na sua conta para comentar. Comentários são públicos.');
    await expect(page.getByRole('link', { name: 'Entrar para comentar' })).toHaveAttribute('href', `/entrar?voltar=${encodeURIComponent(BIKE)}`);
    await page.getByTestId('curtir').click();
    await expect(page).toHaveURL(/\/entrar\?voltar=/);
  });

  test('apagar duas vezes o mesmo comentário: a segunda responde 404 e a tela avisa', async ({ page, api }) => {
    api.login({ id: 205, name: 'Bruno Costa', handle: 'brunocosta' });
    api.on('DELETE', /\/comments\/13$/, { status: 404, body: { title: 'Não encontrado', status: 404, detail: 'Comentário não encontrado.' } });
    await page.goto(BARIGUI);
    await page.getByRole('button', { name: 'Apagar o comentário de Bruno Costa' }).click();
    await page.getByRole('button', { name: 'Sim, apagar' }).click();
    await expect(page.getByTestId('status-comentarios')).toHaveText('Comentário não encontrado.');
  });

  test('alerta oficial (OS-34): só compartilhar, sem moldura, fonte verificada, área, validade e o que fazer', async ({ page, api }) => {
    api.login();
    await page.goto(ALERTA);
    await expect(page.getByTestId('severidade')).toHaveText('Alerta severo · Chuva forte');
    await expect(page.getByTestId('post-moldura')).toHaveCount(0);
    await expect(page.getByTestId('curtir')).toHaveCount(0);
    await expect(page.getByTestId('salvar')).toHaveCount(0);
    await expect(page.getByTestId('comentarios')).toHaveCount(0);
    await expect(page.getByTestId('compartilhar')).toBeVisible();
    await expect(page.getByTestId('aviso-alerta')).toContainText('Alerta oficial não recebe curtidas nem comentários');
    const dados = page.getByTestId('dados-alerta');
    await expect(dados.getByTestId('fonte-verificada')).toHaveText('fonte verificada');
    await expect(dados).toContainText('Curitiba, Colombo, Pinhais · raio 25 km');
    await expect(dados).toContainText(/(hoje|amanhã), 23:00/);
    await expect(dados).toContainText('Evite áreas próximas a rios');
    await expectAccessibleInBothThemes(page, 'Alerta oficial');
  });

  test('vaga no Alert Feed tem as quatro ações', async ({ page }) => {
    await page.goto(VAGA);
    await expect(page.getByTestId('severidade')).toHaveText('Vaga');
    await expect(page.getByTestId('curtir')).toBeVisible();
    await expect(page.getByTestId('salvar')).toBeVisible();
    await expect(page.getByTestId('comentarios')).toBeVisible();
  });
});

test.describe('Ações do autor (RF29)', () => {
  test('arquivar fecha as interações, restaurar abre; excluir pede confirmação e some', async ({ page, api }) => {
    api.login();
    await page.goto(BARIGUI);
    const acoes = page.getByTestId('acoes-autor');
    await expect(acoes.getByRole('link', { name: 'Editar' })).toHaveAttribute('href', `${BARIGUI}/editar`);
    await acoes.getByRole('button', { name: 'Arquivar' }).click();
    await expect(acoes.getByRole('status')).toContainText('Post arquivado');
    await expect(page.getByTestId('curtir')).toBeDisabled();
    await expect(page.getByTestId('aviso-comentarios')).toHaveText('Post arquivado: os comentários estão fechados.');
    await acoes.getByRole('button', { name: 'Restaurar' }).click();
    await expect(acoes.getByRole('status')).toContainText('Post restaurado');
    await expect(page.getByTestId('curtir')).toBeEnabled();

    await acoes.getByRole('button', { name: 'Excluir…' }).click();
    const dialogo = page.getByRole('alertdialog', { name: 'Excluir o post?' });
    await expect(dialogo.getByRole('button', { name: 'Cancelar' })).toBeFocused();
    await page.keyboard.press('Escape');
    await expect(dialogo).toBeHidden();
    await acoes.getByRole('button', { name: 'Excluir…' }).click();
    await dialogo.getByRole('button', { name: 'Sim, excluir' }).click();
    await expect(page).toHaveURL(/127\.0\.0\.1:\d+\/$/);
    expect(api.find('DELETE', /\/posts\/[0-9a-f-]+$/)).toHaveLength(1);
    await page.goto(BARIGUI);
    await expect(page.getByTestId('post-indisponivel')).toBeVisible();
  });
});
