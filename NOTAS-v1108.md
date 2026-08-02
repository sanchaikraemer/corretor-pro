# NOTAS v1108 — Teste grátis: 10 análises/dia e o limite virou momento de venda

## O que o dono pediu

> "Diminua pra dez análises por dia [no teste grátis] ... com mensagem após as 10 análises
> (você atingiu o limite de 10 análises por dia, para limite estendido contrate o pacote pro
> pelo whats abaixo) e botão com meu número para enviar msg direto pra negociarmos e vender
> e liberar."

Primeira mudança pensada 100% pra **comercializar** o produto.

## O que mudou

1. **Teto do teste grátis: 25 → 10 análises por dia** (`LIMITE_ANALISES_IA_DIA_TESTE_PADRAO`,
   em `api/_pipeline.js`). A variável de ambiente `CORRETOR_PRO_LIMITE_ANALISES_DIA_TESTE`
   continua mandando se estiver cadastrada na Vercel — conferir lá se o teto novo não valer.
   Conta paga segue com o teto de segurança de 200/dia e o aviso neutro de sempre.

2. **Bater no limite durante o teste virou convite de contratação.** A mensagem agora é:
   *"Você atingiu o limite de 10 análises por dia do teste grátis. Para limite estendido,
   contrate o pacote Pro pelo WhatsApp abaixo."* — acompanhada de um **botão verde
   "Falar no WhatsApp e liberar o Pro"** que abre conversa direta no WhatsApp comercial
   (54 99901-3331), já com a mensagem pronta: *"Olá! Atingi o limite de análises do teste
   grátis do Corretor Pro e quero contratar o pacote Pro."*

3. **Onde o botão aparece:** no resultado da importação, na análise do lead (quando a análise
   bloqueada ficou gravada) e no "Reanalisar com memória". A reanálise bloqueada por limite
   **continua não sobrescrevendo** a análise boa que o lead já tinha (regra da v750) — ela só
   avisa e mostra o botão.

4. O número comercial fica em um lugar só (`whatsComercialPlataforma()`, em `api/_pipeline.js`),
   com a variável `CORRETOR_PRO_WHATS_COMERCIAL` como override — o app recebe o número do
   servidor junto do aviso, nunca o tem cravado na tela. É o número do dono do produto
   (plataforma), não de corretor/cliente — não fere a regra "nenhum dado comercial de lead
   cravado no código".

## Por que 10 está certo (da pesquisa da madrugada, `NOTAS-v1107.md` + PDF)

Os líderes americanos usam o próprio limite como vendedor: o convite aparece exatamente na
hora em que a pessoa mais quer usar o produto. 10/dia deixa o corretor sentir o valor por uma
semana inteira (até 70 análises no teste) e faz quem usa de verdade esbarrar no convite.

## Validação

| Verificação | Resultado |
|---|---|
| Suíte completa | 282 testes verdes (novo: `v1108-limite-teste-10-e-convite-whatsapp`) |
| `npm run build` | ok, versão 1108 |
| Navegador de verdade | aviso + botão verde renderizados em 390px e 1280px |

O teste novo cobre: teto padrão 10 (com env mandando), número comercial padrão + override,
`emTeste` no verificador de limite (servidor de mentira, contas teste × ativa), convite
condicionado ao teste (conta paga nunca vê botão), e o link `wa.me` gerado pela função real.

## Arquivos alterados

**Código:** `api/_pipeline.js`, `api/reanalisar-lead.js`, `app.js`

**Documentação:** `ESTADO-ATUAL.md` (seção de variáveis), `NOTAS-v1108.md` (novo)

**Versão:** `package.json`, `package-lock.json`

**Testes (novo):** `tests/v1108-limite-teste-10-e-convite-whatsapp.test.mjs`
