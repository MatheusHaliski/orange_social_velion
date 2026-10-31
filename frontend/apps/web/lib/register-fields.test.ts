import { describe, expect, it } from 'vitest';
import { buildTypeDetails, fieldsFor } from './register-fields';

type Cat = Parameters<typeof fieldsFor>[0];
const keys = (type: Cat, sub = '', minor = false) => fieldsFor(type, sub, minor).map((f) => f.key);
const required = (type: Cat, sub = '') =>
  fieldsFor(type, sub, false)
    .filter((f) => f.required)
    .map((f) => f.key)
    .sort();

// mesmas listas do UserTypeDetailsValidator.RULES
describe('campos por categoria', () => {
  it('obrigatórios iguais aos do backend', () => {
    expect(required('VERDE')).toEqual([]);
    expect(required('AMARELO')).toEqual(['outletName', 'role', 'subtype', 'website']);
    expect(required('AZUL')).toEqual(['cnpj', 'contactEmail', 'contactName', 'contactRole', 'legalName', 'segment', 'website']);
    expect(required('LARANJA')).toEqual(['city', 'communityType', 'contactEmail', 'contactName', 'state']);
    expect(required('VERMELHO')).toEqual(
      ['cnpj', 'legalName', 'representativeEmail', 'representativeName', 'representativeRole', 'sector', 'subtype', 'website'].sort(),
    );
    expect(required('PRETO')).toEqual(['organizer', 'subtype']);
  });

  it('PRETO: evento e banco pedem mais', () => {
    expect(required('PRETO', 'EVENT')).toEqual(['eventLocation', 'eventName', 'eventStart', 'organizer', 'subtype']);
    expect(required('PRETO', 'BANK')).toEqual(['bcbCode', 'cnpj', 'organizer', 'subtype']);
  });

  it('e-mail do responsável só para Pessoa Física menor de 16', () => {
    expect(keys('VERDE', '', true)[0]).toBe('guardianEmail');
    expect(keys('VERDE')).not.toContain('guardianEmail');
    expect(keys('AZUL', '', true)).not.toContain('guardianEmail');
  });

  it('type_details só com as chaves da categoria, sem vazios e com o início em ISO', () => {
    const fields = fieldsFor('PRETO', 'EVENT', false);
    const out = buildTypeDetails(fields, { subtype: 'EVENT', organizer: ' Ana ', eventName: 'Festa', eventStart: '2026-12-05T19:00', eventLocation: '', cnpj: 'x' });
    expect(out).toMatchObject({ subtype: 'EVENT', organizer: 'Ana', eventName: 'Festa' });
    expect(out.eventStart).toMatch(/^2026-12-05T\d{2}:00:00Z$/);
    expect(out).not.toHaveProperty('cnpj');
    expect(out).not.toHaveProperty('eventLocation');
  });
});
