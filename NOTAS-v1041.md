# NOTAS v1041 — Teto de IA bem menor durante o teste grátis (achado 6.3 da auditoria)

## O problema

Uma conta em teste grátis (7 dias, sem pagar nada) tinha exatamente o mesmo teto diário de
análises de IA que uma conta paga: 200 por dia. Isso torna criar contas de teste — mesmo sem
nenhum outro truque — um jeito barato de consumir IA de graça: 200 análises por dia, de graça,
por 7 dias, é custo real saindo do seu bolso sem nenhum contrapeso.

## A correção

`verificarLimiteDiario` (a mesma trava de segurança da v1013) agora recebe um segundo teto,
menor, específico pra contas em teste. Assim que a conta é criada, ela já nasce com esse teto
reduzido (25 análises por dia, por padrão); no exato momento em que você marca a conta como "Ativo"
(pago) no painel administrativo, ela passa a usar o teto normal de 200 — automático, sem precisar
fazer mais nada.

Os dois números são configuráveis, sem precisar mexer em código:
- `CORRETOR_PRO_LIMITE_ANALISES_DIA` — teto normal (padrão 200/dia).
- `CORRETOR_PRO_LIMITE_ANALISES_DIA_TESTE` — teto durante o teste grátis (padrão 25/dia).

Continua sendo uma rede de segurança técnica, não uma trava de plano comercial: 25 análises por
dia já é mais do que qualquer corretor testando o sistema de verdade usaria num dia normal.

## Duas ações que só você consegue fazer (o código já está pronto pra elas)

A auditoria também recomendou duas travas que ficam fora do meu alcance — são ajustes dentro do
painel do Supabase, e nem chave de API resolve isso, é literalmente um botão que só quem tem
acesso à conta consegue clicar:

1. **Confirmação de e-mail obrigatória no cadastro.** Hoje, quem se cadastra já entra
   direto, sem confirmar o e-mail — então uma pessoa pode criar várias contas com endereços de
   e-mail inventados/descartáveis. **O código do cadastro (`cadastro.html`) já está pronto pra
   funcionar dos dois jeitos** — inclusive já trata corretamente o caso "aguardando confirmação".
   Pra ativar: Supabase → seu projeto → **Authentication → Providers → Email** → ligue a opção
   **"Confirm email"**. Depois disso, todo cadastro novo vai exigir clicar num link recebido por
   e-mail antes de poder criar a empresa.
2. **Captcha na tela de cadastro**, pra dificultar cadastro automatizado por robô/script. O
   Supabase tem suporte pronto a isso (hCaptcha ou Cloudflare Turnstile), mas exige criar uma
   conta grátis num desses provedores pra conseguir uma "chave de site" — não fiz isso agora
   porque é a criação de uma conta/credencial externa nova, e prefiro confirmar com você antes
   (ver CLAUDE.md: mudança de configuração externa sensível pede autorização explícita). Se
   quiser, na próxima eu já deixo isso pronto — só preciso que você crie a conta grátis no
   hCaptcha (2 minutos) e me passe a chave, ou que confirme que quer que eu te explique o passo a
   passo pra você mesmo configurar direto no painel do Supabase.

## O que fica de fora, por decisão técnica

Não implementei bloqueio por IP/dispositivo (ex.: "no máximo 1 conta de teste por IP"). Esse tipo
de trava tem efeito colateral real — várias pessoas de uma mesma imobiliária, atrás do mesmo
roteador/Wi-Fi, tomariam bloqueio umas das outras por engano — e pra fazer direito precisaria de
um serviço externo de reputação de IP (mais uma conta/custo novo). A combinação de restrição
única por login (v1040) + teto de IA bem mais baixo durante o teste (esta versão) já reduz bastante
o interesse em abusar, sem esse risco de bloquear cliente de verdade.

## Verificação

- Novo teste `tests/v1041-limite-menor-durante-teste.test.mjs`: confirma que uma empresa em teste
  cai no teto reduzido, uma empresa ativa nunca é afetada pelo teto de teste, o comportamento
  antigo (sem o teto novo) continua idêntico quando o chamador não pede o comportamento novo,
  organização sem status reconhecido nunca é bloqueada por engano, o teto reduzido realmente
  bloqueia (não é só um número decorativo), e a variável de ambiente do teto de teste funciona com
  o mesmo padrão de segurança das demais.
- `npm test`: suíte inteira verde (incluindo o teste da v1013 ajustado pra nova assinatura da
  função — comportamento idêntico, só a forma de chamar ganhou um parâmetro a mais).
- `npm run build`: build limpo.

## Arquivos

`api/_pipeline.js` (`verificarLimiteDiario`, `limiteAnalisesIADoDiaTeste`),
`tests/v1041-limite-menor-durante-teste.test.mjs` (novo),
`tests/v1013-limite-diario-uso-ia.test.mjs` (ajustado), `package.json`/`package-lock.json`
(versão + script `test`), `NOTAS-v1041.md`, versão **1040 → 1041**.
