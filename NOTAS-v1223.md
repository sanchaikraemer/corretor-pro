# v1223 — a tela cheia parou de cobrir a pergunta; a caixa não sobra mais; e "é o mesmo" renomeia

Três relatos do dono em dois minutos (11/08/2026, 19h32 e 19h33). Os dois primeiros são defeito
que eu mesmo introduzi nas versões desta noite.

---

## 1. "travou aqui" — tela cheia em 98% cobrindo a pergunta

**Print:** tela cheia da importação parada em *"Salvando na carteira · 98% · responda a pergunta
acima pra continuar"*.

Não estava salvando nada. A pergunta *"é o mesmo cliente?"* estava pronta **atrás** da tela cheia,
no topo da tela (v1220). Sem ver a pergunta — e sem conseguir rolar até ela, porque a tela cheia
segura a rolagem da página — não havia como destravar. Ficava assim pra sempre.

**Causa (descuido meu na v1219):** a importação fechava a tela cheia e, na linha seguinte, chamava
a linha de andamento no modo "esperando você"… que caía no ramo *"etapa 0 a 5 = trabalho em
andamento"* e **reabria a tela cheia na hora**. O estado "esperando você" tinha sido ensinado à
linha de andamento, mas não à tela cheia.

**Correção:** "esperando você" passa a fazer o que "pausar" já fazia desde a v1089 — tirar a tela
cheia da frente. Uma linha, com teste que **executa** a função e prova que a tela sai.

## 2. "tá aparecendo uma tela nada a ver antes de começar a importação (e antes não tinha)"

Era a caixa de decisão do topo (criada na v1220) **sobrando**: ela nascia quando a importação
precisava de resposta, mas ninguém a fechava depois que o assunto acabava. O corretor voltava pra
tela de importação e encontrava a pergunta do cliente **anterior**, já respondida, de pé — antes
mesmo de escolher o arquivo novo.

Agora ela fecha nos três fins possíveis: quando o cliente abre (resposta dada), quando a importação
é descartada, e quando uma importação nova começa.

## 3. "quando clicar q é o mesmo e atualizar, já altere o nome no sistema"

Ele está certo, e isso explica a pergunta voltar **toda vez** no mesmo cliente: o cadastro guardava
o nome curto ("Alisson Franca") e o arquivo exportado trazia o longo ("Alisson Franca NVRIII") —
seguiam "parecidos mas não idênticos" pra sempre. Pior: a própria caixa **prometia** que o cadastro
passaria a se chamar como a importação, e não passava.

O motivo do "não passava" é uma regra certa no caso geral: reimportar **não** pode trocar o nome que
o corretor já curou na carteira pelo nome bagunçado do contato do WhatsApp.

**O que muda:** quando ele toca em **"Sim, é o mesmo — atualizar"**, o app avisa o servidor de que a
decisão foi dele — e só nesse caso o nome da importação vence e o cadastro é renomeado, nos **dois**
lugares onde o nome vive (a ficha do cliente e a coluna usada pela busca). Reimportação de nome
idêntico não pede nada, e a proteção do nome curado continua valendo pra ela. Nome ruim (vazio,
"cliente importado", só números) nunca vira nome de cadastro.

Na prática: a partir da próxima importação desse cliente, **a pergunta não aparece mais** — os nomes
passam a ser idênticos.

---

## Conferência frame a frame (pedida pelo dono, feita no app publicado)

| Momento | Tela cheia | Caixa da pergunta |
|---|---|---|
| Tela de importação recém-aberta | escondida | escondida |
| Importando | **cobre a tela** (como sempre) | escondida |
| Esperando a resposta | **sai da frente** | **visível, no topo (317px)** |
| Voltou pra importação depois de responder | escondida | **escondida** |

## Arquivos alterados

- `app.js` — `aguardando` também fecha a tela cheia (a linha que faltava).
- `js/importacao.js` — `cpFecharPerguntaTopo()` e os três pontos que a chamam; envio do
  `renomearPara` só quando a atualização veio da resposta dele.
- `api/lead-update.js` — renomeia o cadastro (ficha + coluna de busca) quando o pedido é explícito;
  banco antigo sem a coluna refaz a gravação sem ela em vez de falhar.
- `tests/v1223-tela-cheia-nao-cobre-a-pergunta.test.mjs` — executa a função da tela cheia contra
  dublês e prova que ela sai na espera (o defeito não aparecia em nenhuma leitura do código).
- `tests/v1223-sobra-da-pergunta-e-renomear-ao-confirmar.test.mjs` — guarda dos itens 2 e 3.
- `tests/v1088-...` — a guarda antiga da tela cheia passa a exigir os dois nomes da espera.
- `package.json` / `package-lock.json` — versão 1223.
