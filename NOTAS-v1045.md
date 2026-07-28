# NOTAS v1045 — Política de Privacidade e Termos de Uso

## O problema

A auditoria (seção 07) apontou: o sistema processa dados sensíveis (nome, telefone, conversas
privadas, áudios, interesse financeiro, condição de pagamento, observações do corretor) e envia
parte disso à OpenAI, armazenando tudo no Supabase — mas não existia nenhuma página formal de
privacidade nem termos de uso. Isso não significa, por si só, que o sistema estivesse irregular;
significa que faltava documentação refletindo o funcionamento real, antes de vender em escala.

## A correção

Duas páginas novas, no mesmo estilo visual das telas de conta já existentes:

- **`privacidade.html`** — o que é coletado (do corretor e dos leads dele), pra que é usado, quem
  recebe (OpenAI e Supabase, nomeados), por quanto tempo fica guardado, os direitos garantidos
  pela LGPD (acesso, correção, exclusão, portabilidade — a portabilidade já é real, é o botão
  "Backup" que já existe no sistema), segurança, cookies/armazenamento local.
- **`termos.html`** — o que é o sistema, cadastro e conta (inclusive a regra de uma empresa por
  login, já em vigor), responsabilidades do corretor (inclusive que ELE também é responsável pelos
  dados dos próprios clientes, como controlador — o Corretor Pro atua como operador), o que o
  sistema não garante (a IA sugere, não garante venda), propriedade, cancelamento/exclusão de
  conta, lei aplicável.

As duas se linkam uma à outra e ficam linkadas no rodapé da tela de cadastro ("ao criar conta você
concorda com..."). **Nenhum preço aparece em nenhuma das duas** — CLAUDE.md proíbe informação
comercial cravada no código; o valor cobrado é o que já está configurado dentro do próprio
sistema, não faz parte deste texto.

**As duas páginas têm um aviso visível no topo**: escrevi o conteúdo com fidelidade ao que o
sistema faz de verdade, mas isto não substitui revisão de um advogado antes de considerar
definitivo — em especial os campos marcados como `[preencher]` (razão social/CNPJ do responsável
e e-mail de contato/DPO), que só você tem essa informação.

## Verificação

- Novo teste `tests/v1045-privacidade-e-termos.test.mjs`: confirma que as duas páginas cobrem de
  verdade os pontos exigidos (quem recebe o dado, LGPD, direitos do titular, áudio/WhatsApp como
  origem dos dados), que nenhum preço aparece nos Termos, que as páginas se linkam e que o
  cadastro linka as duas, e que as duas estão publicadas (`build.js`) e sem cache antigo
  (`vercel.json`) — mesmo padrão das demais telas de conta.
- `npm test`: suíte inteira verde.
- `npm run build`: build limpo, 26 arquivos publicados (24 + as 2 páginas novas).

## O que ainda falta (fora do meu alcance)

Preencher `[razão social / CNPJ ou CPF do responsável]` e `[e-mail de contato/DPO]` nas duas
páginas, e — o mais importante — pedir uma revisão jurídica de verdade antes de tratar este texto
como definitivo. Ambos são passos que só você consegue dar.

## Arquivos

`privacidade.html` (novo), `termos.html` (novo), `cadastro.html` (links no rodapé), `build.js`
(publica as duas páginas), `vercel.json` (regra de cache), `tests/v1045-privacidade-e-termos.test.mjs`
(novo), `package.json`/`package-lock.json` (versão + script `test`), `NOTAS-v1045.md`, versão
**1044 → 1045**.
