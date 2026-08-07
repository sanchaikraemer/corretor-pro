# v1173 — separa análise pedida de aprendizado automático no custo de IA

Depois da v1172 (custo de hoje visível no card de cada conta), o dono desconfiou dos números:
"sanchai fez 2 análises e zuleica 1 e deu tudo isso? não pode..." e "cada análise custava
centavos, como agora passa de 1 real cada?". Ele estava certo em desconfiar — mas a causa não era
o preço da análise ter mudado.

## O que estava acontecendo

O custo mostrado por conta somava DOIS tipos de chamada de IA sem separar:

1. **Análise pedida de propósito** (rota `analise`) — o que o corretor realmente clica pra pedir.
   Continua custando centavos, exatamente como sempre custou.
2. **Aprendizado automático** (rota `inteligencia-observada`) — um processo que roda **sozinho**,
   assim que a pessoa abre o sistema, lendo a carteira de conversas inteira dela pra aprender.
   Isso soma 1 chamada de IA por conversa antiga, de uma vez só — sem nenhum clique do corretor.

Dividir "custo total da conta" por "quantas análises eu lembro de ter pedido" dava um número bem
maior que o custo real de 1 análise, porque a conta de cima incluía as duas coisas misturadas.

## O que mudou

`api/admin-contas.js` (`relatorioUsoIA`) agora classifica CADA chamada numa categoria
(`categoriaDoEvento`): `analise`, `aprendizado`, `transcricao` (áudio) ou `outros`, e devolve o
total separado por categoria (`categoriasHoje`/`categoriasPeriodo`) além do total geral — pra cada
empresa.

No painel:
- O selinho de custo no card de cada conta (v1172) ganhou um título (toque e segure / passe o
  mouse) que já mostra a separação: "2 análise pedida (R$0,20) · 55 aprendizado automático
  (R$9,60)".
- A tabela "Uso de IA por empresa" ganhou colunas próprias: **Análise hoje** / **Aprendizado auto
  hoje** / **Outros hoje**, antes de "Custo total hoje" — pra ver na hora, sem calcular nada, o
  que realmente pesou.

Nada no CÁLCULO do custo mudou — só a separação de onde ele vem. Uma conta sem nenhuma conversa
importada continua sem custo nenhum (não tem o que aprender a partir do nada).

## Testes

`tests/v1173-uso-de-ia-por-categoria.test.mjs` (novo): roda `relatorioUsoIA` de verdade contra um
Supabase de mentira com 1 chamada de análise + 60 de aprendizado automático + 1 de transcrição,
confirma que cada uma cai na categoria certa, e prova em número que o custo de 1 análise isolada é
menor que o custo das 60 chamadas de aprendizado (mesmo em modelo mais barato) — a inflação vinha
do volume do aprendizado, não do preço da análise. Confirma também que uma conta sem eventos não
aparece com custo. `tests/v1172-uso-de-ia-por-conta.test.mjs` ajustado pro novo título do selinho.

## Verificação

- `npm test`: 339 arquivos de teste, todos verdes.
- Chromium headless, `admin-plataforma.html` publicado: tabela com a Zuleica mostrando "1 · R$0,10
  análise" vs "14 · R$2,00 aprendizado auto" e a conta principal "2 · R$0,20 análise" vs "55 ·
  R$9,60 aprendizado auto" — computador e celular, zero erro de JavaScript.

## Arquivos

`api/admin-contas.js` (`categoriaDoEvento`, `relatorioUsoIA` com `categoriasHoje`/
`categoriasPeriodo`), `admin-plataforma.html` (`resumoCategorias`, `NOME_CATEGORIA_USO_IA`, tabela
com colunas por categoria), `tests/v1173-uso-de-ia-por-categoria.test.mjs` (novo),
`tests/v1172-uso-de-ia-por-conta.test.mjs` (ajustado), `package.json`/`package-lock.json`,
`NOTAS-v1173.md`, versão **1172 → 1173**.
