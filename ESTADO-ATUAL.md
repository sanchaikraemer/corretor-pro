# Estado atual do Corretor Pro

> Este é o documento de referência sobre **como o sistema está organizado hoje** — arquitetura,
> variáveis de ambiente, banco de dados, processo de publicação e pendências conhecidas. A
> auditoria técnica/comercial de 27/07/2026 apontou falta de "um único documento de estado atual"
> em meio a mais de 190 notas de versão acumuladas (`NOTAS-v*.md`) — este arquivo é essa
> referência única. As notas de versão continuam existindo como **histórico** (o que mudou e por
> quê, versão a versão) — pra saber **como o sistema está agora**, comece por aqui.
>
> Regras de trabalho (como versionar, como rodar os testes, convenções já estabelecidas) continuam
> em `CLAUDE.md`, na raiz do projeto — este arquivo não repete aquilo, só descreve o estado técnico.

_Atualizado pela última vez na v1128 (04/08/2026), depois da auditoria completa do sistema pedida
pelo dono. O cabeçalho vinha dizendo "atualizado na v1068" havia 60 versões, mesmo com trechos já
reescritos até a v1120 — a auditoria pegou isso e a v1128 acertou. Mudanças desta rodada: a rota
nova `criar-conta.js` (seção 2), a trava de cadastro por conexão e a migração `0013` (seções 3 e
4), e a seção 8 (pendências) revisada de ponta a ponta — a confirmação de e-mail saiu de vez da
lista (decisão do dono: quem se cadastra entra na hora e a venda é fechada por telefone depois), e
a cobrança manual deixou de ser pendência pelo mesmo motivo. Ver `NOTAS-v1128.md`._

_Atualizado na v1190, depois da auditoria do sistema pedida pelo dono (com uma ordem de correção
externa em PDF, conferida item por item contra o código antes de qualquer mudança). Nesta rodada:
a inferência de "cliente esperando resposta" saiu dos últimos lugares onde ainda vivia (seção 7),
o acesso antigo por chave compartilhada passou a nascer desligado em produção e o cadastro passou
a falhar fechado sem a migração 0018 (seções 3, 4 e 7), e o aprendizado automático da IA ganhou
fronteiras (seção 7). Ver `NOTAS-v1190.md`._

_Retoque na v1141: a importação **não pergunta mais o período dos áudios** (usa o "Período padrão
dos áudios" do Cérebro) e a reimportação passou a reaproveitar o que já está salvo — a seção 2
descreve como isso funciona em `processar-storage.js`. Ver `NOTAS-v1141.md`._

_**Correção na v1241 (a linha acima envelheceu e estava enganando):** desde a **v1221**,
reimportar SEMPRE reanalisa, mesmo sem nenhuma mensagem nova — porque as regras do Cérebro podem
ter mudado desde a última leitura. O reaproveitamento da v1141 vale para o trabalho pesado que não
precisa repetir (áudio já transcrito não é transcrito de novo), NÃO para a análise. E desde a
**v1241** a conversa vai **inteira** para a IA em toda análise: o modo incremental (resumo do que
já foi lido + só a novidade) está desligado por padrão e só volta por
`DIRECIONA_INCREMENTAL_MIN_CHARS`. Ver `NOTAS-v1221.md` e `NOTAS-v1241.md`._

_**v1247 — o prompt/Cérebro/análise voltou ao estado da v1225 (fim de 11/08/2026)**, a pedido do
dono ("de ontem pra hoje está cada vez pior"). O que foi desfeito: v1230, v1235, v1236, v1239,
v1240, v1241 (parte de prompt), v1243, v1244 e v1245. O que ficou de tudo isso: histórico integral
(conversa inteira, teto técnico em 120.000 caracteres), a saudação certa por horário, a detecção
correta de quem é a voz do corretor e a regra que proíbe inventar ação/novidade do corretor. Ver
`NOTAS-v1247.md`._

_**v1248 — auditoria de ponta a ponta (13/08/2026), sem tocar no Cérebro/prompt/análise.** Nesta
rodada: a ponte preguiçosa da importação (v1195) ganhou tratamento de erro — sem ele, uma falha ao
baixar `js/importacao.js` deixava o app travado na tela de compartilhamento pra sempre (seção 1); a
trava otimista de `reanalisar-lead.js` passou a comparar `atualizado_em` (era `updated_at`, coluna
que a rota nunca escreve — a trava não travava nada) e a releitura antes de salvar deixou de
descartar erro (seção 2); `acaoApagar` em `lead-update.js` não varre mais a carteira inteira duas
vezes — `aprenderRespostasDaCarteira` saiu do caminho do apagar (a lista `corretor-respostas` que
ela produz não é lida por ninguém desde a v1212) e a limpeza de vínculos filtra no banco (seções 2 e
8); o cache de resposta de `leads-recentes.js` ganhou faxina e teto, e o backup completo deixou de
ser indentado (seção 2). Na tela: importar conversa virou item do menu da esquerda e botão na Home
do celular, o número da versão parou de aparecer cortado no celular, e o encurtador de produto
parou de devolver conectivo solto. Ver `NOTAS-v1248.md`._

_**v1251 — "Seus números do mês" na Home.** O quadradinho "Atendidos" (hoje/semana/mês) saiu da
fileira e virou um painel com as três contagens + as mensagens trocadas no mês (total, enviadas
pelo corretor, recebidas do cliente) + gráfico de atendimentos dia a dia. **Aberto no computador**
(na coluna da direita da Home, desligada desde a #810 por repetir indicadores — a regra que a
matava passou a valer só no celular) e **fechado no celular** (linha de resumo que abre o painel).
Junto veio um conserto: as "mensagens trocadas" eram contadas no navegador em cima da prévia de 8
mensagens por lead e saíam muito menores que a realidade — agora `_persistence.js` conta na
varredura da conversa inteira e devolve `msgMesTotal`/`msgMesCliente`/`msgMesCorretor` prontos
(`_statsCache` subiu pra **v4**: a primeira carga depois de publicar faz uma varredura completa por
lead e volta ao regime barato). Tudo do 1º ao último dia do mês, calendário de Brasília. Ver
`NOTAS-v1251.md`._

_**v1271 — a conferência final passou a ter 10 itens** (era 8): entraram a retomada da pausa que o
próprio cliente marcou ("estamos em viagem, no retorno eu chamo" → puxar o acontecimento, trazer a
vantagem de decidir na fase atual e propor **dia nomeado** + horário) e o pedido que partiu do
próprio cliente. Junto, o bloco "Detalhes comerciais" do cliente ganhou duas linhas: **"O que o
cliente pediu por conta própria"** e **"O que ainda falta descobrir"** (campos `pedidoEspontaneo` e
`faltaDescobrir` do diagnóstico). Ver `NOTAS-v1271.md`._

_**v1277 — a oferta que o cliente já ignorou não volta com outras palavras.** O pedido enviado à IA
passou a levar um fato objetivo novo: **quantas mensagens o corretor mandou no fim da conversa sem
nenhuma resposta** (contadas por DIA de contato, não por balão) e o **texto delas**
(`tentativasSemRespostaDoCorretor`, em `_pipeline.js`). Com isso entraram a regra dura "a mensagem
que já foi ignorada não volta com outras palavras" (licença já pedida e não respondida vira
entrega; duas ou mais tentativas sem resposta obrigam pelo menos uma das três a propor pessoa a
pessoa com dois dias/horários concretos; e é proibido contar as tentativas pro cliente) e o **item
11 da conferência final**. O código só conta e informa — nenhuma mensagem é reescrita. Ver
`NOTAS-v1277.md`._

_**v1279 — quando o cliente já disse o que quer, a busca é trabalho do corretor.** O ângulo
"maisSuave" (a sugestão nº 2 da tela) deixou de mandar "faça a pergunta que falta" — ele só pode
carregar pergunta inédita e emendada na entrega. Entraram três regras no pedido enviado à IA: o
cliente que já entregou o critério recebe condução e encontro (o que falta vira pauta do encontro,
e opções são duas ou três escolhidas, nunca a carteira inteira); **objeção que o produto não
resolve** (prazo de entrega, local, tipologia) troca o produto em vez de insistir nele; e o que o
cliente contou de si (idade, saúde, fase da vida) guia a escolha mas **não volta escrito como
etiqueta** ("pensando na sua faixa de idade"). Junto veio o **item 12 da conferência final**. Ver
`NOTAS-v1279.md`._

_**v1287 — a observação que É conversa colada vira conversa, e acabou o chute de data.** Duas
mudanças que vieram do mesmo print (17/08/2026). (1) **Observação colada**: quando o corretor cola
no campo de Observação um trecho no formato do WhatsApp, `expandirObservacoesColadas`
(`_pipeline.js`) separa cada fala, atribui o lado e encaixa na ordem certa do histórico ANTES de
qualquer conta — sem isso, a fala mais recente do CLIENTE valia como recado do corretor e o pedido
enviado à IA dizia "tentativas do corretor ainda sem resposta: 4" para uma cliente que tinha
respondido quatro vezes em três dias (daí a sugestão marcar visita e afirmar envios que nunca
houve). Nada é reescrito e nada muda no banco: é leitura de FORMATO, e anotação comum continua
anotação. Junto, anotação do corretor deixou de contar como mensagem no cálculo de tempo parado.
(2) **REGRA DA DATA**: os dez trechos que mandavam a IA cravar dia e hora ("quinta às 18h ou sábado
de manhã") foram substituídos pela **pergunta do dia ao cliente** — nomear dia da semana, data ou
hora só é permitido quando já está escrito na conversa ou no Cérebro. O vago ("fico à disposição")
continua proibido. Também entrou, dentro do item 4 da conferência, a **única pergunta que
destrava** (faixa de valor + entrada) quando o cliente já deu o critério do imóvel e o dinheiro
nunca foi perguntado. Guardas: `tests/v1287-observacao-colada-vira-conversa.test.mjs`,
`tests/v1287-nenhuma-data-chutada.test.mjs` e a 9ª conversa da bateria. Ver `NOTAS-v1287.md`._

_**v1289 — o histórico antigo não manda mais na análise.** Três regras que faltavam, todas do mesmo
buraco (o passado da conversa pesando mais que o presente): **mudança de planos DECLARADA** ("agora
é apartamento", "desisti do terreno") tira o produto antigo da condução — antes só a *recusa*
estava escrita (v1279), e anúncio de mudança não é recusa; **silêncio não é aceite** — valor que o
cliente nunca comentou, ou tabela de outro produto/outra época, não vira `faixaDeValor` (foi assim
que uma tabela de 2024 virou "o orçamento" de uma cliente que trocou de produto), e a faixa em
"Não identificado" é justamente o que faz aparecer a pergunta do dinheiro do item 4; e **quando uma
das opções chega mais perto do que o cliente pediu, a mensagem diz qual e por quê** — entregar duas
ou três empatadas devolve pro cliente a escolha que ele procurou um corretor pra fazer. Guarda:
`tests/v1289-historico-antigo-nao-manda.test.mjs`. Ver `NOTAS-v1289.md`._

_**v1301 — a análise parou de receber informação de OUTRO cliente.** Ordem direta do dono, com o
print das 19h36 de 18/08/2026 na mão: numa conversa de três linhas (anúncio com dormitórios, box e
preço; o cliente pedindo para saber mais e escrevendo "móveis"), as três sugestões voltaram
afirmando **em que empreendimento** o apartamento estava e **perto de que rua** ficava. Nada disso
existia na conversa. A regra "nunca invente" já estava escrita em três lugares do pedido e não
segurou — porque o próprio sistema entregava à IA, em toda análise, material que não é do lead:
(1) até 4 **casos de outros clientes** (`casosSemelhantesPrompt`, ligado na v1212), (2) o bloco
inteiro de **fatos ensinados da carteira** (`conhecimentoCorretorTexto`, ligado na v1115) e (3) o
cruzamento **produto × perfil** dentro do "SEU JEITO", que escrevia o nome do empreendimento
oferecido a outro cliente. Os três saíram do pedido. Continuam sendo aprendidos, guardados e
mostrados na tela de Aprendizado — só não entram mais na hora de escrever as três mensagens. O que
continua indo: o **Cérebro inteiro**, o **jeito de escrever** do corretor e as **mensagens reais
dele nesta conversa**. Preço assumido: perguntado o endereço, o aplicativo não responde de cabeça —
se oferece pra confirmar. Guardas: `tests/v1301-nada-de-outro-cliente-na-mensagem.test.mjs`,
`tests/v1212-casos-reais-entram-na-analise.test.mjs` (seção final) e
`tests/v1115-conhecimento-lido-e-fatos-nao-inventados.test.mjs` (seção 2, invertida).
Ver `NOTAS-v1301.md`._

_**v1302 — a sugestão não descreve mais o produto sozinha, e prometer mandar deixou de contar como
resposta.** Print de 18/08/2026, 20h14, numa conversa de duas linhas (saudação automática do anúncio
+ "posso ter mais informações sobre isso?"): as três sugestões descreveram o catálogo do prédio a
partir da única linha do anúncio ("conta com apartamentos de 3 suítes", quando há unidade de 2
também), elogiaram o que ninguém disse ("estrutura moderna", "perfil bem procurado") e só anunciaram
que iam enviar informação. Duas das três já eram proibidas desde a v1299 e escaparam por vocabulário:
a rede conhecia "só me avisar" e não "só me falar", conhecia "se quiser posso" e não "pode ser?".
Agora: lista de fechos ampliada (falar/dizer/sinalizar/passar), "pode ser?"/"posso?" entram como
pedido de licença ("tudo bem?" fica fora — é saudação), afirmação sobre o produto passa a ser
conferida contra **a conversa** (endereço, qual imóvel é) e contra **o Cérebro** (como o produto é), e
mensagem que só promete enviar "informações/detalhes/resumo" sem perguntar nada volta pra IA
reescrever como pergunta que permite selecionar. Mecanismo é o mesmo das v1295/v1299 — o código
percebe, a IA reescreve inteira, nada é cortado nem descartado. Guarda:
`tests/v1302-sugestao-que-nao-responde-e-inventa.test.mjs`. Ver `NOTAS-v1302.md`._

_**v1303 — o Cérebro passou a ir junto na reescrita da mensagem.** Print de 18/08/2026, 20h40 ("não
sei pra que serve todas aquelas regras do cérebro se não são usadas"). Quando uma sugestão é barrada
pela rede (v1295/v1299/v1302), ela volta pra IA reescrever — e é essa segunda escrita que aparece na
tela. Essa chamada recebia **só a mensagem furada e regras genéricas**: sem Cérebro, sem tom, sem as
regras do corretor e sem a conversa. Quanto mais a rede pegava, mais texto sem as regras dele chegava
na tela. Agora a reescrita recebe o mesmo Cérebro da análise e o fim da conversa (4.000 caracteres),
com janela de até 20s dentro do mesmo orçamento; falhou ou não coube, vale o texto original. Junto,
três buracos fechados: "Posso te passar…" passa a cair sempre (antes exigia "?" logo depois), o
catálogo afirmado por conta própria passou a cobrir "temos/dispomos de/trabalhamos com", e a regra
**UM CAMINHO SÓ** (escrita no pedido desde a v1296, sem rede até aqui) ganhou rede: pergunta com "ou"
sobre o que o CORRETOR faz cai; sobre o que o CLIENTE precisa ("2 ou 3 dormitórios?") e oferta de dois
horários continuam livres. Guarda: `tests/v1303-cerebro-na-reescrita-e-um-caminho-so.test.mjs`. Ver
`NOTAS-v1303.md`._

_**v1304 — a prova embaixo das sugestões virou porcentagem.** Pedido do dono: "mude esses números
para percentual, verde 100% e quando não conclui vermelho". As seis contagens de caracteres do
Cérebro ("método 6.577, tom 1.892…") viraram uma porcentagem só — quanto do Cérebro SALVO chegou na
IA nesta análise (`contarCerebroEnviado` passou a devolver `salvo` e `percentual`) — e o "leu a
conversa inteira" virou "leu 100% da conversa". Verde só no 100% (`--green`); abaixo disso vermelho
(`--risco`) com o motivo ao lado. Isso torna visível o corte por teto de campo do Cérebro
(`MAX_CAMPO_CEREBRO_LIVRE`), que até aqui acontecia sem ninguém ver. Conferido em Chromium headless a
412 px sobre o CSS publicado. Guarda: `tests/v1304-cerebro-em-porcentagem.test.mjs`. Ver
`NOTAS-v1304.md`._

_**v1305 — endereço inventado, preço vencido e aviso na tela.** Dois prints de 19/08/2026. (1) À
pergunta "Onde fica? Endereço", as três sugestões responderam com rua, número e ponto de referência
inexistentes na conversa; a checagem da v1301 falhava com conectivo no meio ("Rua **das** Flores") e
com substantivo antes do nome ("hospital HCC") — agora a checagem parte da PALAVRA DE ENDEREÇO
(rua/avenida/bairro/número) e dos pontos de referência, e cobra que estejam na conversa ou nas
observações do lead. (2) Preço anunciado em 30/10/2025 voltou como preço de hoje para uma cliente que
reapareceu dez meses depois: `valoresAntigosDaConversa` passa a medir a IDADE de cada valor citado e
o pedido leva isso como fato ("R$ X — dito há N dias", prazo de validade de 60 dias), com rede que
barra o número velho na sugestão. (3) `sugestoesComProblema` viaja com a análise e a linha de prova
mostra em vermelho "N sugestões saíram com problema (confira antes de enviar)" quando o app não
conseguiu limpar. Guarda: `tests/v1305-endereco-inventado-e-aviso-na-tela.test.mjs`. Ver
`NOTAS-v1305.md`._

_**v1306 — a importação lê imagem e PDF (vídeo não).** Pedido do dono em 19/08/2026, depois do caso
em que o preço atual estava na ARTE do anúncio e a IA respondeu com o preço em texto de dez meses
antes. A importação passa a ler JPG/PNG/WEBP e PDF citados na conversa (`lerArquivosVisuais`, modelo
de visão; PDF vai pelo canal de arquivo do OpenAI, não como imagem) e o texto lido entra na linha do
tempo na própria mensagem do anexo, com rótulo "[Imagem lida pela IA]" / "[Documento lido pela IA]".
Travas: no máximo 6 arquivos por importação (`DIRECIONA_MAX_VISUAIS_IMPORT`) e sempre os mais
recentes, só os citados por alguma mensagem, teto diário por conta
(`DIRECIONA_LIMITE_LEITURA_VISUAL_DIA`, padrão 120; teste 8) conferido antes de gastar, corte por
tempo (`deadlineTs`) e fail-open em qualquer erro. A leitura acontece na etapa "preparar" (os
arquivos já estão descompactados) e viaja para a análise em `leiturasVisuais`. Junto: o NOME do
arquivo anexado passou a ser preservado (campo `anexos` da mensagem) — sem ele não havia como ligar a
imagem lida à mensagem. Guarda: `tests/v1306-importacao-le-imagem-e-pdf.test.mjs`. Ver
`NOTAS-v1306.md`._

_**v1307 — link enviado pelo corretor passa a ser lido; "Última mensagem" volta ao cartão.** (1)
`linksDoCorretorNaConversa` seleciona até 2 links https recentes enviados PELO CORRETOR (link de
cliente nunca é aberto; IP, localhost, .local, porta fora da 443, credencial embutida e domínio sem
ponto são recusados por `linkPodeSerLido`); `lerLinksDaConversa` busca a página por
`baixarPaginaComSeguranca` (**endurecido na v1322**: resolve o nome e recusa endereço privado/
reservado com `ipEhPrivadoOuReservado`/`hostApontaPraRedePrivada`, segue redirecionamento em modo
`manual` conferindo cada parada — no máximo 3 —, corta o download no teto de 700 KB **enquanto
baixa** e mantém o relógio de 9s valendo até o último byte; só text/html|plain), extrai o texto
visível e faz uma leitura factual pelo modelo simples; o resultado
entra na própria mensagem do link como "[Link lido pela IA]". Página montada por JavaScript devolve
`pagina_sem_texto_legivel` e nada é inventado. Mesmo teto diário da leitura visual (v1306) e
fail-open em qualquer erro. (2) O cartão do cliente voltou a mostrar a data da última mensagem da
conversa, numa linha própria abaixo de "Último atendimento" (a v1266 tinha trocado uma pela outra e a
data da conversa sumia quando havia atendimento registrado). Guarda:
`tests/v1307-link-do-corretor-e-ultima-mensagem.test.mjs` e
`tests/v1322-leitura-de-link-blindada.test.mjs`. Ver `NOTAS-v1307.md` e `NOTAS-v1322.md`._

_**v1308 — fim do plano B silencioso, prazo marcado pelo cliente, e as três chaves da análise.**
Auditoria trazida pelo dono em 19/08/2026, medida executando o próprio código contra uma conversa
real. (1) A 2ª tentativa da análise deixou de trocar o modelo principal pelo `modeloTarefasSimples`
— roda no MESMO modelo, e a reescrita anti-robô também; falhando as duas, a análise devolve
`falhaAmigavel` ("Não deu pra analisar esta conversa agora — a IA não respondeu a tempo. Toque em
Reanalisar.") e a tela mostra isso no lugar do texto técnico. `modeloFallback` não existe mais.
Junto: `MODELOS_PADRAO.analise/mensagens/orquestrador` passaram de `gpt-4.1` para `gpt-5.6-terra`
(trocável por `DIRECIONA_MAIN_MODEL`), e a janela da 1ª tentativa deixou de reservar ~16s ociosos —
vale `orçamento - 4s` (48s por padrão, era 34s), com a 2ª tentativa só para erro PASSAGEIRO
(timeout não é repetido: `morreuDeTempo`). A única troca de modelo que sobrou é
`modeloIndisponivelParaAConta` (404/400/403 com `model_not_found`): roda em
`modeloAnteriorConhecido()` (`DIRECIONA_MODELO_ANTERIOR`, padrão `gpt-4.1`) e marca
`modeloIndisponivel`, que a tela mostra em vermelho — sem isso uma conta sem acesso ao modelo
configurado teria 100% das análises falhando sem explicação.
(2) `mensagemEhSoCortesia` tira do cálculo de `tentativasSemRespostaDoCorretor` a mensagem do
corretor que é só concordância/agradecimento/despedida — era ela que fazia "Certo, boa viagem e até
semana que vem" chegar à IA como cobrança ignorada. (3) `prazoMarcadoPeloCliente` transforma o prazo
que o PRÓPRIO cliente marcou ("semana que vem", "mês que vem", "depois do dia 20", "daqui a N dias",
"amanhã", "quando eu voltar") em data de calendário e manda como fato (`PRAZO MARCADO PELO PRÓPRIO
CLIENTE`), dizendo se ainda está correndo — sem criar lembrete: agendamento continua só por ação do
corretor. (4) `exemplosDoCorretor` deixou de incluir a saudação automática de anúncio e a despedida
de uma linha. (5) `problemasPorSugestao` diz QUAL das três saiu com problema e o quê; o aviso aparece
dentro da própria sugestão e a linha de prova passa a citar o número dela. (6) Bloco novo no prompt
"MEDIR O TAMANHO DO OBSTÁCULO — FAÇA A CONTA" + campo `contaDoObstaculo` no diagnóstico (linha "A
conta da troca" nos detalhes comerciais): quando o negócio depende de um imóvel na troca, a IA
calcula a porcentagem e compara com o limite que o Cérebro declara. (7) Três chaves em Cérebro →
Chaves da análise (`usarCerebro`, `usarAprendizado`, `usarRegrasEscrita`, padrão LIGADO e ausente =
ligado) pausam, separadamente, o Cérebro, o aprendizado e as duas listas "PROIBIDO" de escrita; nada
é apagado do prompt e `modoAnalise` viaja com a análise pra tela avisar em destaque quando alguma
está desligada. Guarda: `tests/v1308-sem-plano-b-prazo-do-cliente-e-chaves.test.mjs`. Ver
`NOTAS-v1308.md`._

## 1. Arquitetura

- **Front-end**: JavaScript puro (sem framework), servido como PWA (Service Worker,
  `manifest.json`, instalável no celular). Tela principal em `index.html` + `app.js` (arquivo
  grande — ver seção 8, "Pendências conhecidas") mais os módulos de `js/` (`state.js`, `dom.js`,
  `proposta.js`, `pwa-install.js`, `dados-locais.js`, `commercial-schema.js`, `saudacao.js`,
  `envio-retentativa.js` e o
  `importacao.js`, este último baixado sob demanda). A biblioteca do Supabase que vai pro navegador
  é montada no build a partir da oficial, com os módulos não usados (tempo real, Storage no
  navegador, Edge Functions) trocados por peças vazias em `vendor-enxuto/` — 200 KB viraram 124 KB;
  o servidor (`api/`) segue com a biblioteca completa (ver `NOTAS-v1196.md` e a guarda
  `tests/v1196-supabase-enxuto.test.mjs`). Painel administrativo separado
  (`admin-plataforma.html`), telas de conta (`cadastro.html`, `entrar.html`,
  `recuperar-senha.html`, `redefinir-senha.html`).
- **Backend**: funções serverless na Vercel, uma por arquivo em `api/*.js` com
  `export default async function handler`. Arquivos com `_` no início (`_persistence.js`,
  `_pipeline.js`, `_zipUpload.js`, `_iaCusto.js`) são módulos internos importados pelas rotas —
  não viram função por conta própria (convenção da própria Vercel).
- **Banco de dados, autenticação e armazenamento**: Supabase (Postgres + Supabase Auth +
  Supabase Storage).
- **Inteligência artificial**: OpenAI (Chat Completions pra análise/mensagens, Whisper pra
  transcrição de áudio).
- **Multiempresa**: cada corretor pertence a uma `organization` (tabela `organizations`), vínculo
  em `memberships`. Toda tabela de dado de cliente carrega `organization_id`. Chave da empresa
  original (dono da plataforma), fixa: `00000000-0000-0000-0000-000000000001`
  (`EMPRESA_PRINCIPAL_ID` em `api/_persistence.js`).

## 2. Rotas da API (`api/*.js`)

O plano gratuito (Hobby) da Vercel permite no máximo **12** Serverless Functions por publicação
(ver `NOTAS-v1039.md` — isso já travou publicações por dias sem ninguém perceber). O projeto
esteve nas 12 até a v1082; a v1083 removeu duas rotas (`analisar.js`, sem nenhum chamador, e
`limpar-tudo.js`, junto com o botão "Apagar tudo" — decisão do dono); a v1128 acrescentou
`criar-conta.js`. **Hoje são 11, com 1 vaga livre.**

| Rota | O que faz |
|---|---|
| `admin-contas.js` | Painel administrativo: excluir conta (`POST action:excluir-conta`), definir plano/marcar pago (`POST action:definir-plano`), zerar a contagem de análises do dia de uma conta (`POST action:zerar-limite-analises`, v1174) e relatórios de uso de IA, de planos e de consumo do teto diário (`GET ?relatorio=uso-ia` / `?relatorio=planos` / `?relatorio=limites`, v1174) — todas exclusivas do administrador da plataforma. |
| `atalho-zip-token.js` | Gera/mostra a chave pessoal do Atalho do iPhone (ver `NOTAS-v1035.md`). |
| `cerebro-config.js` | Configuração do Cérebro Comercial + aprendizado contínuo. **v1250**: ação `ler-print` — passa pra texto o que está escrito num print da resposta do cliente (modelo de visão, teto diário próprio `cerebro-leitura-print`), pra esse texto entrar no campo de observação do lead sem o corretor precisar mandar a conversa inteira de novo. A ação NÃO grava nada: quem salva é o corretor, depois de conferir (ver `NOTAS-v1250.md` — não confundir com "extrair lead de print"/"ler conversa por vários prints", removidas na v1069 por não funcionarem). **v1170**: também serve o bloco de notas administrativas (`action: nota-adicionar/nota-concluir/nota-remover`, chave própria `notas-rapidas` em `direciona_config` — separada de propósito da chave do Cérebro, pra uma nota administrativa nunca virar contexto de uma sugestão de mensagem pro cliente). **v1199**: a leitura padrão (GET) também devolve `planoAtual` (via `obterPlanoAtual` em `_pipeline.js` — só leitura, nunca reserva/gasta análise) e `catalogoPlanos` (limites e preço dos dois planos comerciais), pra tela nova "Planos" (menu lateral) mostrar o plano da conta sem precisar de rota própria. |
| `criar-conta.js` | Cria a empresa de quem acabou de se cadastrar, com a trava contra cadastro falso em massa (quantas contas novas saíram da mesma conexão de internet nas últimas 24h). Única rota que usa `requireLoginSemEmpresa` em vez de `resolveOrganizationId` — quem chega aqui ainda não tem empresa, que é justamente o que ela vai criar (ver `NOTAS-v1128.md`). |
| `diagnostico.js` | `?mode=status` (variáveis de ambiente configuradas), `?mode=openai` (teste real da chave OpenAI), `?mode=bucket` (configura o bucket do Storage — só admin), `?mode=banco` (quais migrações estão MESMO aplicadas no banco — só admin, v1185; **v1191**: ganhou tela no painel administrativo, cartão "Saúde do banco de dados" — antes disso não havia como abrir, porque a rota exige o login de admin no cabeçalho e digitar o endereço no navegador devolve 403). |
| `lead-update.js` | Ações sobre um lead: etapa (só Ativo/Geladeira), memória, aprendizado, lembrete, apagar, editar, salvar novo, criar manual, etc. Nota (v1092): `lembrete-set`/`lembrete-clear` foram REMOVIDAS — o histórico do repositório mostra que nenhuma tela as chamou em nenhum momento do projeto (o app usa `reagendar-lembrete`/`remover-lembrete` de reanalisar-lead.js). Já `analise-comercial-set` e `nova-oportunidade-parceiro` continuam de propósito: as chamadas saíram do front só na v1073 (29/07/2026) e, como o app é PWA instalável, um celular que não abriu o app desde então ainda roda a versão em cache que as chamaria. Remover agora daria erro pra quem está desatualizado — sair numa faxina futura. **v1148**: entrou `juntar-clientes` (junta dois cadastros da MESMA pessoa — conversa dos dois numa só, o duplicado é apagado só DEPOIS de a fusão estar gravada). |
| `leads-recentes.js` | Listagem da Carteira + auditoria de qualidade dos dados (`?audit=1`) + backup completo (`?export=full`) + **assinatura da carteira (`?assinatura=1`, v1166)** — todas sempre filtradas pela própria empresa (ver `NOTAS-v1037.md`). A assinatura devolve só **quantos leads existem** e **qual foi a última alteração** (~80 bytes, contra ~1,2 MB da carteira completa numa base de 400 clientes): a atualização automática do app pergunta isso primeiro e, se nada mudou desde a carga anterior, não baixa nada. É a correção da cota de tráfego (egress) do Supabase estourada em 07/08/2026 — ver `NOTAS-v1166.md`. **Toda dúvida (erro, tempo esgotado, `indefinida: true`, primeira carga) resulta em busca completa**: economizar nunca pode esconder novidade. |
| `processar-storage.js` | Pipeline de importação por Storage: criar URL de upload (absorveu `criar-upload-url.js`, ver `NOTAS-v1039.md`), preparar, transcrever, analisar, finalizar, limpar antigos. **Reimportação (v1141)**: "preparar" identifica o cliente já salvo (telefone/arquivo/nome) e devolve o id; "analisar" recebe esse id, lê do banco a conversa e a análise já gravadas e — se a reimportação não trouxer NENHUMA mensagem nova e a análise salva estiver completa — reaproveita essa análise **sem nenhuma chamada de IA**. Áudio que já tem transcrição salva do mesmo cliente nem é extraído do ZIP. Ver `NOTAS-v1141.md`. |
| `reanalisar-lead.js` | Reanálise de um lead já importado, mais as ações rápidas sobre ele (sem IA): `remover-item`, `marcar-atendido`, `desmarcar-atendido`, `reagendar-lembrete`, `remover-lembrete` e, desde a **v1197**, `desfazer-mensagem-enviada` — desfaz uma sugestão que o corretor copiou mas não enviou, tirando de uma vez a mensagem do histórico, o atendimento do dia (só se não sobrar outra cópia no mesmo dia) e a marca de uso do Desempenho. Ela só aceita item `type: "mensagem_enviada"`: fala vinda da conversa exportada do WhatsApp não pode ser apagada por esse caminho. |
| `receber-zip-atalho.js` | Recebe o ZIP mandado pelo Atalho do iPhone (autenticação própria, por token — não é sessão do app). |
| `restaurar-leads.js` | Restauração de leads das tabelas legadas pré-multiempresa — exclusiva da empresa original (ver `NOTAS-v1042.md`). |

Antes de criar uma rota nova em `api/`, considere se ela cabe como uma ação nova dentro de uma
rota já existente (o padrão já usado em `lead-update.js`, `diagnostico.js`, `admin-contas.js`,
`processar-storage.js`) — criar um arquivo novo aproxima o projeto do limite de 12 de novo.

## 3. Variáveis de ambiente

### Obrigatórias pra funcionar
- `SUPABASE_URL` (ou `NEXT_PUBLIC_SUPABASE_URL`) — endereço do projeto Supabase.
- `SUPABASE_SERVICE_ROLE_KEY` — chave de administrador do Supabase (backend só, nunca no navegador).
- `SUPABASE_ANON_KEY` (ou `NEXT_PUBLIC_SUPABASE_ANON_KEY`) — chave pública, usada pelo navegador
  (login, `admin-plataforma.html`).
- `OPENAI_API_KEY` — chave da OpenAI.

### Segurança
- `CORRETOR_PRO_API_KEY` (ou `API_SECRET`/`CP_API_SECRET`) — chave compartilhada do caminho
  antigo (pré-login por conta); hoje só resolve pra empresa principal, nunca abre rota nenhuma
  sozinha (ver `NOTAS-v1042.md`). Sem essa variável configurada, em produção a API fica bloqueada
  por padrão — a menos que `ALLOW_UNPROTECTED_API=true` seja definida conscientemente.
- `DIRECIONA_DANGER_LIMPAR_TUDO` — **não é mais usada.** A rota `limpar-tudo.js` foi removida na
  v1083; se essa variável ainda estiver cadastrada na Vercel, pode apagar.
- `ATALHO_ZIP_TOKEN_SECRET` — segredo usado pra assinar a chave pessoal do Atalho do iPhone.
- `ALLOW_UNPROTECTED_API` — **não vale mais em produção (v1092).** Ela liberava a API sem chave e
  sem login; como toda chamada sem login é tratada como sendo da conta original, isso deixava os
  dados dela abertos pra qualquer um. Fora de produção (desenvolvimento/teste) continua valendo.
- `CORRETOR_PRO_LEGADO_ATIVO` — **(v1190)** desde esta versão, em **produção** o acesso antigo por
  chave compartilhada nasce **DESLIGADO**: só entra quem tem login de verdade. Defina como `sim`
  apenas se algum fluxo legítimo ainda depender daquela chave. Antes o padrão era o contrário (a
  porta ficava aberta até alguém lembrar de fechar), e como toda chamada por esse caminho é
  tratada como sendo da conta original, o que estava em jogo eram os dados do próprio dono. O
  Atalho do iPhone **não** depende disso desde a v1035 (usa chave pessoal assinada por empresa) e
  o app manda o login do Supabase em toda chamada; aparelho antigo que ainda guarde a chave
  recebe 401 e o próprio app o leva pra tela de entrar. Fora de produção nada muda.
- `CORRETOR_PRO_LEGADO_DESLIGADO` — o interruptor da v1092, mantido: `sim` desliga o acesso antigo
  em qualquer ambiente e **vence** o `CORRETOR_PRO_LEGADO_ATIVO`.
- `CORRETOR_PRO_CADASTRO_SEM_0018` — **(v1190)** válvula de escape do cadastro. Em produção, se a
  migração `0018` não estiver aplicada, `api/criar-conta.js` **recusa contas novas** (HTTP 503) em
  vez de cair calado no caminho antigo, que tem janela de concorrência. Definir como `sim` libera
  o caminho antigo na hora, sem publicar nada — use só enquanto a migração não é aplicada.

### Custo e limites de IA
- `CORRETOR_PRO_LIMITE_ANALISES_DIA` — teto de segurança de análises por dia (padrão 50 desde a v1112; era 200) — hoje só alcança a conta original, as demais usam os planos.
- `CORRETOR_PRO_LIMITE_ANALISES_DIA_TESTE` — mesmo teto, mas pra contas em teste grátis (padrão 5
  desde a v1109; era 10 na v1108 e 25 antes — ver `NOTAS-v1041.md`, `NOTAS-v1108.md`,
  `NOTAS-v1109.md`). **Atenção:** se essa variável estiver cadastrada na Vercel, ela MANDA sobre
  o padrão do código — confira lá antes de esperar o teto novo valer.
- `CORRETOR_PRO_WHATS_COMERCIAL` — WhatsApp comercial da plataforma (só dígitos, com código do
  país), usado no convite de contratação quando a conta em teste atinge o limite diário (v1108).
  Padrão embutido: o número do dono do produto.
- `CORRETOR_PRO_LIMITE_CADASTROS_CONEXAO_DIA` — quantas contas novas a mesma conexão de internet
  pode abrir em 24h (padrão 5, v1128). É a trava que entrou no lugar da confirmação de e-mail,
  descartada por decisão do dono. Folgada de propósito: um corretor cria uma conta, uma imobiliária
  inteira no mesmo Wi-Fi cabe, e um script numa máquina só trava na sexta tentativa. Vale de
  verdade só com a migração `0013` aplicada (ela é que tira do navegador o direito de criar empresa
  por fora). Ver `NOTAS-v1128.md`.
- **Planos comerciais (v1110 → recalibrados na v1284)** — **Pro: 50 análises/mês por R$ 49,90;
  Pro Master: 120/mês por R$ 99,90.** Os números antigos (150 e 300) davam **margem negativa**: o
  painel da OpenAI mostrou, em 17/08/2026, que uma análise custa de R$ 0,20 a R$ 0,40 e que **79%
  de toda a conta de IA é a entrada do modelo de análise**. Decisão do dono: o preço fica, o volume
  desce.
  - **Não existe mais teto diário comercial** ("independente de limite diário", dono). O campo
    `dia` dos planos virou **fusível técnico de 40/dia**, igual nos dois: existe só pra um erro em
    laço não queimar o mês numa hora, e quem esbarra nele recebe aviso de **segurança**, nunca
    oferta de upgrade. No Pro o fusível fica abaixo do pacote mensal de propósito.
  - **Bônus de carga inicial**: conta nova recebe **200 análises a mais nos primeiros 45 dias**
    (`bonusEntradaDisponivel`), pra a primeira importação da carteira caber — sem ele, quem tem 150
    conversas gastaria 3 pacotes só pra começar. É por TEMPO, somado ao teto do mês, então continua
    sendo **um número só**: a reserva atômica da `0012` e a devolução da v1174 seguem valendo, sem
    tabela nem contador novo.
  - **Estourar o mês não bloqueia seco**: a mensagem oferece o **pacote extra (30 análises por
    R$ 39)** ou o upgrade. O avulso a R$ 1,30 fica acima do R$ 1,00 de dentro do plano de propósito
    — o Pro Master sai a R$ 0,71/análise, então a conta do cliente aponta pro upgrade. A liberação
    do pacote é manual (painel → `zerar-limite-analises` com `zerarMes`).
  - A trava econômica desses números vive em `tests/v1284-planos-novos-margem-e-bonus.test.mjs`:
    **subir volume sem subir preço faz o teste falhar mostrando a conta.**

  O plano de cada conta fica em `direciona_config` (chave `plano-contratado`), definido pelos
  botões "Pago · Pro" / "Pago · Pro Master" do painel administrativo (que também marcam a conta
  como ativa). Conta ativa sem registro = Pro. A conta original fica FORA dos planos (só o fusível
  técnico de `CORRETOR_PRO_LIMITE_ANALISES_DIA`, padrão 150/dia desde a v1174). Overrides:
  `CORRETOR_PRO_LIMITE_DIA_PRO`, `CORRETOR_PRO_LIMITE_MES_PRO`,
  `CORRETOR_PRO_LIMITE_DIA_PROMASTER`, `CORRETOR_PRO_LIMITE_MES_PROMASTER`,
  `CORRETOR_PRO_BONUS_ENTRADA`, `CORRETOR_PRO_PACOTE_EXTRA_ANALISES`,
  `CORRETOR_PRO_PACOTE_EXTRA_PRECO`.
- `CORRETOR_PRO_LIMITE_TRANSCRICAO_VOZ_DIA` / `CORRETOR_PRO_LIMITE_TRANSCRICAO_VOZ_DIA_TESTE` —
  mesmo tipo de teto, pra transcrição de voz avulsa (observação por voz do lead, `cp7Obs`) —
  padrão 100/dia (20/dia em teste, ver `NOTAS-v1068.md`). As 3 ações de visão (extrair print,
  detectar rosto, ler prints de conversa) e o teto que tinham (`CORRETOR_PRO_LIMITE_VISAO_DIA`)
  foram removidos do código na v1069 — o dono nunca usou essas 3 funções.
- `CORRETOR_PRO_COTACAO_USD_BRL` — cotação usada pra estimar custo de IA em reais no painel administrativo (padrão 5,50).
- `SUPABASE_ZIP_BUCKET` — nome do bucket de Storage (padrão `whatsapp-zips`).
- `SUPABASE_ZIP_MAX_BYTES` — tamanho máximo de ZIP aceito.
- `MAX_AUDIO_TRANSCRIPTIONS` — limite de áudios transcritos por importação.

### Modelos de IA (todas opcionais — têm padrão embutido em `api/_pipeline.js`)
`DIRECIONA_MAIN_MODEL`, `DIRECIONA_FAST_MODEL`, `DIRECIONA_IMPORT_MODEL`,
`OPENAI_TRANSCRIPTION_MODEL`, `OPENAI_VISION_MODEL`, `OPENAI_SIMPLE_MODEL`, `OPENAI_MODEL`,
`OPENAI_ORQUESTRADOR_MODEL`, `OPENAI_REASONING_EFFORT`.

### Outras
`OPENAI_BASE_URL`/`OPENAI_API_BASE`, `OPENAI_ORG_ID`/`OPENAI_ORGANIZATION`,
`OPENAI_PROJECT_ID`/`OPENAI_PROJECT` (conta/projeto da OpenAI, não confundir com organização do
Corretor Pro), `DIRECIONA_ANALYSIS_MAX_TOKENS`, `DIRECIONA_ANALYSIS_TIMEOUT_MS`,
`DIRECIONA_MAX_CONTEXT_CHARS`, `DIRECIONA_LIMITAR_HISTORICO`, `DIRECIONA_USAR_APRENDIZADO_AUTO`,
`DIRECIONA_MAX_VISUAIS_IMPORT`, `DIRECIONA_LIMITE_LEITURA_VISUAL_DIA`, `DIRECIONA_LIMITE_LEITURA_VISUAL_DIA_TESTE`,
`DIRECIONA_USAR_CONHECIMENTO_AUTO`, `DIRECIONA_USAR_ESTILO_AUTO`.

## 4. Banco de dados — migrações

Migrações vivem em `supabase/migrations/`, numeradas e aplicadas manualmente (SQL Editor do
Supabase — nenhuma ferramenta de migração automática está configurada). Lista atual:

| Arquivo | O que faz |
|---|---|
| `0000_baseline.sql` | **O PONTO DE PARTIDA (v1285).** Cria `whatsapp_processamentos` (a tabela dos leads: conversa + análise de cada cliente) e `direciona_config` (Cérebro, plano contratado, contadores, chave do Atalho). Essas duas foram feitas **à mão** no começo do projeto e **nunca existiram em migração nenhuma** — da `0001` em diante elas só eram ALTERADAS, e `alter table if exists` num banco vazio não faz nada, em silêncio. Era o achado A5 da auditoria de 16/08/2026: **o repositório não conseguia reconstruir o banco** (banco perdido = sem volta; e impossível montar ambiente de teste igual ao de produção). Cria o formato **anterior à `0001`** — sem `organization_id`, sem as colunas de deduplicação — pra a corrente `0001 → 0019` continuar contando a mesma história. **É seguro rodar em produção e lá não faz nada** (tudo `create table if not exists`). Conferido num Postgres 16 de verdade: banco vazio + as 20 na ordem → `conferir_migracoes()` devolve tudo como "aplicada"; rodar a `0000` de novo num banco pronto = 28 colunas antes, 28 depois. **Corrigida na v1286 com o formato REAL de produção.** A primeira versão (v1285) foi derivada do código e errava: faltavam `lead_id`, `nome` e `nome_cliente` (o código só encosta nelas pelo caminho adaptativo, então ler o código não as revelava) e quase todos os valores padrão. O dono rodou a consulta de leitura do README no Supabase e o resultado ficou guardado em `supabase/estrutura-producao-2026-08-17.txt` — a única fonte não-inferida do formato dessas tabelas. **Reconferido num Postgres 16: banco vazio + as 20 migrações produz EXATAMENTE as 31 colunas da produção, mesmos tipos, mesma ordem, mesmos padrões, mesma obrigatoriedade.** Guarda: `tests/v1285-banco-nasce-do-repositorio.test.mjs`. |
| `0001_contas_e_empresas.sql` | `organizations`, `memberships`, coluna `organization_id`, RLS inicial. |
| `0002_migrar_dados_existentes.sql` | Cria a "Empresa 1" e atribui a ela todo dado sem organização. |
| `0003_teste_e_administracao.sql` | Teste de 7 dias, status da conta, `platform_admins`, `criar_empresa_e_dono`, painel administrativo. |
| `0004_cerebro_por_corretor.sql` | Primeiro passo pra Cérebro por corretor. |
| `0005_abrir_cerebro_multiconta.sql` | `organization_id` obrigatório em `direciona_config`. |
| `0006_uma_empresa_por_login.sql` | Trava (no código) contra criar mais de uma empresa pelo mesmo login. |
| `0007_excluir_organizacao_transacional.sql` | Exclusão de empresa numa transação só. |
| `0008_telemetria_uso_ia.sql` | Tabela `ai_usage_events` (uso de IA por empresa). |
| `0009_travas_concorrencia_e_search_path.sql` | Restrição única real contra empresa duplicada, `organization_id` obrigatório em `whatsapp_processamentos`, `search_path` fixo nas funções `SECURITY DEFINER`. |
| `0010_dedupe_indexado.sql` | **Aditiva e opcional (v1092).** Cria três colunas de deduplicação (`dedupe_fone8`, `dedupe_arquivo`, `dedupe_nome`) com índice por empresa, pra a importação parar de varrer a carteira inteira só pra saber se o cliente já existe. Enquanto não for aplicada, o sistema funciona igual, só mais devagar — o app detecta a ausência sozinho. |
| `0011_cadastro_contato_corretor.sql` | **Aditiva (v1117).** Adiciona `telefone`, `cidade`, `estado`, `email_contato` em `organizations`; faz `criar_empresa_e_dono` gravar esses campos; e os expõe em `admin_visao_empresas` (pra o painel mostrar como falar com cada corretor). As telas de cadastro/login funcionam antes e depois dela — enquanto não for aplicada, o cadastro segue no ar, só não grava os campos novos. |
| `0012_contadores_atomicos.sql` | **Aditiva (v1120).** Cria as funções `reservar_analise_ia` e `reservar_contador_dia`, que fazem "checar + somar" o uso numa transação só, com trava (advisory lock) por empresa — cliques simultâneos não furam mais o teto. O app usa `reservar_analise_ia` quando ela existe e, se não existir (ou der erro), volta pro jeito antigo (lê/decide/grava) — nunca bloqueia análise real. `reservar_contador_dia` fica disponível pra uma faxina futura ligar os contadores de voz/diagnóstico/transcrição. |
| `0013_limite_cadastro_por_conexao.sql` | **Aditiva, mas com um fechamento (v1128).** Cria a tabela `cadastros_por_conexao` (o contador da trava contra cadastro falso; guarda só uma impressão embaralhada da conexão, nunca o endereço de internet) e a função `criar_empresa_e_dono_para`, que é a criação de empresa feita pelo backend. **Também tira do navegador o direito de chamar `criar_empresa_e_dono`** — é esse fechamento que faz a trava valer, já que a chave "anon" do Supabase é pública. **O `revoke` precisa incluir `public`, não só `anon`/`authenticated`**: o Postgres libera toda função nova pro grupo `public` por conta própria, e os dois papéis continuam podendo chamar por serem membros dele. A primeira versão desta migração (v1128) errava exatamente nisso e a porta seguia aberta — pego na v1129 rodando a migração num Postgres 16 de verdade, e agora protegido por `tests/v1129-migracao-0013-fecha-porta-do-navegador.test.mjs`. Enquanto não for aplicada, o cadastro continua funcionando pelo caminho antigo (`api/criar-conta.js` responde `migracaoPendente` e as telas caem nele sozinhas), só sem a trava. De quebra, restaura a checagem amigável de "uma empresa por login" que a migração `0011` tinha derrubado sem querer da `criar_empresa_e_dono` da `0009`. |
| `0014_permissoes_rpc_contadores.sql` | **URGENTE — correção de segurança (v1163).** A `0012` liberou as duas funções de contador (`reservar_analise_ia`, `reservar_contador_dia`) pro papel `authenticated`, e elas recebem a EMPRESA como parâmetro sem conferir se quem chama pertence a ela. Como a chave "anon" e o id da conta principal são públicos (`contas-config.js`), qualquer pessoa podia chamar o banco por fora do app e (a) queimar o limite de IA de qualquer conta e (b) — via a chave livre de `reservar_contador_dia` — gravar `{dia, contagem}` por cima de QUALQUER linha de `direciona_config`, inclusive o Cérebro Comercial (`direciona-cerebro`) e o plano contratado. Reproduzido num Postgres 16 de verdade (0001→0013 aplicadas): `set role authenticated; select reservar_contador_dia('00000000-…-0001','direciona-cerebro',…)` destruiu o Cérebro da conta principal — e `anon`, sem conta nenhuma, também conseguia chamar, porque `grant … to authenticated` não tira a liberação automática do grupo `public`. A `0014` revoga as duas de `public, anon, authenticated`, concede só ao `service_role` (o backend, `api/_pipeline.js`), e recria `reservar_contador_dia` aceitando **só** chave de contador (`limite-diario:*` / `limite-mensal:*`) — assim o Cérebro e o plano ficam fora do alcance dessa função mesmo se a permissão for reaberta um dia. **Também concede `excluir_organizacao(uuid)` ao `service_role`**: as migrações `0007` e `0009` revogaram de todo mundo e nunca concederam ao backend, então o botão "excluir conta" do painel administrativo responde `permission denied` (conferido no mesmo Postgres). Protegida por `tests/v1163-migracao-0014-contadores-so-do-backend.test.mjs`, que simula as permissões finais do banco (incluindo a liberação automática pro `public`) e falha se qualquer função que receba empresa por parâmetro sobrar ao alcance do navegador. |
| `0015_travas_da_0009_fora_de_ordem.sql` | **Conserto de ordem (v1165).** A conferência do banco real (07/08/2026) mostrou que a `0009` **nunca foi aplicada**, embora da `0010` à `0014` estejam. Rodar a `0009` hoje reabriria um buraco: no passo 1 dela existe `grant execute on function criar_empresa_e_dono(text) to authenticated`, que é justamente o que a `0013` revogou — aplicá-la fora de ordem desfaria a `0013` em silêncio (o arquivo `0009` ganhou um aviso no topo por isso). A `0015` faz os três pedaços que faltavam, sem tocar em permissão: trava de **uma empresa por login** no banco (`memberships_um_por_usuario`), `organization_id` **obrigatório** em `whatsapp_processamentos` (com backfill antes) e `search_path` fixo em toda função `security definer` — via `alter function`, que não reescreve o corpo e por isso não ressuscita versão antiga de função. No fim, **reafirma os revokes da `0013`/`0014`**, então rodá-la de novo conserta qualquer aplicação fora de ordem. Se algum login estiver vinculado a duas empresas, ela **para com mensagem em português** dizendo quais, em vez de erro cru de banco. Protegida por `tests/v1165-migracao-0015-nao-reabre-porta.test.mjs`. |
| `0016_devolver_reserva_analise.sql` | **Aditiva (v1174).** Cria `devolver_analise_ia(uuid, text, text)` — o outro lado da reserva feita pela `0012`. A `0012` soma 1 no contador de análises ANTES de chamar a IA (é o que impede um laço descontrolado de gastar dinheiro real), mas nada devolvia essa unidade quando a análise falhava — tempo esgotado, erro da OpenAI, resposta sem as três mensagens. Como o app repete a etapa sozinho, uma importação que falhava queimava 4 a 6 unidades do teto do dia sem entregar nada: foi assim que a conta original travou em "limite atingido" num dia em que a OpenAI acusava 114 chamadas no mês inteiro. A função subtrai 1 dos mesmos contadores (dia e mês), com a MESMA trava por empresa, nunca abaixo de zero e só no período corrente. Enquanto não for aplicada, `devolverReservaAnalise` (em `api/_pipeline.js`) faz a devolução pelo caminho antigo (ler, subtrair, gravar) — nada quebra, só perde a atomicidade. Rode DEPOIS da `0012`. |

| `0017_registro_de_migracoes.sql` | **Aditiva (v1185).** Cria `cp_migracoes_aplicadas` e a função `conferir_migracoes()`, que **olha o catálogo do Postgres** (tabela, função, índice, trava e permissão) e diz o que cada migração deixou de fato — não confia em anotação. É a resposta das quatro auditorias de 08/2026 ao maior risco restante: código e banco em versões diferentes sem ninguém saber (a `0009` faltando enquanto da `0010` à `0014` estavam). Detalhes importantes: a `0009` e a `0015` são conferidas **pelo mesmo efeito** (a `0015` refaz o que faltou da `0009`); a `0013` só conta como aplicada se o navegador **não** conseguir chamar `criar_empresa_e_dono*` (função existir não basta — a trava é o revoke); a `0014` só conta se os dois contadores estiverem fora do alcance de `anon`/`authenticated`. Por isso a conferência também serve de **alarme**: reabrir uma dessas portas faz a migração virar "faltando" na hora. Tabela e funções fechadas pro navegador (RLS ligada, `revoke` incluindo `public`, `grant` só ao `service_role`). Validada num Postgres 16 de verdade em três cenários (banco de 07/08 sem a `0009`; banco completo; portas reabertas). Lida por `conferirMigracoesDoBanco` (`api/_persistence.js`) e exposta em `api/diagnostico.js?mode=banco`. Protegida por `tests/v1185-banco-se-reporta-e-nada-cai-no-caminho-antigo.test.mjs`, que exige que **toda** migração do disco esteja na conferência. |

| `0018_cadastro_atomico_e_limpeza.sql` | **Correção de concorrência + retenção (v1186).** Duas coisas. (a) `criar_empresa_com_limite_de_conexao(...)` faz **contar, decidir, criar e registrar na MESMA transação**, com `pg_advisory_xact_lock` derivado da impressão da conexão (trava só quem vem da mesma conexão; corretores diferentes não esperam um pelo outro). Antes eram quatro passos separados em `api/criar-conta.js`, e entre o "conta" e o "registra" havia uma janela: pedidos simultâneos liam o mesmo número e todos passavam. **Medido num Postgres 16 de verdade, limite 5, oito pedidos ao mesmo tempo: o caminho antigo criou 8 contas; a função nova criou 5 e recusou 3.** O estouro do limite para com o código `CP429`, que a rota reconhece e traduz. (b) `limpar_cadastros_por_conexao_antigos(dias)` + índice `cadastros_por_conexao_idade` — a impressão da conexão só serve pras últimas 24h e nunca era apagada; agora sai depois de 7 dias, disparado por `api/criar-conta.js` no máximo uma vez por dia por instância, sem segurar a resposta de quem se cadastra. Também **reescreve `conferir_migracoes()`** pra se incluir na lista (a `0017` pode já estar aplicada). **v1190 — deixou de ser opcional:** em produção, sem ela, o cadastro de conta nova **recusa** (HTTP 503, com a mensagem dizendo o que fazer) em vez de cair calado no caminho antigo; `MIGRACAO_MINIMA_EXIGIDA` subiu pra 18, então ela aparece como pendência de verdade no diagnóstico. A válvula de escape é `CORRETOR_PRO_CADASTRO_SEM_0018=sim` (seção 3). Fora de produção o caminho antigo continua valendo, com aviso no log. Protegida por `tests/v1186-migracao-0018-cadastro-atomico.test.mjs`. |

| `0019_conferencia_inclui_baseline.sql` | **Aditiva e pequena (v1285).** Reescreve `conferir_migracoes()` (nascida na `0017`, reescrita pela `0018`) pra reportar também a `0000`. A regra desde a v1185 é que nenhuma migração fique invisível no diagnóstico, e o baseline seria a única peça sem conferência — o teste `v1185` pegou isso. A linha 0 confere se as duas tabelas base existem mesmo: em produção aparece como "aplicada" na hora, sem nada a fazer; num ambiente novo é a primeira coisa a acender. Validada nos dois cenários num Postgres 16 (com baseline: "aplicada"; sem: "faltando"). |

**Como saber o que está aplicado em produção (v1185)**: pergunte ao banco, não a um documento —
`/api/diagnostico?mode=banco` (logado como administrador da plataforma) devolve a lista do que está
aplicado, do que falta e qual arquivo rodar. **Nenhum documento deste repositório sabe o estado
real**; a única exceção é a própria `0017`, que precisa ser aplicada às cegas uma vez para o resto
passar a se reportar. Esta sessão continua sem acesso ao Supabase de produção (ver `CLAUDE.md`).
Se uma rota falhar citando tabela/coluna/função que "não existe", o mais provável é migração não
aplicada — e agora dá para confirmar em vez de supor.

**Regra que passou a valer na v1185**: peça de segurança faltando no banco gera **diagnóstico**,
nunca downgrade silencioso. Antes, três lugares faziam o contrário — salvar o Cérebro caía na
regra global de antes das contas separadas; o cadastro criava a empresa pelo navegador quando a
`0013` não era encontrada; e a rota do Cérebro sugeria recriar `direciona_config` no esquema
pré-multiempresa. Os três foram retirados e trocados por aviso claro. Quem for mexer nisso: **não
reintroduza reserva que contorne migração faltando** — o teste da v1185 falha de propósito.

## 4-A. Bateria de conversas comerciais (`evals/`) — v1283

A suíte de `tests/` protege o **código**; ela não sabe dizer se a **análise** está boa. A auditoria
de 16/08/2026 mediu por quê: dos 437 arquivos de teste da época, **356 apenas liam o código-fonte**
procurando se um trecho estava lá. Foi por isso que o erro do contato salvo como "Anderson
Corretor" (v1282) passou por todos eles.

`evals/` são **9 conversas** escritas a partir de situações reais já registradas nas notas de
versão, com a régua do que se espera escrita em português (`aIaPrecisaPerceber`,
`asMensagensNaoPodem`, `asMensagensPrecisam`). Nenhuma tem dado de cliente real.

- **Camada 1** — `tests/v1283-bateria-conversas-comerciais.test.mjs`, dentro do `npm test`, custo
  zero: confere o que o sistema decide **antes** da IA (nome do cliente, quem falou por último,
  contagem **e textos** das tentativas sem resposta, exemplos de voz do corretor). Falha se uma
  fala do cliente entrar em qualquer um dos dois blocos que vão ao prompt.
- **Camada 2** — `evals/executar.mjs`, **não roda na suíte nem na publicação**: exige
  `OPENAI_API_KEY` e comando explícito (~R$ 3 a 5 por rodada). Manda as conversas para a análise
  real e usa uma segunda leitura da IA como juiz da régua, exigindo justificativa por item.

**O uso que importa é o antes/depois** (`--salvar=antes` … `--comparar=antes`): é a regra do
`CLAUDE.md` ("alteração de prompt entra com antes e depois na mesma conversa real") virada em
ferramenta. **v1308 — a camada 2 está sendo executada pela primeira vez** (antes e depois da
mudança), assim que a chave da OpenAI do dono for liberada nesta sessão. Junto, uma expectativa da
camada 1 mudou de propósito: em
`evals/conversas/08-corretor-falou-por-ultimo.json`, `tentativasSemResposta` passou de 1 para 0 (a
despedida do corretor deixou de contar como cobrança ignorada — ver v1308).

## 5. Processo de publicação

1. Trabalho feito numa branch, PR aberto pro `main`.
2. `.github/workflows/ci.yml` roda `npm test` automaticamente no PR e no push pro `main` (desde a
   v1043) — não bloqueia o merge sozinho (não é branch protection), é só um aviso visível.
3. Mesclar no `main` → a Vercel publica sozinha (webhook do GitHub já configurado).
   - Desde a v1073, `build.js` publica os `.js`/`.css` **sem comentários e espaços** (esbuild,
     só `minifyWhitespace` — nunca renomeia identificador, senão os `onclick="funcao()"` do HTML
     quebrariam; se o esbuild faltar/falhar, publica o arquivo como está). O `app.js` publicado
     caiu de ~800KB pra ~510KB com isso + a faxina de código morto da mesma versão.
4. Migrações do Supabase **não** são aplicadas automaticamente — são sempre um passo manual à
   parte (colar o SQL no SQL Editor).

### Rollback
Não há script de rollback automatizado. Duas formas manuais:
- **Código**: painel da Vercel → Deployments → escolher uma publicação anterior "Ready" → menu
  "..." → "Promote to Production". Mais rápido, não mexe no Git.
- **Git**: `git revert` do(s) commit(s) problemático(s) no `main` e deixar a Vercel publicar de
  novo — mais correto a longo prazo (mantém o histórico limpo), mas mais lento.
- Migrações de banco **não têm rollback automático** — cada migração nova deveria, idealmente, ser
  escrita de um jeito que só adiciona (nunca remove/altera destrutivamente) — é o padrão que todas
  as migrações até aqui já seguem.

## 5-A. Jornada do cliente novo (o caminho que decide a venda)

Reescrita entre a v1128 e a v1135, depois de o dono testar o produto como cliente e travar em cada
passo. Está aqui porque é o caminho mais importante do sistema e o mais fácil de quebrar sem querer.

1. **Recebe o link** → `entrar.html` mostra o **convite** (o que o produto faz + "Criar minha conta
   grátis"), nunca um formulário de senha. Quem já entrou naquele aparelho cai direto no login. O
   que decide é `localStorage['cp-ja-entrou']`, marcado só por login/cadastro concluído (v1134).
   **v1165** — no login e no cadastro, `js/dados-locais.js` carimba de quem é o dado guardado neste
   aparelho (`cp-dono-dos-dados-locais`) e, se o dono MUDOU, apaga o que era da conta anterior
   **antes** de o app abrir: Cérebro em cópia local, importação pendente, ZIP compartilhado
   (IndexedDB `direciona-share`), retrato do lembrete diário com nomes de clientes (IndexedDB
   `corretor-pro-notif`) e os caches `direciona-sharetarget-*`. Sair da conta apaga o dado
   comercial e o carimbo. Preferência neutra do aparelho nunca é apagada, e os contadores de
   uso do próprio corretor (`cpAtividade_*`, `cpTempoAppPorDia`) só somem quando o dono muda —
   sair e voltar na mesma conta não pode tomar dele o histórico da tela Desempenho.
2. **Cria a conta** → entra na hora, sem confirmar e-mail (decisão do dono, v1128). A proteção
   contra cadastro falso em massa é por conexão de internet, no servidor (`api/criar-conta.js` +
   migração `0013`).
3. **Importa a primeira conversa** → a Home vazia abre com o caminho dentro do WhatsApp, passo a
   passo, e o botão de escolher arquivo é secundário (v1130). O app **não** busca conversa nenhuma:
   quem exporta e envia é o corretor, e o WhatsApp não guarda exportação.
4. **Recebe a análise** → mesmo **sem Cérebro configurado**. É o `modoPrevia` (v1132): a análise
   sai apoiada só na conversa enviada, com as três mensagens, e o prompt proíbe afirmar preço,
   condição, empreendimento ou localização que não esteja escrita ali. Depois da análise aparece o
   convite "Ensinar a IA a falar como eu", que leva ao Cérebro.
   **Não reintroduza a recusa por falta de Cérebro** — ver `NOTAS-v1132.md` e o teste
   `v1132-conta-nova-ve-o-produto-funcionando`.
5. **Configura o Cérebro** quando quiser, já tendo visto o valor.

## 5-B. Cache de tela e memória (a armadilha que já gerou 3 bugs)

As telas desenham a partir de listas em memória (`state.todosLeads`, `state.itemsAtivos`) para não
mostrarem "Carregando..." a cada navegação. Isso é bom para a percepção de velocidade e é a origem
de uma classe inteira de bug: **gravar no servidor sem atualizar a memória deixa a tela mostrando o
dado velho**, sem erro nenhum. Já aconteceu três vezes (v1125 arquivar, v1133 excluir lembrete, e
remarcar lembrete, que ninguém chegou a relatar).

Como está hoje:

- `state.dataRevision` sobe a cada `invalidarLeadsCache()` (isto é, depois de toda gravação) e a
  cada busca nova de leads.
- `state.carteiraRevisao` (v1135) guarda **em que revisão a carteira em memória foi preenchida a
  partir do servidor**. Só é carimbada onde os dados vieram mesmo de `getLeadsData` — nunca onde a
  lista recebe uma cópia da própria memória.
- `carregarAgenda()` pinta da memória (rápido) e, se `carteiraRevisao !== dataRevision`, revalida no
  servidor e repinta. Esquecer de sincronizar a memória numa ação nova deixa a tela um pouco mais
  lenta em vez de mostrar dado errado.

Ao criar uma ação que grava no servidor, prefira sempre atualizar a memória (`cpMarcarEtapaLocal`,
`cpAtualizarLembreteLocal`, `removerLeadDosCaches` são os exemplos existentes). A revalidação é rede
de segurança, não substituta.

## 6. Ambiente de homologação (staging)

**Ainda não existe.** Hoje só há um projeto Supabase (produção) e uma publicação Vercel de
produção — toda alteração de banco é testada só com dados fake em memória (os testes automatizados
usam um servidor HTTP de mentira, nunca o Supabase real) ou direto em produção. Esta sessão não
tem credenciais pra criar um projeto Supabase novo nem pra configurar variáveis de ambiente por
ambiente na Vercel — são passos que só o dono consegue fazer. Passo a passo pra quando quiser
montar isso:

1. Criar um **segundo projeto no Supabase** (grátis), só pra teste.
2. Rodar todas as migrações de `supabase/migrations/` nesse projeto novo, na ordem.
3. Na Vercel → Settings → Environment Variables: cadastrar `SUPABASE_URL`,
   `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_ANON_KEY` (e demais) com os valores do projeto de
   **teste**, mas marcadas pra valer só no ambiente **Preview** (não em Production) — a Vercel já
   separa isso nativamente, é só escolher a caixinha certa ao cadastrar cada variável.
4. A partir daí, toda Pull Request já publica automaticamente numa URL de "Preview" (a Vercel já
   faz isso hoje) — e, seguindo o passo 3, essa URL passa a usar o banco de teste, nunca o de
   produção.

## 7. Segurança — resumo do que já foi corrigido

- Nenhuma rota usa mais a chave compartilhada (`CORRETOR_PRO_API_KEY`) como única prova de
  identidade — todas identificam a empresa de verdade (`NOTAS-v1037.md`, `NOTAS-v1042.md`).
- Restrição única real (não só no código) contra duas empresas pelo mesmo login
  (`NOTAS-v1040.md`).
- `organization_id` obrigatório (não mais opcional) na tabela principal de leads
  (`NOTAS-v1040.md`).
- Funções do banco com privilégio elevado (`SECURITY DEFINER`) com `search_path` fixo
  (`NOTAS-v1040.md`).
- Teto de uso de IA bem menor durante o teste grátis (`NOTAS-v1041.md`).
- Telemetria de custo de IA por empresa, visível no painel administrativo (`NOTAS-v1038.md`).
- **(v1288)** O custo em reais desse painel estava **inflado** (até ~30x no aprendizado automático):
  a OpenAI devolve o modelo com a data da versão (`gpt-4o-mini-2024-07-18`) e a tabela de preços de
  `api/_iaCusto.js` só tinha o nome curto, então quase toda chamada caía no preço de reserva
  exagerado. Agora o nome com data acha o preço certo, a tela mostra **qual cotação do dólar** foi
  usada, e modelo que continuar sem preço mapeado aparece **nomeado numa tarja de aviso** ("custo
  estimado por cima") em vez de sumir dentro do total (`NOTAS-v1288.md`).
- **(v1190)** Acesso antigo por chave compartilhada **desligado por padrão em produção** — a
  segurança deixou de depender de alguém lembrar de marcar uma variável (`NOTAS-v1190.md`).
- **(v1190)** Cadastro **falha fechado** sem a migração `0018`: código novo sobre banco velho não
  parece mais saudável (`NOTAS-v1190.md`).
- **(v1190)** Aprendizado automático da IA (`corretor-conhecimento`) endurecido: aprende **só das
  mensagens do corretor**, trata a conversa como **dado não confiável** (instrução embutida pelo
  cliente não altera nada), **barra condição comercial volátil** (preço, desconto, prazo, FGTS,
  financiamento) e **valida o JSON** antes de gravar — saída inválida não grava nada, e o
  conhecimento existente nunca é sobrescrito (`NOTAS-v1190.md`).
- **(v1190)** Notificação do lembrete diário **não leva mais nome de cliente** pra tela bloqueada
  do celular (`NOTAS-v1190.md`).
- **(v1322)** Leitura de link **blindada contra uso do servidor como ponte pra rede interna**
  (SSRF): o nome é resolvido antes de abrir e endereço privado/reservado é recusado, o
  redirecionamento é seguido em modo `manual` com cada parada conferida de novo (máx. 3), o corte
  de 700 KB acontece **durante** o download e o relógio vale até o último byte. Porta fora da 443 e
  credencial embutida no endereço também deixaram de ser aceitas
  (`baixarPaginaComSeguranca` em `api/_pipeline.js`, `NOTAS-v1322.md`).
- **(v1323)** Prova nova na tela do lead e na importação: **quantas fotos, PDFs e áudios desta
  conversa a IA NÃO leu** (`contarMaterialNaoLido` em `api/_pipeline.js`, `materialNaoLido` salvo
  com a análise, `cp1323MaterialNaoLido` em `app.js`, `materialNaoLidoHtml` em `js/importacao.js`).
  Antes disso a análise parecia completa mesmo quando a arte com o preço nunca tinha sido vista
  (`NOTAS-v1323.md`).
- **(v1322)** `privacidade.html` e `termos.html` voltaram a descrever o produto real: leitura de
  imagem (JPG/PNG/WEBP) e PDF (v1306), leitura do texto da página dos links enviados pelo corretor
  (v1307), e o prazo verdadeiro de apagamento automático da impressão embaralhada da conexão
  (7 dias, migração `0018`). O texto anterior era da v1164 e prometia o contrário
  (`NOTAS-v1322.md`).

## 8. Pendências conhecidas

- ~~[MAIOR PENDÊNCIA TÉCNICA] A listagem lê a conversa inteira de todos os leads a cada carga~~ —
  **resolvida na v1136** (era o achado nº 1 da auditoria de 05/08/2026 e a causa quase certa da
  cota de egress estourada desde a v1122). A listagem normal **não pede mais `timeline_json`**: o
  `_statsCache` virou v3 (marca d'água = `atualizado_em` da linha, prévia de 8 mensagens e último
  toque gravados juntos) e responde tudo; só linhas com cache frio/vencido têm a conversa buscada,
  numa segunda consulta, em lotes de 50. No regime normal a carga é **uma** consulta sem conversa
  nenhuma; na virada do dia (os números de 90 dias envelhecem) todo mundo recalcula **uma** vez e
  volta ao regime barato. O detalhe do lead (`includeFullTimeline`) segue trazendo o histórico
  completo. Guardas: `tests/v1136-listagem-nao-traz-conversa-inteira.test.mjs` (usa um banco de
  mentira que **respeita** o select — os fakes antigos devolviam a linha inteira fosse qual fosse a
  coluna pedida, e por isso nunca enxergariam esta regressão). Ver `NOTAS-v1136.md`.

- ~~Confirmação de e-mail no cadastro~~ — **descartada por decisão do dono na v1128**, e não é mais
  pendência: quem se cadastra precisa entrar no app na hora e usar os 7 dias de teste; a venda é
  fechada depois, por telefone, no WhatsApp que o próprio cadastro pede. O código continua
  aguentando as duas situações (`cadastro.html` trata tanto a sessão que já vem pronta quanto a
  ausência dela), então ligar a opção no Supabase no futuro não quebraria nada — mas a intenção
  registrada é deixar desligada. **Não reabra isto como "pendência" numa auditoria futura.**
- ~~Captcha no cadastro~~ — **resolvido de outro jeito na v1128**, sem provedor externo. Como a
  confirmação de e-mail (que na prática segurava robô criando conta com e-mail inventado) saiu, a
  proteção passou a ser server-side: `api/criar-conta.js` conta quantas contas novas saíram da
  mesma conexão de internet em 24h e recusa acima do limite (`CORRETOR_PRO_LIMITE_CADASTROS_
  CONEXAO_DIA`, padrão 5). Não pede nada de quem se cadastra. **Só vale de verdade com a migração
  `0013` aplicada** — sem ela, o navegador ainda consegue criar empresa por fora.
- **`app.js` é quase um arquivo só, com ~13,2 mil linhas** — funciona, mas dificulta manutenção.
  A v1195 tirou dele o primeiro pedaço de verdade: as 29 funções do **processamento da conversa
  importada** foram pra `js/importacao.js`, buscado com `import()` dinâmico só quando o corretor
  importa (a ponte é a função `processFile`, a única porta de entrada; ver `NOTAS-v1195.md` e a
  guarda `tests/v1195-pedaco-importacao-fechado.test.mjs`). A v1217 tirou de lá a **regra de
  repetição do envio do ZIP** (`js/envio-retentativa.js`): sem tela e sem rede, é o único jeito de
  o teste executá-la de verdade em vez de conferir o código por leitura. A v1270 tirou pelo mesmo
  motivo a **escolha do que entra no envio** (`js/enxugar-zip.js`): o aparelho manda o texto inteiro
  e só o áudio que o servidor vai transcrever de fato (o de fora do período era enviado e
  descartado do outro lado, e sozinho estourava o limite de 150 MB numa conversa de anos). A parte do **compartilhamento** (o ZIP
  que chega do WhatsApp) continua no `app.js` de propósito: ela roda em toda abertura, então
  movê-la anularia a economia. O grafo de chamadas mostrou que as demais telas (Agenda, Cérebro,
  Carteira, cliente) **não** rendem divisão — compartilham quase todo o código de desenho.
  Detalhe importante pra quem for mexer: `app.js` é um **módulo ES**
  (`<script type="module">` no `index.html`), então uma `function` declarada no topo do arquivo
  **não** fica acessível pros `onclick="funcao()"` do HTML — só as linhas `window.funcao = funcao`
  fazem essa ponte. É por isso que uma "função duplicada" quase sempre é, na verdade, uma ponte
  `window.x = ...` reatribuída.
  - As duplicatas que esta seção apontava desde a v1068 (`abrirVenda`/`marcarPerdido` 3 vezes,
    `abrirEditarLead`/`salvarEditarLead` 2 vezes) **não existem mais**: saíram na faxina da v1069.
  - A v1082 varreu o arquivo inteiro com um analisador de sintaxe (acorn) e confirmou **zero**
    declarações duplicadas no topo. As últimas sobras de verdade foram removidas na mesma versão:
    a geração antiga de `arquivarLead` (com `confirm()` do navegador, substituída na v1073) e uma
    linha repetida de `window.reanalisarTudo`.
  - **Não** mexa nas reatribuições de `window.show`, `window.cpPerformanceResumo` e
    `window.__cpShareImportActive`: as duas primeiras são correntes propositais (cada camada
    guarda a anterior e chama ela), a terceira é estado de execução, não definição. Remover
    qualquer elo dessas correntes derruba silenciosamente o comportamento da camada de fora.
- ~~`limpar-tudo.js` sem checagem de "dono" da empresa~~ — **resolvido na v1083 pela remoção da
  rota inteira** (decisão do dono: o botão "Apagar tudo" nunca seria usado). A única forma de
  apagar os dados de uma conta hoje é o painel administrativo (`admin-contas.js`, ação
  `excluir-conta`), que já exige ser administrador da plataforma.
- **Política de privacidade e termos de uso** — publicadas desde a v1045 (`privacidade.html`,
  `termos.html`). Os dados de identificação do responsável e o e-mail de contato **já foram
  preenchidos na v1084**; os links passaram a existir também dentro do app, no rodapé da tela Menu
  (antes só havia link na tela de criar conta, então quem já era cliente não achava as páginas).
  **Pendência restante: uma revisão jurídica de verdade** antes de tratar o texto como definitivo —
  o aviso disso continua visível no topo das duas páginas.
- **Cobrança/assinatura automatizada** — não há integração com meio de pagamento, e **isso é
  intencional desde a v1128**: o dono acompanha os dias restantes pela coluna "Dias de teste" do
  painel, liga pro WhatsApp cadastrado antes de o teste vencer, fecha o pacote por telefone e
  marca o plano no painel (que já ativa a conta). Continua listado aqui como característica
  conhecida, não como tarefa em aberto.
- **App nativo pro iPhone** (aparecer direto no botão Compartilhar do WhatsApp, como no Android) —
  projeto à parte, não iniciado; o Atalho do iPhone (Shortcuts) já cobre a mesma necessidade de um
  jeito mais manual (ver `NOTAS-v1035.md`).

## 9. Onde encontrar mais detalhes

Cada mudança relevante tem sua própria nota de versão em `NOTAS-vNNN.md` — comece pelas mais
recentes se quiser entender uma decisão específica. As notas antigas `NOTAS-v827-*.md` seguem um
padrão de nome diferente (histórico anterior à convenção atual) mas continuam válidas como
registro do que já foi decidido.
