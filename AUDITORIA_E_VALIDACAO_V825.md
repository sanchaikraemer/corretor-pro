# Auditoria e validação — Corretor Pro v825

Módulo 825 do plano — **Importação, integridade e Cérebro obrigatório**.
Base de trabalho: pacote `7.125.0` / versão exibida `825`.

## Método da auditoria

O código foi revisado seguindo os fluxos de importação (upload → download → extração
→ processamento → persistência → limpeza), identificação/decisão por nome, validação
determinística do Cérebro e estados visíveis da importação. Cada critério de aceite
do plano (§5.12) foi confrontado com o ponto de implementação correspondente e com o
teste de regressão que o cobre.

## Mapeamento dos critérios de aceite (§5.12)

| # | Critério de aceite | Onde está implementado | Evidência de teste |
|---|---|---|---|
| 1 | Lead novo sem telefone é importado corretamente | `guessLeadData` (`api/_pipeline.js`) — telefone opcional | `v825-import-integridade` (phone `""`) |
| 2 | Lead novo com telefone importa sem tornar telefone obrigatório | `guessLeadData` extrai telefone como auxiliar | `v825-import-integridade` (phone `54999990000`) |
| 3 | Nome igual apresenta atualizar / criar novo / cancelar | `pendingActions` em `app.js` (`btnAtualizarLead`, `btnSalvarLead`, `btnDescartarLead`) | `v825-import-integridade` (regex do trio de botões) |
| 4 | Atualizar preserva dados e acrescenta só mensagens novas | `acaoAtualizarComEvolucao` em `api/lead-update.js` (`{...anterior, ...nova}`, merge de timeline sem duplicar) | `v825-import-integridade` (`...anterior, ...nova`) |
| 5 | Criar novo mantém históricos separados | `forceNew: true` + novo id em `api/lead-update.js`; `forceNew ? null` em `api/_persistence.js` | `v825-import-integridade` (`forceNew`, `acao:"criar-novo"`) |
| 6 | Nomes apenas semelhantes não são unidos | `_nomesMesmoLead` (igualdade tolerante, sem match parcial) em `api/_persistence.js`; `autoPorNome` removido | `v825-import-integridade` (`maria/maria clara souza` = `false`) |
| 7 | ZIP com vários áudios é baixado e extraído uma única vez | `action === "transcrever"` usa `manifest.audioStorage[nome]` e não chama `baixarBuffer(storage, storagePath)` | `v825-storage-pipeline` (doesNotMatch download; usa áudio extraído) |
| 8 | Transcrições antigas reaproveitadas sem nova cobrança | `audioHashes` + `transcription-cache` + `manifest.transcriptions = existentes` | `v825-storage-pipeline` (`reusedPreparation`, `cachedTranscriptions`) |
| 9 | Falha recuperável não perde ZIP nem cria lead parcial | `status = "recoverable-failure"` mantém manifesto/ZIP; análise incompleta responde `recoverable: true` sem salvar | `v825-storage-pipeline` (`recoverable-failure`) |
| 10 | Cold start recebe o primeiro compartilhamento sem voltar à Home | Share Target no `service-worker.js` (IndexedDB principal, uma cópia de cache no fallback) | `v825-storage-pipeline` + `share-target-cold-start` |
| 11 | ZIP concluído é removido do Supabase após confirmação final | `action === "finalizar"` → `status = "completed"` → `removerImportacao` (`api/processar-storage.js`) | `v825-storage-pipeline` (`finalizar`, `completed`) |
| 12 | Pendências locais antigas eliminadas sem afetar jobs ativos | `limparSharesLocaisAntigos` / `limparImportacoesRemotasAntigas` (`app.js`); `activeImportId` protegido no `limpar-antigos` | `v825-storage-pipeline` (`activeImportId`) |
| 13 | As três mensagens obedecem à regra de saudação do Cérebro | `compilarRegrasObjetivasCerebro` + `aplicarCorrecoesDeterministicasCerebro` (Oi/Olá → Bom dia) | `v825-cerebro-obrigatorio` (`^Bom dia, Vera,`) |
| 14 | Regra manual vence aprendizado histórico conflitante | validação determinística bloqueia expressões proibidas mesmo vindas do aprendizado (`validarMensagensCerebro`) | `v825-cerebro-obrigatorio` (expressão proibida) |
| 15 | Pergunta já respondida não reaparece nas sugestões | `perguntasRespondidasNaTimeline` + `perguntaRepeteRespostaExistente` | `v825-cerebro-obrigatorio` (`já respondida`) |
| 16 | A análise não conclui enquanto existir mensagem inválida | laço de correção (até 2×) + `trioOk`/`sugestoesPendentes`; `processar-storage` responde `recoverable` quando incompleta | `v825-cerebro-obrigatorio` (`exatamente três`) + `v825-storage-pipeline` |
| — | Invenção de dado numérico bloqueada (§5.9) | `fatosNumericos` compara com a conversa | `v825-cerebro-obrigatorio` (`dado numérico ausente`) |

## Observações de integridade adicionais

- **Ordem do Cérebro (§5.8):** as regras manuais são compiladas e aplicadas de forma
  determinística *após* a resposta da IA, garantindo que a configuração manual
  prevaleça sobre o texto gerado e sobre o aprendizado histórico.
- **Estados visíveis (§5.11):** `ETAPAS_PROCESSAMENTO` cobre exatamente os oito
  estados previstos, incluindo "Falha recuperável"; resultado parcial nunca é
  apresentado como concluído (bloqueio por `sugestoesPendentes`).
- **Exclusão segura do ZIP (§5.6):** a remoção só ocorre no `finalizar`, depois do
  lead salvo; falha recuperável preserva o arquivo para nova tentativa.

## Itens fora do escopo do Módulo 825 (sequenciados no plano)

- Nome fixo do corretor ("Sanchai") ainda presente como *fallback* em
  `api/_pipeline.js`, `api/lead-update.js` e `api/reanalisar-lead.js`. A remoção
  pertence ao **Módulo 827** (§7.4) e não foi alterada aqui para não misturar
  assuntos de módulos diferentes.
- Catálogo/valores comerciais fixos, migrations, segurança de chave e controle de
  custo pertencem aos **Módulos 827 e 828**.

## Testes executados

Todos concluídos sem erro:

- validação sintática de todos os arquivos JavaScript (app, build, service worker e
  rotas `api/`);
- `tests/v825-import-integridade.test.mjs`;
- `tests/v825-cerebro-obrigatorio.test.mjs`;
- `tests/v825-storage-pipeline.test.mjs`;
- suíte de regressão completa herdada (retomada, home, aprendizado, share target,
  atendimento, layouts v818–v824 etc.);
- build de produção da versão 825 (`npm run build`) — 11 arquivos publicados;
- `npm audit`: zero vulnerabilidades conhecidas.

## Limite do ambiente de validação

O teste final de integração com o menu real "Exportar conversa" do WhatsApp exige a
PWA publicada em HTTPS e um aparelho Android — não reproduzível no ambiente local.
Após a publicação, executar o aceite com o app totalmente fechado e uma única
exportação, conforme a matriz global de validação do plano (§10).
