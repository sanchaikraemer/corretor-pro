# NOTAS v1042 — Última rota que confiava só na chave compartilhada corrigida

## O que eu estava verificando

Item 3 da lista: reduzir a dependência da chave antiga (`CORRETOR_PRO_API_KEY`). Antes de decidir
o que mais fazer, revisei toda rota do sistema procurando alguma que ainda confiasse só nessa
chave, sem checar de qual empresa é o pedido — o mesmo tipo de buraco corrigido na v1037.

## O que achei

`api/restaurar-leads.js` (uma ferramenta de restauração de leads de uma base bem antiga, de antes
das contas por empresa) só checava a chave. Como o app anexa essa chave automaticamente em toda
chamada de qualquer corretor logado (mesmo comportamento que causou o vazamento da v1037), e essa
função fica exposta até pelo console do navegador (`window.restaurarLeadsAntigos`), **qualquer
corretor, de qualquer empresa, conseguia disparar — inclusive forçado — uma reescrita dos dados
da empresa original** a partir das tabelas legadas. Na prática, o risco real era baixo (os dados
de origem são sempre os mesmos, fixos, não vêm de quem chama), mas com `force:true` dava pra
sobrescrever edições reais mais recentes com conteúdo antigo — e de qualquer forma, ninguém além
da empresa original deveria conseguir mexer nisso.

## A correção

A rota agora identifica de qual empresa é o pedido (mesmo mecanismo das demais correções) e
recusa qualquer uma que não seja a empresa original. Sem mudança nenhuma pra quem sempre usou —
continua funcionando exatamente igual.

Efeito colateral que também corrigi: como essa restauração tenta rodar sozinha, uma vez, no
primeiro carregamento de qualquer navegador, contas de outras empresas passariam a receber esse
"não pode" (403) em todo carregamento, pra sempre, sem necessidade. Ajustei pra marcar como
"já tentado" mesmo quando falha — assim cada navegador tenta só uma vez, nunca mais que isso.

## Conclusão da revisão

Depois dessa correção, **nenhuma rota do sistema usa mais a chave compartilhada sozinha** como
prova de identidade — todas passam por uma identificação real de qual empresa está chamando (seja
pelo login novo, seja pelo caminho antigo que sempre resolve pra empresa original, nunca pra
"qualquer uma"). A chave em si continua existindo (é o que sustenta a compatibilidade com quem
ainda não trocou pro login novo — ver CLAUDE.md e o histórico da v997/v1004), mas o papel dela
ficou reduzido exatamente ao que devia ser: identificar a empresa original, nunca abrir uma porta
pra qualquer conta.

## Verificação

- Novo teste `tests/v1042-restaurar-leads-so-empresa-principal.test.mjs`: prova que uma empresa
  qualquer recebe 403 e nunca chega a ler/gravar as tabelas legadas (nem com `force:true`), que a
  empresa principal continua funcionando sem regressão, e que `app.js` marca a tentativa como
  concluída mesmo quando falha.
- `npm test`: suíte inteira verde.
- `npm run build`: build limpo.

## Arquivos

`api/restaurar-leads.js`, `app.js` (`garantirRestauracaoLeadsAntigos`),
`tests/v1042-restaurar-leads-so-empresa-principal.test.mjs` (novo), `package.json`/
`package-lock.json` (versão + script `test`), `NOTAS-v1042.md`, versão **1041 → 1042**.
