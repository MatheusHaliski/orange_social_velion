// As 6 categorias de usuário (UserCategoryEnum) com cor (token), glifo VSL e rótulo: a cor nunca é o único sinal
// (docs/DESIGN_SYSTEM.md §4; docs/TAXONOMIA_ATORES_E_CARDS.md §2).
import type { CategoryCode } from '@orange-social/api';

export type GlyphShape = 'diamond' | 'star' | 'triangle' | 'hexagon' | 'rectangle' | 'double-circle';

export interface CategoryInfo {
  code: CategoryCode;
  /** Rótulo curto (o mesmo de UserCategoryEnum.label). */
  label: string;
  glyph: GlyphShape;
  /** Nome do glifo por extenso, para o leitor de tela e a legenda. */
  glyphName: string;
  /** Para quem é (cadastro, opção de tipo de usuário). */
  description: string;
  /** Idade mínima para criar a conta (AgePolicy + PESQUISA_DADOS_USUARIO §1). */
  minAge: 13 | 18;
  /** A conta nasce com o selo PENDING (VERMELHO; PRETO só se for banco). */
  seal: 'NEVER' | 'ALWAYS' | 'BANK';
}

export const CATEGORIES: readonly CategoryInfo[] = [
  {
    code: 'VERDE',
    label: 'Pessoa Física',
    glyph: 'diamond',
    glyphName: 'losango',
    description: 'Indivíduo comum. A partir de 13 anos; menores de 16 com e-mail do responsável.',
    minAge: 13,
    seal: 'NEVER',
  },
  {
    code: 'AMARELO',
    label: 'Networking',
    glyph: 'star',
    glyphName: 'estrela',
    description: 'Imprensa, fórum, noticiário, blog e networking.',
    minAge: 18,
    seal: 'NEVER',
  },
  {
    code: 'AZUL',
    label: 'Marketing',
    glyph: 'triangle',
    glyphName: 'triângulo',
    description: 'Agências, anunciantes e empresas de criadores.',
    minAge: 18,
    seal: 'NEVER',
  },
  {
    code: 'LARANJA',
    label: 'Comunidade',
    glyph: 'hexagon',
    glyphName: 'hexágono',
    description: 'Igrejas, clubes esportivos, clubes sociais, coletivos e grupos.',
    minAge: 18,
    seal: 'NEVER',
  },
  {
    code: 'VERMELHO',
    label: 'Instituição',
    glyph: 'rectangle',
    glyphName: 'retângulo',
    description: 'Governo, empresas e marcas. Publica como instituição depois da verificação.',
    minAge: 18,
    seal: 'ALWAYS',
  },
  {
    code: 'PRETO',
    label: 'Especial',
    glyph: 'double-circle',
    glyphName: 'círculo duplo',
    description: 'Amigos próximos, eventos, situações especiais e bancos.',
    minAge: 18,
    seal: 'BANK',
  },
];

export const CATEGORY_CODES = CATEGORIES.map((c) => c.code);

export function category(code: string): CategoryInfo {
  return CATEGORIES.find((t) => t.code === code) ?? CATEGORIES[0]!;
}

export function isCategoryCode(v: string): v is CategoryCode {
  return (CATEGORY_CODES as string[]).includes(v);
}
