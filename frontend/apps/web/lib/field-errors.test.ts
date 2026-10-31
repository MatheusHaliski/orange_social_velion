import { describe, expect, it } from 'vitest';
import { mapPostErrors, mapProfileErrors, mapRegisterErrors, mapSudoError } from './field-errors';

describe('erros do 422 por campo', () => {
  it('cadastro: frases do RegistrationService e do UserTypeDetailsValidator', () => {
    const out = mapRegisterErrors(
      [
        'Para criar a conta, leia e aceite os Termos de Uso da Velion (versão 2026-10-25.1).',
        'O @usuário deve ter 3 a 30 caracteres: letras minúsculas, números, ponto ou sublinhado.',
        'A senha não pode conter seu e-mail ou @usuário.',
        'Preencha o campo "outletName" da categoria Networking.',
        'CNPJ inválido. Confira os 14 caracteres (o CNPJ pode ter letras desde 2026).',
        'Menores de 16 anos precisam informar o e-mail de um responsável (ECA Digital).',
        'O Orange Social é para maiores de 13 anos.',
        'Campo "foo" não se aplica à categoria Pessoa Física.',
      ],
      { outletName: 'Nome do veículo', cnpj: 'CNPJ' },
    );
    expect(out.fields.acceptTerms).toHaveLength(1);
    expect(out.fields.handle).toHaveLength(1);
    // a senha cita o @usuário, mas é erro de senha
    expect(out.fields.password).toEqual(['A senha não pode conter seu e-mail ou @usuário.']);
    expect(out.fields.outletName).toEqual(['Preencha o campo “Nome do veículo” da categoria Networking.']);
    expect(out.fields.cnpj).toHaveLength(1);
    expect(out.fields.guardianEmail).toHaveLength(1);
    expect(out.fields.dateOfBirth).toHaveLength(1);
    expect(out.general).toEqual(['Campo "foo" não se aplica à categoria Pessoa Física.']);
  });
});

describe('mapProfileErrors', () => {
  it('cada frase do ProfileService vai para o seu campo', () => {
    const out = mapProfileErrors(
      [
        'A bio tem no máximo 150 caracteres.',
        'Até 5 links, cada um começando com https://',
        'Celular no formato internacional, ex.: +5541999990000.',
        'País no formato ISO de 2 letras, ex.: BR.',
        'Preencha o campo "website" da categoria Marketing.',
        'Algo novo que a tela não conhece.',
      ],
      { website: 'Site' },
    );
    expect(Object.keys(out.fields).sort()).toEqual(['bio', 'cellphoneNumber', 'countryOfResidence', 'links', 'website'].sort());
    expect(out.fields.website).toEqual(['Preencha o campo “Site” da categoria Marketing.']);
    expect(out.general).toEqual(['Algo novo que a tela não conhece.']);
  });

  it('modo sudo: o código só vai para o campo do código quando há 2FA', () => {
    expect(mapSudoError('Senha incorreta.', false).fields).toEqual({ password: ['Senha incorreta.'] });
    expect(mapSudoError('Senha ou código do app autenticador incorretos.', true).fields).toHaveProperty('code');
  });
});

describe('mapPostErrors (RF29 · RF28)', () => {
  it('cada frase do PostPublishingService vai para o seu campo, com o rótulo da tela', () => {
    const r = mapPostErrors([
      'Dê um título ao post.',
      'O subtítulo vai até 280 caracteres.',
      'O texto vai até 5000 caracteres.',
      'Envie a foto antes (POST /api/v1/media/uploads) e informe "mediaObjectKey".',
      'Menores de 18 anos não publicam conteúdo 18+ ou sensível.',
      'País em duas letras (ISO 3166), ex.: BR.',
      'Cidade com até 120 caracteres.',
      'Texto com contraste 1,4:1 sobre o container (mínimo 4,5:1). Sugestão: tinta #17120D (14,8:1).',
      'Escolha uma única arte para a moldura: cor, gradiente, cartela, aura, Aura Plus ou arte própria.',
      'Estilo de Aura Hype inválido: use OFF, SCANNER, BRILHO.',
    ]);
    expect(r.fields.title).toEqual(['Dê um título ao post.']);
    expect(r.fields.subtitle).toHaveLength(1);
    expect(r.fields.body).toHaveLength(1);
    expect(r.fields.photo).toEqual(['Envie a foto antes (POST /api/v1/media/uploads) e informe “Foto”.']);
    expect(r.fields.ageRating).toHaveLength(1);
    expect(r.fields.country).toHaveLength(1);
    expect(r.fields.city).toHaveLength(1);
    expect(r.fields.background).toHaveLength(3);
    expect(r.general).toEqual([]);
  });

  it('campo que não está na tela vai para o resumo', () => {
    const r = mapPostErrors(['Dê um título ao post.', 'O Alert Feed abre só para fontes verificadas.'], new Set(['body']));
    expect(r.fields).toEqual({});
    expect(r.general).toHaveLength(2);
  });
});
