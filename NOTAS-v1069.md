# NOTAS v1069 — fim do funil de etapas, faxina de código morto e nova regra do "Fazer agora"

## Contexto

Lista de 13 pedidos consolidados do dono, depois de várias rodadas de "espera, tem mais coisa".
Resumo do que muda pra ele, sem termo técnico:

- O sistema não vai mais falar em "etapa do funil" em lugar nenhum. Um lead só tem dois estados:
  **Ativo** ou **Arquivado**. Não existe mais Vendido, Perdido, Novo, Atendimento, Visita/Proposta,
  Negociação nem Standby como categoria separada.
- Três funções que nunca funcionaram direito e nunca vão ser usadas saíram do código de vez:
  ensinar o Cérebro por voz, extrair lead de um print, detectar rosto pra avatar e ler conversa por
  vários prints. Continua existindo transcrição de voz — mas só pra ditar uma observação dentro do
  lead, que é outra coisa.
- O botão de "Anexar" um ZIP do WhatsApp manualmente saiu do app. De agora em diante só existem
  dois jeitos de importar conversa: compartilhar direto do WhatsApp pro Corretor Pro (Android) ou
  usar o Atalho do iPhone.
- **A regra de "Fazer agora" mudou**: um cliente aparece ali se ele **nunca foi atendido** OU se já
  **passou do prazo de descanso** configurado no Cérebro — não importa mais o que a IA "acha" que
  você deveria fazer.
- "Atendido" só conta de duas formas: clicando em marcar atendimento, ou copiando uma mensagem
  sugerida. Nada mais marca um lead como atendido.
- Corrigido o lembrete fantasma que aparecia sozinho na Agenda (caso relatado: lead "Beato Broks
  Imobiliária").
- Uma limpeza grande de código morto: telas de "Marcar venda"/"Marcar perda" que não existem mais
  no app há muitas versões, mas cujo código ainda estava lá dentro — mais de 700 linhas removidas
  só nessa frente.

## 1. Fim do funil de etapas — só "Ativo" e "Geladeira" (Arquivado)

`normalizarEtapa()` (o núcleo que decide o estado de um lead) foi reduzida de 8 valores possíveis
(Novo, Atendimento, Visita/Proposta, Negociação, Standby, Vendido, Perdido, Geladeira) pra só 2:
tudo que não é reconhecido como arquivado vira **"Ativo"**; qualquer variação de
vendido/perdido/desistiu/recusou/geladeira/arquivado vira **"Geladeira"** (o valor interno que já
tínhamos pra "Arquivados" — não foi renomeado pra não mexer na coluna do banco nem no nome da
tela).

Toda a cadeia de funções que dependia das etapas antigas (mais de 15 funções de prioridade,
pontuação, badge de jornada, resumo de card, busca) foi revisada e simplificada — removidos os
ramos que comparavam com "Vendido"/"Perdido"/"Visita/Proposta"/"Negociação"/"Novo"/"Atendimento",
já que `normalizarEtapa()` nunca mais devolve esses valores. Ficaram só os sinais baseados em
fatos reais (palavras-chave, engajamento, campos da análise da IA).

**Importante — o que NÃO mudou**: a "jornada" que aparece dentro do lead (Descoberta → Interesse →
Comparação → Análise financeira → Negociação → Decisão) é outra coisa — vem da leitura da IA sobre
o momento da conversa (`diagnostico.etapa`), não é a etapa administrativa do funil. Essa continua
existindo, porque não é o que o dono pediu pra remover.

**Dados existentes**: quem já estava marcado como Vendido, Perdido ou Geladeira no banco passa a
aparecer, automaticamente, como **Arquivado** (decisão confirmada com o dono) — não precisou de
migração no banco, porque `normalizarEtapa()` já faz essa conversão na leitura.

`api/lead-update.js`: a ação `etapa` só aceita `"Ativo"` ou `"Geladeira"` agora — qualquer outro
valor é recusado com erro claro.

**Bug real corrigido no caminho**: como não existe mais o estado "Visita/Proposta", o botão
"Proposta feita" (dentro do lead) estava tentando gravar essa etapa no servidor e ia começar a
falhar (erro "Etapa inválida"). Corrigido: "Proposta feita" agora só registra o evento na linha do
tempo do lead, sem tentar mudar a etapa (que não muda mesmo — o lead continua Ativo até ser
arquivado).

## 2. Nova regra do "Fazer agora" — revoga a v1057 e o aviso da IA da v1068

Pedido literal do dono, resolvendo uma sequência de idas e vindas: **"Se ele nunca foi atendido,
ele deve sim aparecer no fazer agora... Ele só vai aparecer em fazer agora, se ele nunca foi
atendido ou passa daquele prazo que eu defini lá no cérebro."**

Isso muda duas coisas que a v1057 e a v1068 tinham decidido:

- **Antes (v1057)**: quem nunca tinha sido atendido nem uma vez não entrava em "Fazer agora" — só
  em "Oportunidades esquecidas". **Agora**: nunca ter sido atendido é, sozinho, motivo suficiente
  pra aparecer em "Fazer agora".
- **Antes (v1068)**: se a IA tivesse acabado de recomendar "aguardar, não mande mensagem agora"
  pra aquele cliente, ele saía do topo da fila. **Agora**: esse aviso da IA não conta mais pra essa
  fila — só a data do último atendimento decide.

A fila de "Fazer agora" passa a mostrar um lead se, e só se: ele não foi contatado hoje, não tem
compromisso já marcado na Agenda (esse vai pra lá), **e** (nunca foi atendido **ou** já passou do
prazo de descanso configurado no Cérebro — por exemplo, 14 dias). Volume de mensagens do cliente
deixou de ser um pré-requisito: um cliente com quem você já falou (por sua conta) mas que nunca
respondeu também precisa aparecer, se ele nunca foi marcado como atendido.

## 3. "Atendido" só por ação explícita — verificado, não mudou nada

O pedido era: um lead só conta como atendido se você clicar em "marcar atendimento" ou copiar uma
mensagem sugerida. Conferido em profundidade: já era assim (fixado numa versão anterior). No
caminho, achamos e removemos um botão de atalho ("Já falei — tira da fila de hoje") que marcava
atendimento por fora dessas duas ações — ele já estava em código morto (a lista onde ele vivia não
é mais renderizada por nenhuma tela do app), mas foi removido também, junto com a função que ele
chamava, pra não sobrar essa exceção nem em teoria.

## 4. Removido do código (não só da tela): ensinar o Cérebro por voz, extrair print, detectar
rosto, ler prints de conversa

- **Ensinar o Cérebro por voz**: a tela já tinha sido removida numa versão bem anterior (v919). A
  única coisa que restava no servidor era a transcrição de voz — mas hoje ela serve pra outra
  função (ditar uma observação dentro do lead), então não precisou de nenhuma mudança: essa função
  não é mais "ensinar por voz", é "observação por voz de um lead específico".
- **Extrair lead de um print, detectar rosto pra avatar, ler conversa por vários prints**: essas
  três nunca funcionaram bem e o dono confirmou que nunca vai usar. Removidas por completo: as três
  ações do servidor (`api/lead-update.js`), toda a cadeia de funções no app que preparava a
  imagem/preview pra essas ações, e o teto diário de custo que elas tinham ganhado na v1068 (não
  faz sentido mais, já que a ação não existe). Continua existindo só a **observação em texto**
  manual — exatamente como pedido.

## 5. Removido do código: importar ZIP manualmente (botão "Anexar")

O corretor não vai mais "puxar" um ZIP de dentro do app — sempre vai ser o WhatsApp mandando pra
cá (compartilhar direto, no Android) ou o Atalho do iPhone (mantido, por decisão do dono ao ser
consultado). O card com "Selecionar ZIP do WhatsApp" / botão "Anexar" saiu da tela "Importar
conversa", que agora só explica os dois jeitos certos de importar. Removidos também: o campo de
arquivo escondido que existia só pra esse botão, os 5 outros lugares que abriam esse mesmo seletor
(menu "Mais ações", tela inicial vazia, atalhos de teclado) — todos agora levam pra tela de
instruções em vez de abrir um seletor de arquivo. O que processa a conversa por trás
(`processFile`) não foi tocado — ele é o mesmo motor usado pelo compartilhamento direto, então
nada quebrou nesse fluxo.

## 6. Bug corrigido: lembrete fantasma na Agenda (caso "Beato Broks Imobiliária")

Relato do dono: um lead apareceu na Agenda com "Lembrar em 31/07/2026 — Retomar contato", um
lembrete que ele nunca agendou. Causa: quando uma conversa já existente é reimportada/atualizada,
dois pontos diferentes do código carregavam o lembrete anterior pra frente sem checar se aquele
lembrete era "automático" (resíduo de uma extração antiga por texto, de antes da v988) ou
realmente posto à mão pelo corretor:

1. `api/lead-update.js` (ao atualizar um lead com nova conversa).
2. `api/_persistence.js` (na mesclagem de uma nova análise com a anterior).

As duas foram corrigidas pra descartar de vez qualquer lembrete marcado como automático nesse
processo. Foi adicionada ainda uma rede de segurança na leitura: mesmo que algum lembrete
fantasma tenha sobrevivido no banco de antes dessa correção, ele nunca mais chega até a tela.
Teste de regressão: `tests/v1069-lembrete-nao-reaparece-em-reimportacao.test.mjs`.

## 7. Faxina de código morto

Trecho por trecho do que saiu, tudo confirmado sem nenhum ponto de chamada restante antes de
apagar:

- **"Marcar venda" / "Marcar perda"** (o pedido mais antigo, já apontado numa auditoria anterior):
  mais de 700 linhas entre `app.js` e `api/lead-update.js` — telas de desfecho de venda/perda (3
  gerações diferentes, sobrepostas ao longo do tempo), a ação `desfecho` inteira no servidor (com 5
  funções auxiliares exclusivas dela) e os formulários de editar lead que ficaram substituídos por
  versões mais novas mas nunca foram removidos.
- **Tela "Perdidos"**: já tinha sido absorvida pela tela "Arquivados" faz tempo (v952), mas o
  código antigo (que não desenhava mais nada, porque o espaço na tela pra ele nem existe mais)
  continuava ocupando espaço — removido.
- **"Funil por etapa"**: duas versões antigas e já substituídas da tela de Condução ainda tinham
  esse gráfico de barras por etapa — como não existe mais etapa de funil, esse gráfico sempre
  mostrava tudo zerado. Removido junto com as versões antigas que o continham (a versão atual da
  tela de Condução não tem — e nunca teve — esse gráfico).
- Funções e variáveis que só existiam pra alimentar telas já removidas em versões anteriores
  (hero de "Prioridade agora", substituído desde a v942 pela lista compacta; formatação de "última
  atualização" que só o hero usava).

## Arquivos alterados

`app.js`, `api/lead-update.js`, `api/_persistence.js`, `api/_pipeline.js`, `index.html`,
`styles.css`, `ESTADO-ATUAL.md`, mais de 20 arquivos de teste (novos, atualizados ou removidos —
ver `tests/v1069-*.test.mjs` pros três novos), `package.json`/`package-lock.json` (versão
**1068 → 1069**), `NOTAS-v1069.md` (este arquivo).

## Verificação

- Suíte inteira (`npm test`) verde, incluindo os 3 testes novos desta versão.
- `npm run build` gerando build limpo.
- Nenhuma informação comercial cravada no código — tudo continua vindo do Cérebro ou da própria
  conversa, como já era.
