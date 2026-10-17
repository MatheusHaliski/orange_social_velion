# Pesquisa — dados de usuário por tipo de perfil, configurações, 2FA, sessão e exclusão

Pesquisa de 17/10/2026, feita por três agentes em paralelo:

1. Ecossistema Meta: Facebook, Instagram, Páginas e Grupos.
2. LinkedIn, X, TikTok e YouTube, mais verificação no Brasil.
3. Configurações, 2FA, sessões, limite de tentativas e exclusão de conta (OWASP, NIST SP 800-63B-4 e RFC 6238).

As fontes estão no fim do documento. Itens marcados **(não confirmado)** vieram só de fonte secundária ou não puderam ser checados na página oficial, que estava fora do ar ou devolveu 403 ou 503.

## 1. Conclusões que viram regra no Orange

| # | Regra | Por quê |
|---|---|---|
| 1 | Cadastro mínimo: **nome de exibição, e-mail verificado, senha, data de nascimento, tipo de usuário e aceite dos Termos de Uso da Velion** | É o que Facebook, Instagram, X e TikTok pedem; o resto é perfil opcional (LGPD Art. 6º, III — necessidade) |
| 2 | **Idade mínima 13 anos**; tela de data de nascimento neutra | Padrão de todas as redes pesquisadas |
| 3 | Menores de 16: conta vinculada a um responsável e configurações mais protetivas, ligadas por padrão e travadas | ECA Digital (Lei 15.211/2025), art. 24, em vigor desde 17/03/2026. A vinculação fica para o OS-49 |
| 4 | **Não coletar** religião, visão política nem orientação sexual no perfil público; endereço só para organizações | Dado sensível (LGPD Art. 11); a Meta removeu esses campos em 12/2022 |
| 5 | Visibilidade **por campo** (Público · Seguidores · Só eu), com padrão restritivo e ano de nascimento privado | Modelo do Facebook (campo a campo) e do X (dia/mês e ano separados) |
| 6 | Organização (AZUL, VERMELHO, LARANJA com CNPJ, banco) é **sempre pública** | Instagram: conta profissional é sempre pública |
| 7 | **Selo de identidade ≠ assinatura paga**; guardar só o resultado e a data da verificação, nunca o documento | Lição do selo azul do X e do fluxo do LinkedIn, em que só o parceiro vê o documento |
| 8 | Validador de **CNPJ alfanumérico** | IN RFB 2.229/2024; em uso desde 07/2026 (12 posições alfanuméricas + 2 DV; valor = ASCII − 48; módulo 11). A regex `\d{14}` deixou de servir |
| 9 | CPF **não** é pedido no cadastro; só para selo ou recuperação, de preferência via gov.br | Minimização |
| 10 | Trocar nome ou data de nascimento de conta verificada **exige nova verificação** | YouTube, LinkedIn e Meta Verified |
| 11 | Não importar agenda de contatos nem coletar sinais de Wi-Fi/Bluetooth; não inferir localização por IP para perfil | É o que a Meta faz e o Orange não deve copiar |
| 12 | Rótulo **"Publicidade / Parceria paga" por publicação**, obrigatório para AZUL | TikTok "Paid partnership", YouTube "Inclui promoção paga" |

> ⚠️ **Conflito com a especificação original:** os 19 campos de `VSusercontrolist` incluem
> `sexual_preference` e `address` para todos. Pela regra 4, o Orange mantém esses campos **opcionais, privados e fora do
> perfil público**. `sexual_preference` só é gravado com consentimento específico (Art. 11, I —
> `SENSITIVE_PROFILE_DATA`, RF3) e cifrado. Recomendação: **remover `sexual_preference`** na próxima revisão do RF1.
> Essa decisão é do produto.

## 2. Campos comuns a todos os tipos

| Campo | Cadastro? | Visibilidade padrão | Observação |
|---|---|---|---|
| Nome de exibição | Obrigatório | Público | Pessoa: nome; organização: nome fantasia |
| E-mail | Obrigatório (verificado por código) | Só eu | Login; normalizado em minúsculas |
| Senha | Obrigatória | — | Argon2id; 12 a 128 caracteres; não pode conter o e-mail |
| Data de nascimento | Obrigatória (pessoa) | Só eu (ano) | Para organização é a idade do **responsável** |
| Tipo de usuário (6 cores) | Obrigatório | Público (glifo + rótulo) | VERMELHO e PRETO (banco) passam por verificação manual |
| Aceite dos Termos de Uso da Velion | Obrigatório (caixa desmarcada) | — | Versão, data, canal e IP com hash (`terms_acceptance`) |
| Consentimentos opcionais | Todos **desligados** | — | `consent_event` (RF3) |
| Foto, bio (até 150 caracteres), links (até 5), cidade, pronomes | Perfil, opcional | Configurável | Padrões de Instagram e LinkedIn |
| Celular, e-mail de recuperação | Perfil, opcional | Só eu | Recuperação; **sem 2FA por SMS** |
| Gênero | Perfil, opcional | Só eu | Exigir gênero no cadastro é coleta além da finalidade |

## 3. Campos por tipo de usuário

Os campos específicos ficam em `type_details` (JSONB validado por tipo) para não inflar a tabela.
"Privado" significa visível só para o titular e para a moderação.

### VERDE · pessoa física
| Campo | Obrigatório? | Visibilidade | Observação |
|---|---|---|---|
| Pronomes | Não | Configurável | Até 4 de uma lista (Instagram) |
| Cidade/UF | Não | Configurável | Filtro Local (PostGIS) |
| Site | Não | Público | — |
| Interesses e hobbies | Não | Configurável | Taxonomia fixa |
| Trabalho e formação | Não | Configurável | Como no LinkedIn |
| Vínculo com responsável | **Sim se menor de 16** | Privado | ECA Digital art. 24 (OS-49) |

### AMARELO · imprensa, fórum, blog, networking
| Campo | Obrigatório? | Visibilidade | Observação |
|---|---|---|---|
| Subtipo: veículo · blog · fórum · networking | Sim | Público | — |
| Nome do veículo ou publicação | Sim | Público | — |
| Site | Sim | Público | Domínio verificável |
| Função: repórter, editor, colunista, fundador… | Sim (pessoa) | Público | — |
| E-mail corporativo | Só para o selo | Privado | Código enviado ao domínio |
| Registro profissional (MTb) | Não | Privado | Sinal extra para o selo; muitos independentes não têm |
| CNPJ do veículo | Não | Público (razão social) | — |

### AZUL · marketing e propaganda
| Campo | Obrigatório? | Visibilidade | Observação |
|---|---|---|---|
| CNPJ | Sim | Público | Alfanumérico; situação cadastral ATIVA |
| Razão social | Sim | Público | Conferida na consulta pública de CNPJ |
| Nome fantasia | Não | Público | — |
| Site | Sim | Público | — |
| Responsável: nome, cargo, e-mail | Sim | Privado | — |
| Segmento (agência, anunciante, influenciador PJ) | Sim | Público | — |

### LARANJA · comunidade (igrejas, clubes esportivos, grupos)
| Campo | Obrigatório? | Visibilidade | Observação |
|---|---|---|---|
| Tipo de comunidade (igreja, clube esportivo, coletivo, grupo informal…) | Sim | Público | Mesma taxonomia de `typeOfCommunity` |
| Cidade/UF | Sim | Público | — |
| Responsável adulto: nome e contato | Sim | Privado | — |
| CNPJ | Não (grupo informal não tem) | Público | Exigido para o selo; natureza jurídica 322-0 (religiosa) ou 399-9 (associação) |
| Endereço da sede | Não | Configurável | — |
| Regras e perguntas de entrada (até 3) | Não | Público | Modelo dos Grupos do Facebook |

### VERMELHO · instituição (governo, empresas, marcas)
| Campo | Obrigatório? | Visibilidade | Observação |
|---|---|---|---|
| Subtipo: governo · empresa · marca | Sim | Público | — |
| CNPJ | Sim | Público | Governo: natureza jurídica do grupo 1xx |
| Razão social | Sim | Público | — |
| Site / domínio | Sim | Público | `.gov.br`, `.jus.br`, `.leg.br` e `.mp.br` são fortes sinais para o selo de governo |
| Setor | Sim | Público | — |
| Representante legal: nome, cargo, e-mail | Sim | Privado | Declaração de que pode agir em nome da instituição |
| Tamanho, sede | Não | Público | — |

Publicar no Alert Feed exige VERMELHO **verificado** (`canPublishOfficialAlerts`).

### PRETO · especial (amigos próximos, eventos, situações especiais, bancos)
| Campo | Obrigatório? | Visibilidade | Observação |
|---|---|---|---|
| Subtipo: amigos próximos · evento · situação especial · banco | Sim | Configurável | Nenhuma rede tem tipo equivalente; resolvem com listas e privacidade |
| Evento: nome, data e hora, local | Sim (evento) | Público ou só convidados | — |
| Organizador ou conta responsável | Sim | Público | — |
| Banco: CNPJ e código no Banco Central | Sim (banco) | Público | **Selo obrigatório** antes de publicar (risco de golpe) |
| Expira em | Não | Privado | Contas de evento temporárias |

## 4. Configurações (9 seções)

Modelo comum a Meta (Central de Contas), X, LinkedIn e TikTok: segurança separada de privacidade e
excluir conta no fim, longe dos botões comuns.

1. **Conta** — nome, @, e-mail, data de nascimento, tipo de usuário.
2. **Senha e segurança** — senha, **2FA**, sessões ativas, alertas de login, histórico de segurança.
3. **Privacidade** — perfil público/privado, quem comenta, menciona e envia mensagem; consentimentos (RF3).
4. **Bloqueados e silenciados.**
5. **Notificações.**
6. **Preferências de conteúdo** — feed inicial, conteúdo sensível.
7. **Bem-estar** — lembrete de tempo de uso, modo descanso.
8. **Exibição e acessibilidade** — tema (sistema/escuro/claro), tamanho da fonte, reduzir movimento, idioma.
9. **Seus dados** — baixar dados (Art. 18, V) e **excluir conta**.

Para contas de menores, as opções mais protetivas vêm por padrão e há uma seção "Supervisão" (ECA Digital).

## 5. Autenticação em dois fatores

| Item | Valor no Orange | Base |
|---|---|---|
| Métodos | App autenticador (TOTP); passkeys em seguida. **Sem SMS** | NIST 800-63B-4 trata telefone (SMS/voz) como "restrito"; OWASP MFA |
| TOTP | SHA-1, 6 dígitos, passo de 30 s; aceita o passo anterior, o atual e o seguinte | RFC 6238 (uma janela de deriva) |
| Anti-replay | Guarda o último passo aceito e recusa código igual ou anterior | NIST: "accept a given OTP only once" |
| Segredo | 160 bits (`SecureRandom`), cifrado com AES-256-GCM; nunca devolvido após a ativação | NIST: chave ≥ 112 bits |
| Ativação | Senha → QR `otpauth://` + chave em texto → confirmar com código → **10 códigos de recuperação** | Google: 10 códigos |
| Códigos de recuperação | 10 caracteres base32 sem ambíguos (`xxxxx-xxxxx`), Argon2id, uso único; novo conjunto invalida o anterior | NIST look-up secrets |
| Login em duas etapas | Senha correta gera desafio de **5 min / 5 tentativas**; sessão completa só depois do código, com id rotacionado | OWASP Session |
| Desativar ou regenerar | Exige senha + código; avisa por e-mail | OWASP MFA |
| Dispositivo confiável (30 dias) | Fica para depois | — |

## 6. Sessão, login e logout

| Item | Valor no Orange | Base |
|---|---|---|
| Sessão | **Opaca no Valkey** (Spring Session indexado); nunca JWT nem localStorage | ADR-03, OWASP |
| Cookie | Sem `Max-Age` (morre ao fechar o navegador), `HttpOnly`, `Secure`, `SameSite=Lax`; em produção `__Host-orange_session` | OWASP Session |
| Aba anônima | Tem sua própria coleção de cookies: abre **deslogada** e o login nela não vaza para a janela normal | Comportamento dos navegadores |
| Ocioso / absoluto | **60 min / 24 h** (checado no servidor a cada requisição) | NIST AAL2: ≤ 1 h ocioso, ≤ 24 h absoluto |
| Fixação de sessão | Id novo no login e depois do 2FA | OWASP |
| Logout | `POST /api/v1/auth/logout` invalida no servidor e apaga o cookie; outras abas saem via `BroadcastChannel('orange-auth')` e qualquer 401 leva ao login | OWASP |
| Sessões ativas | Lista com navegador, último acesso e "esta sessão"; "Sair" e "Sair de todos os outros" | OWASP |
| CSRF | `csrf.spa()` (Spring Security 7): cookie `XSRF-TOKEN`, cabeçalho `X-XSRF-TOKEN` | Spring Security 7 |
| Modo sudo | Trocar senha ou e-mail, mexer no 2FA e excluir conta pedem a senha (e o código, se houver 2FA) | OWASP / NIST |
| Tentativas por conta | A partir da 5ª falha em 15 min: espera progressiva (1, 2, 4… s) até 15 min | OWASP Authentication; NIST ≤ 100 |
| Tentativas por IP | 20/min e 100/h → `429` + `Retry-After` | OWASP |
| Mensagens | Neutras: "E-mail ou senha incorretos."; mesmo custo de hash para conta inexistente | OWASP |

## 7. Exclusão de conta com reativação em 30 dias

| Rede | Carência | Reativar |
|---|---|---|
| Facebook | 30 dias ("varia por região"); remoção efetiva em até 90 dias | Login + "Cancelar exclusão" |
| Instagram | 30 dias; conteúdo invisível no prazo | Login **(não confirmado na ajuda oficial)** |
| X | 30 dias de desativação, depois exclusão | Login |
| TikTok | 30 dias **(não confirmado)** | Login |
| LinkedIn | 14 dias para reabrir | Login |

Decisão do Orange:

- **30 dias** no estado `PENDING_DELETION`. O perfil some na hora e **todas as sessões são revogadas**.
- Entrar no prazo mostra a tela "Reativar conta".
- Vencido o prazo, o job diário roda a saga de eliminação (RF23).
- Ficam guardados os registros de acesso por 6 meses (Marco Civil, Art. 15), que se encaixam no LGPD Art. 16, I.
- Confirmação com senha (+2FA).
- O modal é um `role="alertdialog"` com foco inicial em "Cancelar" e explica:
  - o que será apagado;
  - o que continua existindo;
  - como reativar;
  - o link para baixar os dados antes.

## 8. O que não foi confirmado

- Campos atuais de "Detalhes sobre você" e "Hobbies" do Facebook.
- Público padrão de cada campo.
- Se o cadastro atual da Meta pede pronomes.
- Meta Verified for Business no Brasil.
- Se o TikTok ainda tem conta de criador separada.
- Regra atual de mensagens diretas para 16–17 anos.
- Exigência de telefone para o selo azul do X.
- Visibilidade dos pronomes no LinkedIn.
- Situação legal do registro MTb.
- Endpoints oficiais BrasilAPI/Serpro.
- Regra federal atual do `.gov.br`.
- Texto literal dos artigos do ECA Digital: o Planalto devolveu 503.
- Corte "até 16" vs. "menor de 16".
- Calendário de fases da ANPD.
- Prazo de reabertura do TikTok e do Instagram nas páginas oficiais.

## 9. Fontes

**Meta**
- Criar conta: https://www.facebook.com/help/188157731232424
- Perfil: https://www.facebook.com/help/1017657581651994
- Páginas: https://www.facebook.com/help/104002523024878
- Grupos: https://www.facebook.com/help/167970719931213
- Desativar conta: https://www.facebook.com/help/214376678584711
- Excluir conta do Facebook: https://www.facebook.com/help/224562897555674
- Excluir conta do Instagram: https://www.facebook.com/help/instagram/139886812848894
- Conta profissional do Instagram: https://www.facebook.com/help/instagram/502981923235522
- Política de privacidade: https://mbasic.facebook.com/privacy/policy/printable/
- Meta Verified: https://www.meta.com/meta-verified/
- Medidas no Brasil (ECA Digital): https://about.fb.com/br/news/2026/03/nossas-medidas-para-dar-apoio-as-familias-no-brasil/
- Contas de adolescentes: https://about.fb.com/news/2024/09/instagram-teen-accounts/
- Remoção de campos do perfil (2022): https://techcrunch.com/2022/11/17/facebook-removing-profile-information-fields-religious-political-views
- Até 5 links na bio: https://techcrunch.com/2023/04/18/instagram-takes-on-linktree-and-others-with-support-for-up-to-5-links-in-bio/

**LinkedIn**
- https://www.linkedin.com/help/linkedin/answer/140551
- https://www.linkedin.com/help/linkedin/answer/a543852
- https://www.linkedin.com/help/linkedin/answer/a6275638
- https://www.linkedin.com/help/linkedin/answer/a548106

**X**
- Rótulos de perfil: https://help.x.com/en/rules-and-policies/profile-labels
- Selo cinza: https://help.x.com/en/using-x/grey-checkmark
- Selo azul: https://help.x.com/en/managing-your-account/about-x-bluecheck
- Visibilidade do aniversário: https://help.x.com/en/safety-and-security/birthday-visibility-settings
- Desativar conta: https://help.x.com/managing-your-account/how-to-deactivate-x-account

**TikTok**
- Guia para responsáveis: https://www.tiktok.com/safety/en/tools-and-guides/guardians-guide
- Verificação de empresas: https://ads.tiktok.com/help/article/about-business-verification
- Divulgação de conteúdo comercial: https://ads.tiktok.com/help/article/about-the-content-disclosure-setting-for-creators

**YouTube**
- https://support.google.com/youtube/answer/3046484
- https://support.google.com/youtube/answer/154235
- https://support.google.com/youtube/answer/3545195

**Segurança**
- NIST SP 800-63B-4, sessão: https://pages.nist.gov/800-63-4/sp800-63b/session/
- NIST SP 800-63B-4, níveis de garantia (AAL): https://pages.nist.gov/800-63-4/sp800-63b/aal/
- NIST SP 800-63B-4, autenticadores: https://pages.nist.gov/800-63-4/sp800-63b/authenticators/
- OWASP Session Management: https://cheatsheetseries.owasp.org/cheatsheets/Session_Management_Cheat_Sheet.html
- OWASP MFA: https://cheatsheetseries.owasp.org/cheatsheets/Multifactor_Authentication_Cheat_Sheet.html
- OWASP Authentication: https://cheatsheetseries.owasp.org/cheatsheets/Authentication_Cheat_Sheet.html
- RFC 6238: https://datatracker.ietf.org/doc/html/rfc6238
- Spring Security 7, CSRF: https://docs.spring.io/spring-security/reference/7.0/servlet/exploits/csrf.html
- Google, códigos de backup: https://support.google.com/accounts/answer/1187538

**Brasil**
- Verificação de idade (Exame): https://exame.com/tecnologia/examelab/verificacao-de-idade-nas-redes-o-que-o-eca-digital-exige-e-como-funciona-em-cada-app/
- ECA Digital (Migalhas): https://www.migalhas.com.br/depeso/453130/eca-digital-redefine-deveres-das-plataformas-no-brasil
- ECA Digital (Mayer Brown): https://www.mayerbrown.com/pt/insights/publications/2026/04/enforcement-of-brazils-eca-digital-introduces-new-obligations-for-companies
- CNPJ alfanumérico (Serpro): https://serpro.gov.br/menu/noticias/noticias-2024/cnpj-alfanumerico
- Dígito verificador do CNPJ alfanumérico: https://valorfinal.com.br/guia/cnpj-alfanumerico-digito-verificador
- API Consulta CNPJ (Conecta gov.br): https://www.gov.br/conecta/catalogo/apis/consulta-cnpj
- LGPD: https://www.planalto.gov.br/ccivil_03/_ato2015-2018/2018/lei/l13709.htm
- Marco Civil da Internet: https://www.planalto.gov.br/ccivil_03/_ato2011-2014/2014/lei/l12965.htm
