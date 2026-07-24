# v979 — rota de importação direta estava quebrada, trava contra ZIP "bomba" e relógio de 2s que pesava no navegador

## Contexto

Pedido do dono, em cima da auditoria externa (PDF v892) que ele trouxe pra revisão: (1) travar a
importação contra um ZIP "bomba" (pequeno fechado, gigante quando aberto) e (2) investigar a
lentidão relatada no dia a dia ("demora pro mouse criar a ação e responder"). Durante a
investigação do item 1, apareceu um terceiro problema não relacionado a nenhum dos dois PDFs:
`api/analisar.js` estava completamente quebrada.

## 1. `api/analisar.js` — rota inteira fora do ar (achado durante a revisão, não estava nos PDFs)

`api/analisar.js` importa `processZipBuffer` de `api/_pipeline.js` — mas essa função nunca existia
lá. Import nomeado de um export inexistente é `SyntaxError` em ESM: o módulo falhava ao **carregar**,
então qualquer chamada a essa rota — mesmo autenticada, mesmo com um ZIP válido — derrubava a
função com erro antes do `handler` sequer rodar.

Confirmado na prática:
```
node -e "import('./api/analisar.js')"
→ SyntaxError: The requested module './_pipeline.js' does not provide an export named 'processZipBuffer'
```

Ninguém pegou isso porque `node --check` (usado no `npm test`) só valida sintaxe — não resolve
imports. `api/analisar.js` sempre passou no `--check` mesmo quebrada.

Provavelmente sobrou de uma reorganização anterior: o fluxo atual de importação
(`api/processar-storage.js`) roda em 3 chamadas separadas (`preparar` → `transcrever` →
`analisar`), cada uma usando pedaços de `_pipeline.js` (`prepararConversaDoZip`,
`transcreverArquivosExtraidos`, `finalizarAnaliseDaConversa`). `api/analisar.js` é a rota de
compatibilidade — recebe o ZIP direto no corpo da requisição, sem passar pelo Storage antes — e
devia combinar essas 3 etapas numa chamada só. Em algum momento ela ficou órfã de uma função que
não existe mais.

**Fix:** `processZipBuffer` foi criada em `_pipeline.js` combinando as 3 etapas já existentes, na
mesma ordem que `processar-storage.js` já usa. Nenhuma lógica nova — só remonta o que já existia
em blocos separados.

## 2. ZIP "bomba" — áudio gigante era descompactado ANTES de checar o tamanho

O `.txt` da conversa já tinha essa proteção (`zipEntrySize` checado antes do `.async()`), mas
`transcribeAudio` (usada pela rota de compatibilidade recém-consertada acima) fazia o contrário:
descompactava o áudio inteiro primeiro (`await audioFile.async("nodebuffer")`) e só depois
conferia se passava de 24 MB. Um áudio com tamanho declarado gigante já tinha sido lido inteiro
pra memória antes da rejeição.

**Fix:** o tamanho **declarado** pelo ZIP agora é checado antes de descompactar (mesmo padrão já
usado pro `.txt`). A checagem depois de descompactar continua como reforço, caso o ZIP declare
errado.

Vale registrar: o resto da proteção contra ZIP "bomba" que o PDF de auditoria (v892) descreveu
como ausente — limite de quantidade de arquivos, limite de tamanho do `.txt`, limite do total de
áudio selecionado para transcrição — **já existia** (`MAX_ZIP_ENTRIES`, `MAX_TXT_UNCOMPRESSED_BYTES`,
`MAX_SELECTED_AUDIO_BYTES` em `_pipeline.js`, presentes desde o commit inicial do projeto). O
achado do PDF nesse ponto específico não batia com o código real — só o caminho usado pela rota de
compatibilidade (item 1) tinha mesmo a brecha.

## 3. Relógio de 2 segundos varrendo a tela inteira, para sempre

`fixVersionText` (corrige texto de versão desatualizado em qualquer canto da tela) rodava a cada
2 segundos, para sempre, enquanto o app ficasse aberto — varrendo TODO texto do documento com
`TreeWalker` mais um `querySelectorAll` amplo (inclui o seletor genérico `small`, que bate em
qualquer `<small>` da página). Isso compete com clique/toque pelo processador principal — se um
toque cair bem no meio dessa varredura, a resposta atrasa. Em celular intermediário, perceptível.

**Fix:** intervalo reduzido de 2s → 30s (mesmo ritmo já usado na sincronização da Home,
`app.js:9842`). As 3 chamadas únicas já existentes logo após carregar a página (50ms/250ms/1000ms)
continuam cobrindo o caso comum; o intervalo passa a ser só uma rede de segurança tardia, não mais
um trabalho constante.

Registrado, não investigado a fundo nesta rodada: o dono relatou a Home presa em "carregando"
(blocos cinzas) depois de atualizar a página numa sessão real. `carregarDashboard`/`getLeadsData`
já têm 4 camadas de defesa contra isso (timeout de 15s no fetch, nova tentativa automática em 3s,
fallback de segurança 600ms depois). Se mesmo assim travou, o problema provavelmente é anterior a
essas defesas — algo que impediu `carregarDashboard` de sequer ser chamado no boot. Pedido print
do console do navegador pro dono pra confirmar a causa exata antes de mexer; fica para a próxima
versão.

## Verificação

- `npm test`: suíte inteira verde, incluindo `v979-zip-seguro-rota-compat-perf` (novo) — confirma
  que `api/analisar.js` carrega sem erro, que um áudio acima do limite declarado é recusado sem
  descompactar, e que o intervalo de `fixVersionText` não é mais 2000ms.
- `npm run build`: build limpo, versão 979.
- `node -e "import('./api/analisar.js')"` confirmado OK depois do fix (falhava antes).
- Não foi possível testar a lentidão/travamento em condição real de uso (sem acesso à produção,
  ver CLAUDE.md) — a mudança do relógio de 2s é uma correção de causa concreta e comprovada por
  leitura de código, não uma tentativa às cegas, mas pode não ser a única causa da lentidão
  relatada.

## Arquivos

- `api/_pipeline.js` (`transcribeAudio` — exportada + checagem de tamanho antes de descompactar;
  `processZipBuffer` — nova, conserta `api/analisar.js`), `app.js` (`fixVersionText` — intervalo
  2s → 30s), `tests/v979-zip-seguro-rota-compat-perf.test.mjs` (novo),
  `package.json`/`package-lock.json`, `NOTAS-v979.md`, versão **978 → 979**.
