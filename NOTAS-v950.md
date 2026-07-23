# v950 — início da revisão completa: regex de acento frágil em `_normNome`

## Contexto

Início da revisão linha a linha de todo o sistema (pedido do dono, 2026-07-23), registrada em
`REVISAO-COMPLETA.md`. Primeiro arquivo revisado: `api/_persistence.js` (869 linhas).

## O que mudou

`_normNome` (usada para comparar nomes de cliente na deduplicação de leads) removia acentos com
`.replace(/[̀-ͯ]/g, "")` — uma classe de regex escrita com os caracteres Unicode combinantes
*literais* dentro do código-fonte (U+0300 a U+036F), em vez do escape `̀-ͯ`. Funciona
igual hoje, mas é frágil: caracteres combinantes no meio do código-fonte são fáceis de corromper
num copy-paste ou numa ferramenta que normalize o arquivo de forma diferente, e a mesma função
`normalizeKey` mais abaixo no MESMO arquivo já usa a forma seguro (`̀-ͯ`) — ou seja,
duas normas coexistindo no mesmo arquivo pro mesmo propósito.

Troquei para o escape `̀-ͯ`, idêntico em comportamento, sem depender de caracteres
especiais sobrevivendo intactos no arquivo-fonte.

## Achado maior (mesmo padrão espalhado pelo projeto)

O mesmo padrão frágil `[̀-ͯ]` (caracteres literais em vez de `̀-ͯ`) também aparece em:
`api/criar-upload-url.js:105`, `api/_pipeline.js:1712,1986`, `app.js:3703,7822,8299,9482`. Registrado
em `REVISAO-COMPLETA.md` para correção quando a revisão chegar nesses arquivos — mesmo risco, mesma
correção mecânica, sem mudança de comportamento.

## Outros achados nesta revisão (registrados, não corrigidos — fora do escopo seguro de hoje)

- `_buscarProcessamentoExistenteV681` e `buscarAvatarAnterior` varrem até 5000/500 linhas da tabela
  `whatsapp_processamentos` em memória pra achar duplicata por telefone/nome. Funciona hoje, mas é um
  limite real de escala: leads mais antigos que isso ficam invisíveis pra deduplicação conforme o
  volume cresce. Precisa de busca indexada no banco (por telefone/nome), não decisão de uma correção
  isolada — registrado pra decisão futura.
- `persistProcessingResult` retorna `ok:true` baseado só no registro de `whatsapp_processamentos`
  salvar — se as tabelas legadas `leads`/`direciona_leads` falharem no upsert, a falha só aparece em
  `warnings`, não impede o `ok:true`. Como a carteira do app lê exclusivamente de
  `whatsapp_processamentos` (confirmado em `listRecentProcessings`), isso hoje não parece causar perda
  de dado visível ao corretor — mas vale confirmar se alguma outra parte do sistema depende dessas
  tabelas legadas antes de mudar o comportamento de erro.

## Verificação

- `npm test` verde (suíte completa).
- `node build.js` não roda mudança de UI nesta versão — só backend/persistência.

## Arquivos
- `api/_persistence.js` (`_normNome` — regex de acento), `package.json`/`package-lock.json`,
  `NOTAS-v950.md`, `REVISAO-COMPLETA.md` (checklist atualizado), versão **949 → 950**.
