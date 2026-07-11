# v776 — "Geladeira" abria uma tela em branco (leads não apareciam)

## O problema (relatado pelo usuário)

O corretor mandava leads pra Geladeira, mas ao abrir **Mais → Geladeira** a tela vinha vazia — nenhum lead aparecia, mesmo os que ele acabara de congelar.

## Causa

A Geladeira **não é uma tela própria**: ela mora dentro da seção "Arquivo" (`#perdidos`), atrás de uma aba interna (`#arqGeladeira` → `#geladeiraList`), do lado da aba "Perdidos".

O card do menu tem `data-target="geladeira"`, e o `show("geladeira")` tentava ativar um elemento `#geladeira` — **que não existe**. Resultado: nenhuma seção era ativada (tela em branco) e a lista da geladeira, que fica dentro de `#perdidos` (não ativa) e ainda escondida pela aba interna, nunca aparecia.

O card "Leads perdidos" funcionava porque `data-target="perdidos"` aponta pra uma seção que existe de verdade. A geladeira era o único destino sem seção correspondente.

## O que foi corrigido (`app.js`)

1. Em `show()`, "geladeira" agora é tratada como **alias da seção `#perdidos`** — ativa a seção que existe de verdade em vez de procurar um `#geladeira` inexistente.
2. Ao navegar pra "perdidos" ou "geladeira", `show()` já abre a **aba interna certa** na hora (via `arqTab`), antes do carregamento deferido, pra nenhuma das duas mostrar a aba do irmão.
3. O carregador da tela "geladeira" (`carregarTelaAtiva`) passou a montar as duas listas (perdidos + geladeira) e deixar a aba **Geladeira** selecionada, igual ao caminho de "perdidos".

Nada mudou na persistência: os leads já eram salvos com `etapa: "Geladeira"` corretamente — o problema era só a navegação não conseguir mostrar a lista.

## Testes

- `npm test` e `npm run build` passaram.
- Falta validar em produção: mandar um lead pra Geladeira e abrir **Mais → Geladeira** conferindo que ele aparece na lista (e que o botão "Perdidos"/"Geladeira" alterna as duas abas).
