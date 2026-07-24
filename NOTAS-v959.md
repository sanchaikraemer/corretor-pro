# v959 — "limpar tudo" podia deixar arquivos pra trás no Storage sem avisar

## Contexto

Revisão linha a linha de `api/limpar-tudo.js` (235 linhas) — a rota destrutiva de reset total
(apaga `whatsapp_processamentos`, `leads`, `direciona_leads` e o bucket de ZIPs/áudios). Já tem
3 camadas de proteção contra disparo acidental (API key + `DIRECIONA_DANGER_LIMPAR_TUDO=ativo`
no ambiente + confirmação literal `"APAGAR TUDO"` no corpo) — não mexi em nenhuma delas.

## O problema

`emptyBucket` lista o bucket inteiro recursivamente (`list(prefix, {limit:1000, ...})`) e depois
manda tudo pra `remove()` numa chamada só. `list()` do Supabase Storage **nunca pagina sozinho**
— cada chamada devolve no máximo `limit` itens da pasta, e o código só chamava uma vez por pasta.

Uma pasta com mais de 1000 arquivos (ex.: `transcription-cache/`, compartilhada entre todos os
leads — depois de meses de uso, plausível passar de 1000 áudios transcritos) fazia a função
enxergar só o primeiro lote, apagar só esse lote, e devolver `ok:true` como se o bucket inteiro
tivesse sido esvaziado. Justamente o oposto do que "limpar tudo" promete.

## O que mudou

`listFolder` agora pagina com offset até a página vir com menos itens que o limite (prova de que
acabou). `remove()` (que também pode ter algum teto de itens por chamada, não documentado com
certeza, mas dividir em lotes não muda QUAIS arquivos são apagados nem tem custo real) passou a
rodar em lotes de 1000 em vez de uma chamada só com a lista inteira.

`emptyBucket` virou export (só pra dar pra testar direto, sem mudar o handler).

## Verificação

- `npm test` verde, incluindo o teste novo `v959-limpar-tudo-paginacao-storage` — simula um
  Supabase Storage fake com 2500 arquivos numa pasta e confirma que os 2500 são listados E
  apagados (não só os primeiros 1000), mais os casos de bucket pequeno e bucket vazio.
- `node --check api/limpar-tudo.js` OK.

## Não mexido (fora do escopo de bug, é decisão de produto)

`limpar-tudo` não inclui a tabela `direciona_config` (onde mora o Cérebro) na lista de tabelas
apagadas — só `whatsapp_processamentos`, `leads`, `direciona_leads` + o bucket de arquivos.
Faz sentido como está (resetar os DADOS/leads sem perder a configuração do corretor), mas
registro aqui caso o dono espere um reset realmente total.

## Arquivos
- `api/limpar-tudo.js` (`emptyBucket` — paginação + export),
  `tests/v959-limpar-tudo-paginacao-storage.test.mjs` (novo), `package.json`/`package-lock.json`,
  `NOTAS-v959.md`, versão **958 → 959**.
