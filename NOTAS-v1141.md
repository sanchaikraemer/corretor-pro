# v1141 — reimportar deixa de pagar por trabalho que já estava feito (e a pergunta de período saiu)

Print + reclamações do dono (05/08/2026, logo depois da v1140):

1. "que merda é essa que aparece no fundo da seleção de prazo?" — a janela "Período dos áudios"
   abria com a tela de progresso desenhada atrás: o botão do arquivo, "Recebendo — validando o
   arquivo recebido (8%)" e a barra em 8%. **"Não pode ter isso atrás porque não está rolando nada,
   simples assim, SEM INVENTAR O QUE NÃO EXISTE."**
2. "não importa se coloco 30 ou todo período, sempre demora o mesmo tempo, sempre diz lá dentro
   'nada reaproveitado', garanto que essa seleção não serve pra nada."
3. "análise de 30 dias, com poucas mensagens, demorando quase 1 minuto mesmo após sua atualização —
   PÉSSIMO."
4. E o que resume tudo: **"temos que achar um jeito de reimportar ou reanalisar SOMENTE o que já não
   foi feito, senão vou perder MUITO DINHEIRO desnecessariamente com tokens de api de retrabalho
   que já está salvo no sistema."**

Ele está certo nos quatro pontos. As causas eram de código e estão corrigidas.

## 1. A pergunta do período saiu da importação

O período **nunca** limitou a conversa: ele limita só a **transcrição de áudio**. As mensagens
escritas entram completas em qualquer opção e a análise (a etapa que realmente demora) lê a
conversa inteira do mesmo jeito. Numa conversa com pouco áudio — o caso comum de reimportação —
"30 dias" e "todo o período" dão exatamente o mesmo tempo e o mesmo resultado. Ou seja: a janela
cobrava um toque e uma parada em toda importação pra, na prática, quase nunca mudar nada.

- A importação agora usa direto o **"Período padrão dos áudios" do Cérebro** (padrão 90 dias).
- O resultado da importação continua dizendo qual período foi aplicado, com o atalho
  "ajustar padrão" que leva ao Cérebro. O texto do campo no Cérebro foi reescrito pra deixar claro
  que é ali que se muda.
- Como não existe mais janela, **não existe mais nada aparecendo atrás dela**. A v1116 tinha
  escondido só o anel da tela cheia; o card de progresso continuava visível por baixo — era isso no
  print. O progresso só aparece quando há trabalho de verdade acontecendo.

O teste `v1116-periodo-audios-pausa-progresso` foi substituído por
`v1141-importacao-sem-pergunta-de-periodo` (guardava o comportamento de uma janela que não existe
mais).

## 2. "Nada reaproveitado": o nome do arquivo era comparado de duas formas diferentes

Causa real, que sobreviveu às tentativas da v954, v1022, v1026 e v1027 — todas corretas, mas
nenhuma no lugar certo. O MESMO arquivo chega ao servidor com dois nomes:

- ao **salvar**, o nome como está no aparelho: `Conversa do WhatsApp com X-enxuto.zip` (espaços);
- ao **preparar** a importação — que é exatamente onde as transcrições já feitas do cliente são
  procuradas — o nome do arquivo guardado no armazenamento, que passa por sanitização:
  `Conversa-do-WhatsApp-com-X-enxuto.zip` (traços).

A limpeza desse nome tirava o prefixo "Conversa do WhatsApp com" **antes** de transformar traço em
espaço: a versão com espaços virava a chave `x`, a sanitizada virava `conversa do whatsapp com x`.
Duas chaves diferentes pro mesmo arquivo → a busca pelo cliente já salvo falhava → o cache de
transcrição vinha vazio → **toda reimportação retranscrevia (e pagava) todos os áudios** e o
contador mostrava "0 reaproveitados" pra sempre.

Agora os separadores são normalizados primeiro e as duas formas chegam na mesma chave (travado por
teste, com as variações reais: espaços, traços, underscore e cópia numerada "(1)").

## 3. Reimportar sem novidade não paga mais análise

Este era o vazamento de dinheiro que ele descreveu. A etapa de análise **nunca recebia o id do
cliente já salvo** — o servidor descobria esse cliente na etapa anterior (por telefone, nome do
arquivo ou nome) e jogava a descoberta fora depois de pegar o cache de áudio. Sem o id, o servidor
tratava **toda** importação como conversa nova: reanalisava a conversa inteira e cobrava, mesmo
quando não havia uma única mensagem nova. Pior: a tela já dizia "mantive a análise anterior sem
nova cobrança" — uma promessa que o código não cumpria (a marca `analiseReutilizada` nunca virava
verdadeira em lugar nenhum).

Agora:

- a etapa "preparar" devolve o cliente que ela mesma identificou;
- a etapa "analisar" recebe esse id, lê do banco a conversa **e a análise** já salvas;
- **zero mensagem nova + análise salva completa (as 3 mensagens) → nenhuma chamada de IA.** A
  análise salva é mantida como está e a tela diz isso com honestidade;
- **qualquer novidade** (mensagem nova, áudio que finalmente virou texto, análise anterior
  incompleta ou com falha) → a análise roda normalmente. Novidade real merece IA.

Ainda é verdade que **uma conversa com mensagem nova é reanalisada inteira** — a análise precisa
olhar a conversa toda pra não perder contexto, e isso continua custando. O que acabou foi pagar
pelo que não mudou.

## 4. Menos espera antes de a importação sequer começar

- **Áudio que já tem texto salvo deste cliente não é mais extraído do ZIP nem enviado ao
  armazenamento.** Antes ele era descomprimido e subia só pra calcular um código de verificação que
  ninguém usaria depois — numa conversa cheia de áudio, era quase toda a espera da etapa "Abrindo o
  arquivo".
- **O ZIP preparado no celular não recompacta áudio.** Áudio de WhatsApp já é comprimido; passar
  compressão de novo gastava segundos de processador do aparelho pra não economizar nada.
- Quando o servidor identifica o cliente, a tela passa a seguir por essa identificação em vez de
  depender só do nome escrito — um nome digitado diferente entre duas importações não faz mais o
  app tratar como cliente novo aquilo que o servidor já tratou como reimportação.

## Validação

| Verificação | Resultado |
|---|---|
| Suíte completa | 314 testes verdes |
| Teste de comportamento novo | `v1141-reimportacao-nao-paga-retrabalho` (análise reaproveitada sem novidade; análise refeita com novidade; análise salva incompleta nunca reaproveitada; áudio já transcrito não é extraído; chave do arquivo igual nas duas formas) |
| Teste de tela novo | `v1141-importacao-sem-pergunta-de-periodo` |
| Testes ajustados | `v825-storage-pipeline`, `v827-4-large-zip`, `v827-11-no-audio-modal-on-boot`, `v954-reaproveitar-transcricao-por-lead` (o desenho que eles guardavam mudou de propósito) |
| `npm run build` | ok, versão 1141 |
| Navegador de verdade | app publicado aberto em Chromium headless (390×844 e desktop): boot sem erro, nenhuma janela de período, tela de importação sem progresso antes da hora |

## Arquivos alterados

**Código:** `app.js`, `index.html`, `api/_pipeline.js`, `api/_persistence.js`,
`api/processar-storage.js`

**Documentação:** `NOTAS-v1141.md` (novo)

**Versão:** `package.json`, `package-lock.json`

**Testes:** `tests/v1141-reimportacao-nao-paga-retrabalho.test.mjs` (novo),
`tests/v1141-importacao-sem-pergunta-de-periodo.test.mjs` (novo),
`tests/v1116-periodo-audios-pausa-progresso.test.mjs` (removido — guardava a janela que saiu),
`tests/v825-storage-pipeline.test.mjs`, `tests/v827-4-large-zip.test.mjs`,
`tests/v827-11-no-audio-modal-on-boot.test.mjs`,
`tests/v954-reaproveitar-transcricao-por-lead.test.mjs`
