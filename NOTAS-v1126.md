# v1126 — o app tinha UMA porta só de entrada, e o iPhone não tem essa porta

## O que o dono relatou

Tentando usar o app no iPhone, com prints de cada passo:

> "quando eu vou enviar a conversa, o ZIP, não consegue achar o app no iPhone pra enviar."

E depois, cobrando (com razão) uma resposta pesquisada em vez de chutada:

> "já disse que não tem como salvar o zip da conversa pelo computador... somente enviando direto
> do WhatsApp, mas como não vai abrir o app no iPhone, não tem como concluir o processo."

## O que estava errado

Até esta versão existia **um caminho só** pro ZIP entrar no Corretor Pro: o "compartilhar com o
Corretor Pro" a partir do WhatsApp. Esse caminho **não existe no iPhone** — e isso não é escolha
nossa nem defeito do app: o Safari não implementa a função que faz um site instalado aparecer na
lista de compartilhar do sistema. O pedido está aberto no projeto do Safari desde 2019, sem
previsão.

O problema nosso veio a seguir: a tela **"Importar conversa" não tinha nenhum lugar pra escolher
um arquivo**. Só "Nova análise" e "Diagnóstico". E as instruções na tela mandavam justamente
"compartilhe o ZIP com o Corretor Pro" — uma ordem impossível de cumprir no iPhone.

Resultado: no iPhone o app dependia 100% de um caminho que o aparelho não tem, e não oferecia
nenhum outro. Beco sem saída. No Android ninguém tinha esbarrado nisso porque lá o compartilhar
funciona normalmente.

## O que mudou

**1. Botão "📂 Escolher o arquivo da conversa (.zip)" na tela de importar.**
Funciona nos dois sistemas. O arquivo escolhido entra pelo **mesmo caminho** do compartilhamento —
extração, transcrição dos áudios, análise: tudo igual, nada de fluxo paralelo.

**2. As instruções agora mudam conforme o aparelho.**

- **iPhone:** "Na tela de compartilhar que abrir, role para baixo (passando dos ícones dos apps) e
  toque em *Salvar em Arquivos*. Volte aqui e toque em *Escolher o arquivo da conversa*." E aponta
  o **Atalho** (Mais → "Compartilhar direto do WhatsApp (iPhone)") pra quem quiser pular esses
  passos — é o único jeito de o Corretor Pro aparecer na lista de compartilhar do iPhone.
- **Android:** continua "compartilhe o ZIP com o Corretor Pro", que é o caminho principal lá — com
  o botão novo como alternativa.

Isso vale tanto na tela "Importar conversa" quanto no "Como funciona" da tela inicial de quem
ainda não importou nada.

## O que NÃO mudou

- O compartilhamento do Android: intacto, continua sendo o caminho principal.
- O processamento do ZIP: mesma função, mesmas etapas, mesmo custo.
- O Atalho do iPhone: já existia, não foi mexido — só passou a ser indicado no lugar certo.

## Conferido no navegador

App publicado, aberto com identidade de iPhone e de Android:

- Botão visível e do tamanho certo nos dois (336px de largura).
- Tocar no botão abre o seletor de arquivo do sistema: **sim**, nos dois.
- Escolher um `.zip` cai no fluxo real: aparece "Arquivo selecionado: conversa-teste.zip", a barra
  de progresso liga e o app pede o **Período dos áudios** — exatamente como no compartilhamento.
- Texto de ajuda diferente em cada aparelho, conforme o esperado.

## Também nesta versão

O teste `v1098` quebrava sozinho dependendo do dia do ano: ele conferia que o número "12" (de uma
contagem de mensagens) não aparecia na coluna, mas a **data** mostrada ali podia cair num dia 12
(rodando em 04/08, 53 dias antes dá "12/06"). Agora a checagem ignora a data.

## Teste de regressão

`tests/v1126-escolher-arquivo-zip-no-iphone.test.mjs` — garante que o seletor de arquivo existe na
tela, que o botão o abre, que o arquivo escolhido entra pelo mesmo processamento do
compartilhamento, que dá pra escolher o mesmo arquivo de novo depois de um erro, e que a instrução
"compartilhe o ZIP com o Corretor Pro" **nunca** aparece pra quem está no iPhone.
