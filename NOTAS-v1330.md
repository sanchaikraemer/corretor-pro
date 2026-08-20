# v1330 — a régua da análise vira um botão no painel

O dono, hoje: *"Mas se não me engano inclusive já tem esse botão... tu tem que conhecer o produto
que tu está falando"* — e estava certo. O app já tinha o **Testar a IA agora** (Menu → Mais), que
usa a chave da OpenAI que está na hospedagem, e o painel já tinha os cartões **Saúde do banco** e
**Saúde da configuração**, cada um com o seu "Conferir agora". O caminho existia; eu tinha proposto
inventar outro, e ainda pedi a chave da OpenAI — que eu mesmo já tinha dito que não era pra passar.

## O buraco de verdade

A **bateria de conversas** existe desde a v1283 e virou porteiro na v1327: mudou o miolo da
análise, a suíte fica vermelha até a bateria ser medida. Só que ela **só rodava por linha de
comando**, com a chave da OpenAI na mão de quem tem terminal. Ou seja: quem decide se a análise
melhorou ou piorou — o dono — não tinha como medir.

Portão que o dono não abre não é portão, é parede. Foi essa parede que travou a mudança da análise
em duas etapas (que fica pronta e guardada, esperando a medição).

## O que mudou

No **painel administrativo**, ao lado de "Saúde do banco" e "Saúde da configuração", entrou o
cartão **Qualidade da análise**, com o botão **Medir agora**:

- roda as **32 conversas de teste** (fictícias, guardadas no projeto) na IA de verdade;
- cada conversa carrega a **régua escrita em português**: o que a análise precisava perceber, o que
  as três mensagens não podiam fazer e o que precisavam fazer;
- um segundo modelo confere item por item e **precisa justificar citando o trecho** — ele nunca
  recebe a resposta certa pronta;
- a tela mostra o placar andando (`12 de 32 conversas — 47 de 60 pontos da régua cumpridos`) e, no
  fim, cada conversa com as falhas em uma linha.

Antes de começar, o botão **avisa que gasta IA de verdade** (em torno de R$ 3 a R$ 5 a rodada) e
pede confirmação. Nada roda sozinho ao abrir o painel: quem manda medir é o dono, clicando.

## Detalhes que importam

- **É exclusivo do administrador da plataforma.** Corretor comum não vê e não roda.
- **Roda em pedaços** (2 conversas por chamada). Uma análise de verdade leva perto de um minuto, e
  a função do servidor tem teto de tempo; em pedaços, a tela também mostra o resultado andando em
  vez de ficar parada. O tempo da rota de diagnóstico subiu de 60s para 300s, igual às rotas de
  análise.
- **Um motor só.** A linha de comando (`node evals/executar.mjs`) e o botão usam o mesmo código
  (`evals/motor.mjs`) — não existem duas baterias que podem discordar uma da outra.
- As conversas viram um módulo importado (`evals/casos-empacotados.mjs`), porque numa função da
  Vercel só vai pro ar o que o código importa. A fonte continua sendo `evals/conversas/*.json`;
  depois de mexer nelas, rode `node evals/empacotar-casos.mjs`. O teste falha de propósito se o
  empacotado ficar velho.
- O motor mora em `evals/` e não em `api/` por causa de uma regra da casa: nenhum arquivo de `api/`
  define `temperature` nas chamadas à OpenAI. O juiz é o caso oposto — precisa de temperatura zero
  pra medir sempre igual.
- O consumo das medições entra no painel de custo por conta, nas rotas `bateria-juiz` e `analise`.

## Guarda

`tests/v1330-bateria-no-painel.test.mjs`: as conversas chegam por importação (nunca por leitura de
arquivo no servidor), o empacotado não pode ficar velho, o juiz continua julgando pela régua, a
rota é do administrador e roda em pedaços, o botão avisa o custo e não mede sozinho, e a linha de
comando usa o mesmo motor.

Conferido no Chromium (390px e 1280px): o cartão aparece no painel, sem estourar a largura, no tema
escuro, e a página não tem erro de script.

Suíte: 34 arquivos checados + 476 testes, todos verdes.

## O que fica esperando

A **v1330 da análise em duas etapas** (ler primeiro, escrever depois) está pronta e commitada, mas
não foi publicada: é mudança no miolo, e o porteiro exige medição antes. Agora existe como medir.
