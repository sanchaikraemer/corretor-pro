# NOTAS v1014 — Investigação: leads da conta errada aparecendo num aparelho compartilhado

## O relato

Depois de publicar a v1013, o dono testou trocando de conta no mesmo celular (conta real
"Empresa 1" e uma conta de teste "Teste1", com logins/e-mails diferentes) e viu: a saudação
mostrava o nome certo ("Bom dia, Teste1!"), mas a lista de leads embaixo era a de "Empresa 1"
— mesmo depois de sair e entrar de novo.

## O que foi investigado e descartado

- **Resolução de organização no servidor** (`resolveOrganizationId`): valida o token de sessão a
  cada chamada e busca a organização SÓ pelo `user_id` daquele token — não haveria como misturar
  contas de logins diferentes por esse caminho, mesmo com múltiplos vínculos.
- **Cache do backend** (`api/leads-recentes.js`): a chave do cache já inclui `organizationId`
  (`` `${organizationId}:${limit}` ``) — contas diferentes nunca compartilham essa entrada.
- **Mesmo login com dois vínculos**: descartado — o dono confirmou que usou e-mails diferentes
  para as duas contas.

## Causa mais provável e correção aplicada

O comportamento (nome certo, dado errado, sobrevive a sair/entrar) combina com o navegador
restaurando a página **da memória** (bfcache — comum ao voltar entre abas ou o Chrome do Android
reabrir uma aba antiga) em vez de recarregar de verdade: os scripts não rodam de novo, EXCETO
pela pequena função que atualiza o nome da conta (ela é re-executada por outro gatilho), enquanto
caches em memória de outras telas (lista de leads, painel) continuam com o retrato da conta
anterior até a próxima navegação real.

**Correção:** `app.js` ganhou um listener de `pageshow` que força um recarregamento completo
sempre que a página volta restaurada da memória (`event.persisted === true`) — a partir de agora,
a tela nunca fica com dado de duas contas misturado no mesmo aparelho, mesmo trocando de conta
sem fechar o navegador.

## Ainda em aberto

Esta correção resolve a causa mais provável, mas **ainda não foi confirmada em campo** — o dono
vai testar de novo (fechando o navegador por completo, não só a aba) e avisar se o problema
persiste. Se persistir mesmo depois disso, a investigação continua (próximo passo seria conferir
diretamente no banco se os leads realmente têm `organization_id` da conta errada gravado, ou se é
mesmo um problema só de tela).

## Teste novo

`tests/v1014-bfcache-forca-recarga-troca-conta.test.mjs` — confirma que o listener de `pageshow`
existe e está na mesma área de código da lógica de identidade de conta.

## `npm test`

Suíte inteira verde.
