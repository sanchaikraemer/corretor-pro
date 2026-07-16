# v827-16 — corrige a v827-15: nome é a identidade, produto não separa mais nada

A v827-15 (item 1 do plano de estabilização) tentou usar telefone e "produto
identificado" pra decidir quando duas negociações do mesmo cliente eram, de fato,
diferentes. Duas premissas erradas:

1. **Telefone não é confiável neste app.** `detectPhone` não lê metadado nenhum do
   WhatsApp — ele varre o TEXTO da conversa atrás de qualquer sequência de dígitos
   parecida com telefone. Pode pegar um número qualquer citado no meio do papo, não o
   contato de verdade. O identificador real e estável aqui é o **nome**, exatamente como
   vem no export do WhatsApp.
2. **Produto identificado muda dentro da MESMA conversa.** Uma conversa real evolui:
   o cliente pergunta de um empreendimento e, mais adiante na mesma conversa, de outro
   (ex.: perguntou do Personalité, depois do Quality). Reimportar essa conversa pra
   atualizar já bastava pra IA identificar um produto diferente do salvo — e a trava da
   v827-15 tratava isso como "oportunidade nova", fragmentando o histórico de um único
   cliente em vários cadastros. Exatamente o oposto do que o plano pedia.

## A correção

- **Reimportação (`_buscarProcessamentoExistenteV681`):** removida a checagem de
  produto nos caminhos de telefone e nome. Reimportar pelo mesmo nome **sempre**
  atualiza o mesmo registro, não importa qual produto a IA identificar naquela rodada.
- **Lista (`dedupeKey`):** volta a agrupar pelo **nome** (como era antes da v827-15),
  sem depender de telefone nem de produto. Só o `oportunidadeId` explícito — criado
  manualmente pelo corretor (o app já tem a ação "nova oportunidade" pra isso) —
  separa registros do mesmo nome em cards diferentes.
- **Exclusão (`acaoApagar`):** a validação antes de apagar em lote agora confere
  **nome**, não telefone/produto — consistente com o resto do sistema.
- `_produtosIncompativeis`/`_produtoIdentity` (introduzidas na v827-15) foram removidas
  por não terem mais uso — item 1 do plano ("nunca unir sala comercial/apartamento/
  terreno automaticamente") continua endereçado, mas via separação **manual**
  (`nova-oportunidade-parceiro`), não detecção automática por produto.

## Validação

- Versão interna: `7.127.16`. Versão exibida: `827-16`.
- `tests/v827-15-exclusao-oportunidade.test.mjs` reescrito: confirma que reimportar
  pelo mesmo nome atualiza o mesmo registro mesmo quando o produto identificado muda
  entre duas rodadas (o caso que quebrava), que nomes diferentes não casam, e que a
  exclusão em lote não arrasta um cliente diferente cujo id tenha vindo por engano.
- Suíte completa (35 conjuntos) e build (`versão=827-16`) sem erro.
