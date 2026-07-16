# v827-15 — item 1 do plano de estabilização: separar cliente de oportunidade

Primeira frente do `PLANO_CORRECOES_FUTURAS_CORRETOR_PRO.docx` (auditoria da v804),
seguindo a ordem de prioridade que o próprio documento recomenda.

## O problema

O mesmo telefone (ou, pior, o mesmo nome) identificava tanto o CONTATO quanto a
NEGOCIAÇÃO. Isso criava três riscos reais, hoje corrigidos:

1. **Card da lista misturando oportunidades diferentes.** `dedupeKey` agrupava
   registros pelo nome do cliente quando não havia `oportunidadeId` — então um
   cliente negociando um apartamento E, em outra conversa, uma sala comercial,
   podia aparecer como **um único card** na lista, com as duas negociações
   coladas.
2. **Excluir um lead podia apagar outra oportunidade do mesmo cliente.**
   `acaoApagar` (`api/lead-update.js`) apagava cegamente todo `ids` que o front
   mandasse como "duplicado" — e como o agrupamento por nome já misturava
   oportunidades diferentes num card só, apagar aquele card apagava as duas.
3. **Reimportação podia mesclar timeline/análise de negociações diferentes.**
   `_buscarProcessamentoExistenteV681` (usado ao processar um ZIP novo) casava
   por telefone ou nome sem checar se o produto da conversa nova era o mesmo da
   conversa já salva — juntando timelines de apartamento e sala comercial no
   mesmo registro.

## A correção

- **`dedupeKey` (lista):** telefone só agrupa registros quando o produto é o
  mesmo (ou nenhum lado tem produto identificado ainda). Produtos diferentes e
  identificados no mesmo telefone viram cards separados. Nome sozinho **nunca**
  mais agrupa — sem telefone/oportunidadeId, cada registro é seu próprio card.
- **`_buscarProcessamentoExistenteV681` (reimportação):** o mesmo guard de
  produto entra nos caminhos de match por telefone e por nome — produto
  diferente e identificado não encontra o registro antigo, então vira uma
  oportunidade nova em vez de mesclar.
- **`acaoApagar` (exclusão):** antes de apagar em lote, confere no banco que
  cada id extra é do mesmo telefone e (quando identificado) do mesmo produto do
  registro pedido. Um id que não bate fica de fora e sobrevive — nunca mais
  confia cegamente na lista que o front mandou (que pode vir de cache antigo).

## Validação

- Versão interna: `7.127.15`. Versão exibida: `827-15`.
- Novo teste `tests/v827-15-exclusao-oportunidade.test.mjs`: `_produtosIncompativeis`
  isolado (produtos diferentes bloqueiam, mesmo produto ou sem identificação não
  bloqueiam); `_buscarProcessamentoExistenteV681` com Supabase simulado confirma
  que mesmo telefone + mesmo produto atualiza o registro existente e mesmo
  telefone + produto diferente vira oportunidade nova; teste de integração do
  endpoint `apagar` confirma que uma oportunidade diferente do mesmo contato
  nunca é apagada junto, mesmo que o front mande o id dela.
- Suíte completa (35 conjuntos) e build (`versão=827-15`) sem erro.

## O que ainda falta do item 1 (não coberto nesta versão)

- `oportunidadeId` continua opcional/dependente da IA preencher — não é um ID
  gerado e garantido pelo sistema no momento da criação do registro.
- Excluir ainda usa telefone/produto como sinal de "mesma oportunidade"; não há
  um identificador de oportunidade explícito e imutável desde a criação.

Os itens 2 a 6 do plano (concorrência de gravação, timezone, backup/ZIPs,
consolidação do app.js, testes funcionais) seguem pendentes para as próximas
versões, na ordem recomendada pelo documento.
