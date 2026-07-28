# NOTAS v1066 — Computador e celular escolhendo um lead diferente pra "Fazer agora"

## O relato

Vários prints do dono mostrando o mesmo instante, mesmos números agregados (225 leads, 96
aguardando cliente, "Fazer agora: 1"), mas com um lead DIFERENTE aparecendo como o prioritário do
dia: no computador aparecia o Adão (atendido há só 6 dias), no celular aparecia a Silvana
(atendida há 18 dias) — como se o computador não estivesse respeitando o tempo de espera
configurado. Um Ctrl+Shift+R e até fechar/abrir o navegador de novo não resolveram.

## A causa

O "tempo de descanso" (quantos dias um lead atendido fica de fora da fila) e a "meta de
atendimentos por dia" são configurados pelo corretor na tela Cérebro e usados pela fila "Fazer
agora" pra decidir quem já pode voltar a competir por atenção. Só que a leitura desses dois
números, na Home, vinha de uma cópia salva **só naquele aparelho** (guardada no navegador) — e
essa cópia só era atualizada quando o corretor abria a tela "Cérebro" **naquele mesmo aparelho**.

Um aparelho onde ele nunca tinha aberto essa tela ficava preso no valor padrão de fábrica (5 dias
de descanso), mesmo o corretor já tendo ajustado esse número há tempos em outro aparelho — e nem
um refresh forçado resolvia, porque o valor mora na memória do navegador, não no que vem da rede.

## A correção

Agora, assim que o app abre — em qualquer aparelho, sem precisar visitar a tela Cérebro antes —
ele busca a configuração de verdade salva no servidor e atualiza a cópia local na hora. Se isso
mudar a regra da fila (tempo de descanso ou meta do dia), a Home recarrega sozinha com o lead
certo, sem precisar de mais nenhuma ação do corretor.

## Testes

- `tests/v1066-cerebro-config-sincroniza-em-qualquer-aparelho.test.mjs` (novo) — confirma que a
  sincronização busca do servidor, grava a cópia local e recarrega a Home quando não havia
  configuração local ainda (o caso exato do relato: aparelho que nunca abriu a tela Cérebro).
- `npm test`: suíte inteira verde.

## Arquivos

`app.js` (`cp7SincronizarCerebroConfigInicial`, nova, chamada assim que o app carrega),
`tests/v1066-cerebro-config-sincroniza-em-qualquer-aparelho.test.mjs` (novo),
`package.json`/`package-lock.json` (versão + script `test`), `NOTAS-v1066.md`, versão
**1065 → 1066**.
