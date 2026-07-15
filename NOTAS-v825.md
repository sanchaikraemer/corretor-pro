# Corretor Pro — Atualização 825

Primeiro módulo do plano de estabilização (versões 825 a 829).
Tema: **Importação, integridade e Cérebro obrigatório**. O objetivo desta rodada
é proteger os dados de entrada, impedir mistura de clientes e fazer o Cérebro
realmente governar a análise das três mensagens.

## Importação e integridade dos leads

- O nome exibido e salvo permanece exatamente como veio na exportação do WhatsApp;
  o sistema não completa, abrevia nem corrige o nome (`guessLeadData` em
  `api/_pipeline.js`).
- Telefone deixou de ser requisito para importar. Quando existe, é guardado como
  informação auxiliar, mas não decide sozinho uma fusão.
- A identificação de importação repetida passa a ser por **igualdade tolerante do
  nome** (`_nomesMesmoLead` em `api/_persistence.js`): diferenças de maiúsculas,
  espaços ou acentos são tratadas, mas nomes apenas parecidos ("Maria Souza" x
  "Maria Clara Souza") nunca são fundidos automaticamente.
- Ao detectar um nome já salvo, a persistência é interrompida e o corretor decide
  explicitamente: **Atualizar o cliente existente**, **Criar um novo cliente** ou
  **Cancelar** (`app.js`, bloco `pendingActions`). Não há mais fusão automática por
  nome (`autoPorNome` removido).
- "Atualizar o existente" acrescenta só mensagens novas, não duplica mensagens já
  importadas e preserva observações, atendimentos, agenda, campos manuais e o
  histórico de análises/importações (`_historicoAnalises`, `_historicoImportacoes`
  em `api/lead-update.js`). A conversa consolidada é **salva antes** de disparar a
  reanálise.
- "Criar novo cliente" gera um identificador interno novo (`forceNew: true`), sem
  copiar dados nem misturar mensagens entre os dois registros.

## Pipeline do ZIP: upload, download e extração únicos

- O ZIP é enviado, baixado e extraído **uma única vez** por importação. Os lotes de
  áudio passaram a usar os arquivos já extraídos do manifesto
  (`manifest.audioStorage`), sem rebaixar o ZIP a cada lote
  (`api/processar-storage.js`).
- Identificador de importação (`importId`) impede processamento duplicado por retry
  ou clique repetido; o caminho de upload é idempotente (`${importId}/${fileName}`
  em `api/criar-upload-url.js`).
- Transcrições são reaproveitadas com hash seguro do áudio (`audioHashes`,
  `transcription-cache`), evitando nova cobrança quando os mesmos áudios reaparecem.
- O ZIP só é removido do Supabase depois da confirmação final (`action: "finalizar"`
  → `status: "completed"` → `removerImportacao`), ou seja, apenas após o lead ser
  salvo/atualizado. Em falha recuperável o manifesto fica em `recoverable-failure`
  e o ZIP permanece para nova tentativa. Compartilhamentos locais e importações
  remotas antigas expiram por prazo (7 dias), sem apagar um job ativo
  (`limparSharesLocaisAntigos`, `limparImportacoesRemotasAntigas`, `activeImportId`).

## Share Target e cold start

- O compartilhamento é recebido já na primeira tentativa com o app fechado, mantendo
  **uma única cópia persistente** do arquivo: o IndexedDB é a fonte principal e o
  Cache Storage só é usado como fallback, com uma cópia (`service-worker.js`).

## Cérebro como regra superior e obrigatória

- As três mensagens são validadas de forma **determinística** antes de serem exibidas
  (`compilarRegrasObjetivasCerebro`, `aplicarCorrecoesDeterministicasCerebro`,
  `validarMensagensCerebro` em `api/_pipeline.js`):
  - exige exatamente três sugestões preenchidas e não duplicadas;
  - bloqueia expressões proibidas configuradas no Cérebro;
  - aplica "Bom dia / Boa tarde / Boa noite" conforme o horário brasileiro quando a
    regra estiver ativa, corrigindo automaticamente "Oi/Olá". A regra passa a ser
    reconhecida tanto na forma proibitiva ("não use oi/olá; use bom dia...") quanto
    na forma **positiva** que o corretor normalmente escreve ("sempre comece com
    bom dia, boa tarde ou boa noite", "iniciar com a saudação do horário") — antes
    só a forma proibitiva era detectada e as mensagens saíam sem saudação;
  - impede repetir pergunta cuja resposta já existe na conversa;
  - impede introduzir preço, prazo ou número que não aparece na conversa;
  - valida tamanho/formato quando objetivamente verificável.
- Havendo violação, o sistema tenta corrigir e revalida (até 2 tentativas). Enquanto
  alguma das três mensagens continuar inválida, a análise **não é concluída**:
  `sugestoesPendentes` fica verdadeiro e o resultado parcial não é apresentado como
  concluído.

## Estados visíveis da importação

- Estados distintos e ordenados: **Recebendo, Enviando, Extraindo, Transcrevendo,
  Analisando, Salvando, Concluído e Falha recuperável** (`ETAPAS_PROCESSAMENTO` /
  `renderEtapas` em `app.js`). Resultado parcial não aparece como análise concluída e
  a falha recuperável oferece nova tentativa.

## Validação

- Versão interna: `7.125.0`. Versão exibida: `825`.
- Novos testes de regressão desta rodada:
  - `tests/v825-import-integridade.test.mjs`
  - `tests/v825-cerebro-obrigatorio.test.mjs`
  - `tests/v825-storage-pipeline.test.mjs`
- Suíte completa (`npm test`) e build (`npm run build`) concluídos sem erro.
- Auditoria detalhada e mapeamento dos critérios de aceite em
  `AUDITORIA_E_VALIDACAO_V825.md`.

## Fora do escopo desta rodada (conforme o plano)

- Não foi imposto novo limite de tamanho de ZIP (decisão aprovada).
- Remoção do nome fixo do corretor no backend e do catálogo comercial cravado ficam
  para o Módulo 827.
- Migrations, segurança de chave e controle de custo ficam para o Módulo 828.

## Limite do ambiente de validação

O fluxo foi validado por testes automatizados, análise estrutural e build. O teste
final com o menu real "Exportar conversa" do WhatsApp exige a PWA publicada em HTTPS
e um aparelho Android; esse único teste de aceite deve ser feito após a publicação,
com o app totalmente fechado e uma única exportação.
