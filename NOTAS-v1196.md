# v1196 — a biblioteca do login foi enxugada: 80 KB a menos em toda abertura

## O pedido

Na v1195 ficou registrado que, depois de dividir o `app.js`, **o maior peso restante já não era o
código do app** — era a biblioteca pronta do Supabase (a peça que cuida de entrar na conta, criar
conta, recuperar senha e buscar dados). O dono mandou fazer.

## O que estava acontecendo

O build copiava o pacote pronto da biblioteca (200 KB) e ele era baixado em **toda** abertura do
app. Só que boa parte desse pacote o navegador nunca usa:

| pedaço da biblioteca | o app usa? |
|---|---|
| login/conta (entrar, criar, senha, sessão) | **sim** |
| consultas ao banco | **sim** |
| **tempo real** (websocket — tela que se atualiza sozinha, estilo chat) | não |
| **Storage no navegador** (envio de arquivo) | não — quem envia é o servidor, em `/api` |
| **Edge Functions** | não — as rotas deste projeto são as da Vercel |

Varredura feita em todos os arquivos que rodam no navegador: nenhum chama `.channel(`,
`.storage.from(` ou `.functions.invoke(`. O maior dos três, o de tempo real, sozinho respondia por
mais de 50 KB baixados à toa a cada abertura.

## Como foi feito (e por que NÃO foi remontada do zero)

A tentação era montar uma biblioteca só com as partes usadas. **Não fiz isso de propósito**, e o
motivo é sério: a biblioteca tem uma regra interna que decide **onde a sessão de quem está logado
fica guardada** no navegador. Se essa regra mudasse de resultado, **todo mundo seria deslogado na
atualização** — e o dono descobriria pelo telefone tocando.

O que o build faz agora: usa a biblioteca **oficial, sem reescrever nada**, e apenas troca aqueles
três módulos não usados por peças vazias (pasta `vendor-enxuto/`). O `createClient`, o login e as
consultas continuam sendo o código original, byte por byte.

Duas redes de segurança no `build.js`: se a montagem falhar por qualquer motivo, **publica o pacote
completo** (login não é lugar de arriscar); e se a montagem sair pequena demais ou sem o
`createClient`, ela é recusada antes de ir pro ar.

## Como foi conferido

Não bastava a suíte passar. Foram dois testes de comportamento, os dois em navegador de verdade:

**1. Comparação lado a lado contra um servidor de mentira.** Montei um servidor que imita o
Supabase e anota cada chamada recebida. Rodei a mesma sequência de operações do app (entrar, ver
sessão, consulta com relação embutida, contagem, lista paginada, atualizar, leitura única, criar
conta, recuperar senha, redefinir senha, sair) com as **duas** versões da biblioteca:

- as **10 chamadas de rede saem idênticas** — mesmo método, endereço, cabeçalhos e corpo;
- os **resultados das operações são idênticos**;
- a **sessão é guardada na mesma chave** (`sb-...-auth-token`) — ninguém é deslogado;
- **sair da conta limpa a mesma coisa**.

**2. As telas reais do app publicado**, apontadas pro servidor de mentira — as seis, uma a uma:
entrar (login de verdade, com e-mail e senha, até a sessão ficar guardada e a tela redirecionar
pro app), criar conta, recuperar senha, redefinir senha, painel administrativo e o app na Home.
Resultado: **zero erros nas seis**, e comportamento **igual ao da biblioteca original** (rodei a
mesma bateria nas duas versões e comparei item a item).

Mais a prova visual de sempre: 7 telas fotografadas antes e depois, idênticas pixel a pixel fora o
número da versão.

## O resultado

| | v1193 (antes desta série) | v1195 | **v1196** |
|---|---|---|---|
| baixado ao abrir o app | 966 KB | 918 KB | **842 KB** |
| trafegado na rede (comprimido) | 252 KB | 240 KB | **221 KB** |
| biblioteca do Supabase | 200 KB | 200 KB | **124 KB** |

**Esta versão sozinha tirou 76 KB da abertura** — mais que as duas anteriores somadas. Somando as
três (v1194 faxina, v1195 divisão do app, v1196 biblioteca): **124 KB a menos baixados em toda
abertura**, 31 KB a menos trafegando.

## Guarda nova (`tests/v1196-supabase-enxuto.test.mjs`)

O risco desta mudança é um só: alguém, um dia, começar a usar no navegador algo dos três módulos
que viraram peça vazia. Nesse dia a peça lança erro. O teste quebra **antes**, dizendo o arquivo, o
que foi usado e como desfazer a troca. Ele também trava:

- o build precisa continuar montando a versão enxuta **com a volta atrás** pro pacote completo;
- o objeto global `supabase` (é assim que as telas chamam `supabase.createClient`);
- a peça vazia do tempo real precisa ter `setAuth` **silenciosa** — ela é chamada pelo próprio
  login, e se lançasse erro **ninguém entraria no app**;
- a porta de entrada continua sendo o `createClient` oficial, nada reescrito à mão;
- o **servidor** (`api/`) continua com a biblioteca **completa** — é lá que o Storage é usado de
  verdade, pra guardar o ZIP da conversa.

## Testes

`npm test` — **365 testes, todos verdes**.

## O que sobra depois desta série

O que mais pesa agora na abertura voltou a ser o próprio `app.js` (505 KB / 138 KB na rede). Os
próximos pedaços separáveis dele são pequenos (observação por voz ~12 KB, exportação/backup ~8 KB);
ganho grande dali só com reorganização de verdade das telas, que é obra maior.
