import { expect, expectAccessibleInBothThemes, test } from './support/test';

test.describe('Segmented Switcher dos 4 feeds (OS-31)', () => {
  test('tablist com Perfis | Posts | Áudio | Alertas, setas e Home/End, estado na URL e voltar do navegador', async ({ page }) => {
    await page.goto('/');
    const abas = page.getByRole('tablist', { name: 'Feeds' }).getByRole('tab');
    await expect(abas).toHaveText(['Perfis', 'Posts', 'Áudio', 'Alertas']);
    const posts = page.getByRole('tab', { name: 'Posts' });
    await expect(posts).toHaveAttribute('aria-selected', 'true');
    await expect(page.getByRole('tabpanel', { name: 'Posts' })).toBeVisible();
    // só a aba escolhida entra no Tab
    await expect(posts).toHaveAttribute('tabindex', '0');
    await expect(page.getByRole('tab', { name: 'Perfis' })).toHaveAttribute('tabindex', '-1');
    await posts.focus();
    await page.keyboard.press('ArrowRight');
    await expect(page.getByRole('tab', { name: 'Áudio' })).toBeFocused();
    await expect(page).toHaveURL(/\?feed=audio$/);
    await expect(page.getByTestId('audio-em-breve')).toContainText('Áudio: em breve');
    await page.keyboard.press('End');
    await expect(page.getByRole('tab', { name: 'Alertas' })).toHaveAttribute('aria-selected', 'true');
    await expect(page).toHaveURL(/\?feed=alertas$/);
    await page.keyboard.press('ArrowRight');
    await expect(page.getByRole('tab', { name: 'Perfis' })).toBeFocused();
    await page.keyboard.press('Home');
    await expect(page).toHaveURL(/\?feed=perfis$/);
    await page.goBack();
    await expect(page.getByRole('tab', { name: 'Alertas' })).toHaveAttribute('aria-selected', 'true');
  });

  test('o feed inicial da conta abre quando a URL não diz qual', async ({ page, api }) => {
    api.login();
    api.account.preferences.defaultFeed = 'ALERT';
    await page.goto('/');
    await expect(page.getByRole('tab', { name: 'Alertas' })).toHaveAttribute('aria-selected', 'true');
  });
});

test.describe('Post Feed (OS-32) e filtros (OS-35)', () => {
  test('cards com bolinha + glifo + rótulo, tipo de mídia, classificação, data relativa, moldura e tendência', async ({ page, api }) => {
    await page.goto('/?feed=posts');
    const lista = page.getByTestId('lista-posts');
    await expect(lista.getByRole('article')).toHaveCount(6);
    const video = lista.getByRole('article', { name: 'O que ninguém te conta sobre começar a programar' });
    await expect(video.getByTestId('categoria')).toHaveText('Networking');
    await expect(video.locator('svg.os-dot')).toHaveAttribute('data-glyph', 'star');
    await expect(video.getByTestId('tipo-midia')).toHaveText(/Vídeo/);
    await expect(video.getByTestId('classificacao')).toContainText('livre para todos os públicos');
    await expect(video.locator('time').first()).toHaveText('há 3 min');
    await expect(video.locator('time').first()).toHaveAttribute('title', /de \d{4} às/);
    await expect(video.getByText('Vídeo de 12 minutos e 48 segundos')).toBeAttached();
    await expect(video.getByTestId('tendencia')).toHaveText('em alta');
    const moldura = page.getByTestId('card-post-moldura').first();
    await expect(moldura).toHaveAttribute('data-art', 'GRADIENT');
    await expect(moldura.locator('.os-frame-art')).toHaveAttribute('aria-hidden', 'true');
    // Aura Hype só com o post em alta, e o texto "em alta" continua lá
    await expect(moldura).toHaveAttribute('data-hype', 'SCANNER');
    const plus = lista.getByRole('article', { name: 'Mutirão de limpeza do Parque Barigui no sábado' });
    await expect(page.getByTestId('aura-plus').first()).toBeAttached();
    await expect(plus.getByTestId('classificacao')).toHaveText(/Livre/);
    expect(api.last('GET', /^\/api\/v1\/posts$/)?.search.get('limit')).toBe('10');
    await expectAccessibleInBothThemes(page, 'Post Feed');
  });

  test('Categoria combinável, Tipo, País, Cidade e Nome vão para a URL e para a API; limpar volta ao todo', async ({ page, api }) => {
    await page.goto('/?feed=posts');
    const lista = page.getByTestId('lista-posts');
    await page.getByTestId('filtro-categoria-VERDE').click();
    await expect(page).toHaveURL(/cat=VERDE/);
    await expect(page.getByTestId('filtro-categoria-VERDE')).toHaveAttribute('aria-pressed', 'true');
    await page.getByTestId('filtro-categoria-AZUL').click();
    await expect(lista.getByRole('article')).toHaveCount(3);
    expect(api.last('GET', /^\/api\/v1\/posts$/)?.search.getAll('category')).toEqual(['VERDE', 'AZUL']);

    await page.getByRole('button', { name: 'Mais filtros' }).click();
    await page.getByTestId('filtro-tipo').selectOption('IMAGE');
    await expect(lista.getByRole('article')).toHaveCount(2);
    await page.getByLabel('Nome').fill('barigui');
    await page.getByLabel('Cidade').fill('Curitiba');
    await page.getByLabel('País').fill('br');
    await page.getByRole('button', { name: 'Aplicar' }).click();
    await expect(page).toHaveURL(/tipo=IMAGE.*pais=BR.*cidade=Curitiba.*nome=barigui|nome=barigui/);
    await expect(lista.getByRole('article')).toHaveCount(1);
    const req = api.last('GET', /^\/api\/v1\/posts$/)!;
    expect([req.search.get('mediaType'), req.search.get('q'), req.search.get('city'), req.search.get('country')]).toEqual(['IMAGE', 'barigui', 'Curitiba', 'BR']);
    await expectAccessibleInBothThemes(page, 'Filtros abertos');

    await page.getByTestId('limpar-filtros').click();
    await expect(page).toHaveURL(/\/\?feed=posts$/);
    await expect(lista.getByRole('article')).toHaveCount(6);
    await expect(page.getByLabel('Nome')).toHaveValue('');
  });

  test('Local (perto de mim) pede a localização ao navegador e manda lat/lng/raio, sem pôr na URL', async ({ page, api, context }) => {
    await context.grantPermissions(['geolocation']);
    await context.setGeolocation({ latitude: -25.4284, longitude: -49.2733 });
    await page.goto('/?feed=posts');
    await page.getByRole('button', { name: 'Mais filtros' }).click();
    await page.getByTestId('filtro-local').selectOption('25');
    await expect(page.getByText('Mostrando o que está a até 25 km de você.')).toBeVisible();
    await expect(page).toHaveURL(/raio=25/);
    expect(page.url()).not.toContain('-25.4');
    await expect.poll(() => api.last('GET', /^\/api\/v1\/posts$/)?.search.get('radiusKm')).toBe('25');
    expect(api.last('GET', /^\/api\/v1\/posts$/)?.search.get('lat')).toBe('-25.428');
  });

  test('⏳ sem a rota no servidor, o feed diz que aguarda a API em vez de fingir que está vazio', async ({ page, api }) => {
    api.on('GET', /^\/api\/v1\/posts$/, { status: 404, body: { title: 'Não encontrado', status: 404, detail: 'No static resource api/v1/posts.' } });
    await page.goto('/?feed=posts');
    await expect(page.getByTestId('aguarda-api')).toContainText('Posts ainda não chegou ao servidor');
  });
});

test.describe('Alert Feed (OS-34), Profile Feed e Áudio', () => {
  test('alertas: faixa hazard, só fontes verificadas, sem moldura, só compartilhar; vaga com as 4 ações', async ({ page }) => {
    await page.goto('/?feed=alertas');
    await expect(page.getByTestId('faixa-hazard')).toBeVisible();
    await expect(page.getByText('Só fontes oficiais verificadas')).toBeVisible();
    const lista = page.getByTestId('lista-alertas');
    await expect(lista.getByRole('article')).toHaveCount(2);
    const alerta = lista.getByRole('article', { name: 'Chuva forte com risco de alagamento na região metropolitana' });
    await expect(alerta.getByTestId('severidade')).toHaveText('Alerta severo · Chuva forte');
    await expect(alerta.getByTestId('fonte-verificada')).toBeVisible();
    await expect(alerta.getByTestId('curtir')).toHaveCount(0);
    await expect(alerta.getByTestId('compartilhar')).toHaveAccessibleName('Compartilhar, 1,2 mil (1.200 compartilhamentos)');
    await expect(alerta.getByTestId('aviso-alerta')).toHaveText('sem curtidas em alerta oficial');
    await expect(page.getByTestId('card-post-moldura')).toHaveCount(0);
    const vaga = lista.getByRole('article', { name: /back-end Java/ });
    await expect(vaga.getByTestId('curtir')).toBeVisible();
    await expect(vaga.getByTestId('categoria')).toHaveText('Instituição');
    await expectAccessibleInBothThemes(page, 'Alert Feed');
  });

  test('perfis: cards com categoria, local e interesses; filtro por categoria e nome', async ({ page, api }) => {
    await page.goto('/?feed=perfis');
    const lista = page.getByTestId('lista-perfis');
    await expect(lista.getByRole('article')).toHaveCount(8);
    await page.getByTestId('filtro-categoria-VERMELHO').click();
    await expect(lista.getByRole('article')).toHaveCount(2);
    expect(api.last('GET', /^\/api\/v1\/users$/)?.search.getAll('category')).toEqual(['VERMELHO']);
    const defesa = lista.getByRole('article', { name: /Defesa Civil/ });
    await expect(defesa).toContainText('Instituição');
    await expect(defesa.getByText('Conta verificada')).toBeAttached();
    await page.getByTestId('filtro-categoria-VERMELHO').click();
    await page.getByRole('button', { name: 'Mais filtros' }).click();
    await page.getByLabel('Nome').fill('ana');
    await page.getByRole('button', { name: 'Aplicar' }).click();
    await expect(lista.getByRole('article')).toHaveCount(1);
    await lista.getByRole('link', { name: 'Ana Ribeiro' }).click();
    await expect(page).toHaveURL(/\/u\/42$/);
  });

  test('áudio: "em breve" honesto, sem player falso', async ({ page }) => {
    await page.goto('/?feed=audio');
    await expect(page.getByTestId('audio-em-breve')).toContainText('O envio de áudio ainda não existe no servidor');
    await expect(page.getByRole('button', { name: /Reproduzir/ })).toHaveCount(0);
    await expectAccessibleInBothThemes(page, 'Áudio em breve');
  });
});
