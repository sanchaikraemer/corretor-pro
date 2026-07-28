# NOTAS v1067 — Home realmente busca dado novo em segundo plano

## O problema

Análise ampla do sistema (segurança, fluxo comercial e código) pedida pelo dono. O achado mais
importante: a Home nunca busca dado novo sozinha, mesmo tendo dois mecanismos pensados exatamente
pra isso.

`carregarDashboard()` não declarava o parâmetro `force` — mesmo assim, era chamada como
`carregarDashboard(true)` em dois lugares:
- o intervalo de 30s que sincroniza entre aparelhos (linha ~10446 de `app.js`);
- o retorno de foco da aba depois de trocar de aba (linha ~10461).

Como o parâmetro não existia na função, o argumento `true` era descartado — a função sempre caía
no atalho de cache (`state.itemsAtivos` já populado depois da primeira carga da Home na sessão) e
nunca chegava a chamar `getLeadsData()` de novo. Resultado prático: depois da primeira abertura da
Home, as duas sincronizações de fundo viravam no-op silencioso — só um F5 completo da página
trazia dado realmente novo do servidor.

## Por que isso também deixava a v1066 incompleta

A v1066 corrigiu a config do Cérebro (dias de descanso, meta por dia) ficando presa por aparelho —
mas o próprio código dessa correção (`cp7SincronizarCerebroConfigInicial` → `refreshAllSections()`)
chamava `carregarDashboard()` **sem** `force` quando a Home já estava ativa. Mesmo com o valor novo
já salvo no `localStorage` daquele aparelho, dois problemas se somavam:

1. Sem `force`, a Home continuava reaproveitando os **mesmos objetos** de lead já em memória.
2. `prioridadeAtendimento`/`scoreConversaoHoje` (v1024) cacheiam o resultado por **objeto** de
   lead, num `WeakMap`, pra evitar recalcular centenas de vezes por render. Reaproveitar o mesmo
   objeto significa reaproveitar o score antigo, calculado com a config antiga.

Ou seja: a config chegava certa no aparelho, mas a fila "Fazer agora" só refletia a mudança depois
de um F5 manual — o comportamento visível continuava sendo quase o mesmo bug que a v1066 dizia
ter corrigido.

## A correção

- `carregarDashboard(force)` agora declara e respeita o parâmetro: com `force`, ignora o cache em
  memória e busca de novo no servidor (`getLeadsData(force)`) — que sempre devolve objetos novos,
  o que também invalida corretamente os caches de score por objeto.
- O esqueleto de carregamento só aparece quando a tela está mesmo vazia — uma sincronização de
  fundo forçada com a lista já visível não apaga o que o corretor está vendo enquanto busca.
- `carregarTelaAtiva` repassa `force` pra `carregarDashboard(force)` (antes chamava sempre sem
  argumento nenhum).
- `refreshAllSections()` passa a chamar `carregarDashboard(true)` quando a Home está ativa (antes
  chamava sem forçar) — fecha o buraco que deixava a v1066 incompleta.

## Verificação

- Novo teste `tests/v1067-dashboard-sincronizacao-de-fundo.test.mjs`: confirma a assinatura de
  `carregarDashboard`, o repasse de `force` em `carregarTelaAtiva` e em `refreshAllSections`, e
  testa o comportamento de verdade (força busca no servidor quando `force=true`, usa cache quando
  não força e já tem dado em memória, busca no servidor na primeira carga mesmo sem `force`).
- `npm test` — suíte inteira verde (todos os testes anteriores continuam passando).
- `npm run build` — build limpo, 27 arquivos publicados.
- `npm install --package-lock-only` — `package-lock.json` sincronizado.

## Também nesta versão

- `ESTADO-ATUAL.md` corrigido: a seção de pendências ainda dizia que política de privacidade e
  termos de uso "não existiam como páginas publicadas" — na verdade foram publicados na v1045.
  Só falta o dono preencher a razão social/CNPJ e o e-mail de contato nas duas páginas (dados que
  só ele tem) e pedir revisão jurídica — isso já estava sinalizado no próprio `NOTAS-v1045.md`, só
  não tinha sido levado pro documento de estado atual.
- Duas Pull Requests antigas e obsoletas foram fechadas no GitHub (#121 e #176): a primeira
  propunha o modelo de contas por corretor, que já foi implementado e publicado por outro caminho
  entre as versões v980–v1042; a segunda propunha corrigir exatamente este mesmo bug do dashboard,
  mas a branch estava presa numa versão antiga e a maior parte do seu conteúdo já tinha chegado em
  `main` por outras branches — o único ponto que ainda faltava foi corrigido diretamente aqui.

## Arquivos

`app.js` (`carregarDashboard`, `carregarTelaAtiva`, `refreshAllSections`),
`tests/v1067-dashboard-sincronizacao-de-fundo.test.mjs` (novo), `ESTADO-ATUAL.md`,
`package.json`/`package-lock.json` (versão + script `test`), `NOTAS-v1067.md`, versão
**1066 → 1067**.
