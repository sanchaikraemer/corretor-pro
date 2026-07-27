# NOTAS v1014 — Nome errado na saudação (achado real, testado ao vivo com o dono)

## O relato original

Depois de publicar a v1013, o dono testou trocando de conta no mesmo aparelho (conta real
"Empresa 1" e uma conta de teste "Teste1", com e-mails diferentes) e viu, num primeiro momento:
a saudação mostrava o nome certo ("Bom dia, Teste1!"), mas a lista de leads embaixo era a de
"Empresa 1" — chegando a persistir depois de sair e entrar de novo uma vez.

## Descartado antes de investigar mais fundo

- **Resolução de organização no servidor** (`resolveOrganizationId`): valida o token de sessão a
  cada chamada e busca a organização SÓ pelo `user_id` daquele token — sempre esteve correto.
- **Cache do backend** (`api/leads-recentes.js`): a chave do cache já inclui `organizationId` —
  contas diferentes nunca compartilham essa entrada.
- **Mesmo login com dois vínculos**: descartado — e-mails diferentes confirmados pelo dono.

## Correção 1 — página "congelada" na memória do navegador (bfcache)

Fechando o navegador por completo e entrando de novo, o problema sumiu — indicando que o
navegador tinha restaurado uma página da memória (bfcache) em vez de recarregar de verdade.
`app.js` ganhou um listener de `pageshow` que força recarregamento completo sempre que isso
acontece (`event.persisted === true`), fechando essa brecha de qualquer forma.

## Correção 2 — conta nova (0 leads) presa no nome genérico

Com o bfcache corrigido, a conta de teste passou a aparecer corretamente **vazia** — mas a
saudação ficou presa em "Bom dia, corretor!" genérico, mesmo com a conta certa identificada em
todo o resto da tela. `renderSaudacao(items)` só atualizava o título dentro do bloco que exige
`items.length > 0` — toda conta nova (todo trial começa com zero leads) nunca tinha o nome de
verdade aplicado. Corrigido: o nome agora é aplicado antes da checagem de lista vazia.

## Correção 3 — 🔴 a causa raiz de verdade (achada testando de novo, na CONTA REAL)

Voltando pra conta real (o dono, que também é administrador da plataforma), a saudação e a barra
lateral mostraram **"Teste1"** — só a etiqueta errada; os 227 leads mostrados sempre foram os
reais (nunca houve vazamento de dado — a API de leads sempre filtrou certo).

**Causa:** `cpCarregarContaLogada()`, em `app.js`, buscava o nome da conta com

```
cliente.from("memberships").select("organizations(nome)")
  .order("criado_em", { ascending: false }).limit(1).maybeSingle()
```

**sem `.eq("user_id", ...)`** — contando só com a RLS pra restringir ao próprio vínculo. Isso
funciona para um corretor comum, mas quem também é administrador da plataforma tem uma política
de RLS extra (`membership_select_admin`, migração 0003) que libera ver **todos** os vínculos do
sistema — sem o filtro explícito, a consulta pegava o vínculo mais recente criado **por qualquer
conta do sistema** (a de teste, criada um dia depois), não o do próprio administrador.

Esse bug já existia desde a v1007 (quando esta consulta foi criada) — a v1013 só o tornou mais
visível/reproduzível ao adicionar `.order("criado_em", ...)` (antes a ordem era arbitrária, então
às vezes "acertava" por acaso).

**Correção:** adicionado `.eq("user_id", data.session.user.id)` — mesmo padrão já usado em
`entrar.html` e em `resolveOrganizationId` (`api/_persistence.js`), que nunca tiveram esse
problema.

## Confirmado ao vivo

O dono testou as três correções ao vivo, com prints, em ambas as contas (Teste1 vazia e Empresa 1
real) — os dois sintomas relatados sumiram.

## Pendência anotada para depois (não é bug, é pedido do dono)

"Total de mensagens" na tela de um lead deveria contar só as dos últimos 90 dias — hoje conta o
histórico inteiro e destoa/fica incoerente em conversas muito antigas. Registrado para uma
próxima atualização; não implementado nesta versão.

## Teste novo

`tests/v1014-saudacao-conta-vazia-e-troca-conta.test.mjs` — cobre as 3 correções: guarda de
bfcache, nome aplicado antes do "return" por lista vazia, e o filtro `.eq("user_id", ...)` que
faltava na busca do nome da conta.

## `npm test`

Suíte inteira verde.
