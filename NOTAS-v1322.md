# v1322 — o link que o app abre não pode virar porta dos fundos, e a política volta a dizer a verdade

Auditoria externa do sistema inteiro, trazida pelo dono em 20/08/2026. Ela apontou nove frentes;
esta versão resolve **as duas de risco real e imediato**. As outras (dividir os arquivos gigantes,
travar a publicação quando o teste falha, ambiente de homologação, anonimizar o aprendizado que
passa de um cliente pra outro) ficaram de fora de propósito: são decisões de rumo, não correções, e
estão listadas no fim desta nota pra serem decididas com o dono.

## 1. A leitura de link deixou de poder ser usada como ponte pra rede interna

Desde a v1307 o app abre o link que **o próprio corretor** mandou na conversa e lê o texto da
página (a seleção de imóveis com valores, por exemplo). O endereço era conferido — sem `http`, sem
`localhost`, sem endereço numérico — mas só **uma vez, no começo**. Depois disso sobravam três
caminhos abertos:

1. **O desvio.** Um site público podia responder "vá para outro endereço", e esse destino **não era
   conferido de novo**. Bastava um site qualquer apontar o desvio pra dentro da rede onde o
   servidor roda.
2. **O nome que engana.** Um domínio de aparência normal podia **apontar** (no DNS) para um endereço
   interno. A checagem antiga lia o nome escrito, nunca para onde ele levava.
3. **O teto que não segurava.** O limite de 700 KB por página só era aplicado **depois** de a página
   inteira ter sido baixada — uma resposta de dezenas de MB era baixada e só então jogada fora. E o
   relógio de 9 segundos era desligado antes de o corpo terminar de chegar.

Nada disso era um vazamento em uso: era um caminho aberto esperando alguém. Agora existe **uma
porta única** pra abrir endereço de fora (`baixarPaginaComSeguranca`, em `api/_pipeline.js`), e ela:

- **resolve o nome antes de abrir** e recusa qualquer endereço privado ou reservado — rede local,
  loopback, faixa de metadados de nuvem (`169.254.x`), CGNAT, IPv6 interno, endereço mapeado;
- **segue o desvio na mão**, conferindo **cada parada** do mesmo jeito que a primeira, no máximo 3;
- **corta o download no teto enquanto baixa**, pedaço a pedaço, e recusa de saída a página que já se
  anuncia maior que o teto;
- **mantém o relógio valendo até o último byte**.

Nome que não resolve passou a ser tratado como perigoso (não abre) — quando não dá pra saber pra
onde leva, o certo é não ir. Também deixaram de ser aceitos endereços com **porta diferente da
padrão** (era um jeito de bisbilhotar serviço interno) e com **senha embutida** no endereço.

Pro corretor **nada muda na tela**: link de material continua sendo lido igual, e link que não pode
ser lido continua aparecendo como não lido, sem inventar nada no lugar.

Guarda: `tests/v1322-leitura-de-link-blindada.test.mjs` (endereço interno recusado, desvio pra rede
interna barrado antes de bater na porta, corrente infinita de desvio interrompida, página gigante
cortada durante o download, e o caminho antigo — `redirect: "follow"` — proibido de voltar).

## 2. A Política de Privacidade estava prometendo o contrário do que o sistema faz

O texto publicado era da v1164 (07/08/2026) e dizia, com todas as letras:

> "Imagens, vídeos e documentos […] **não são analisados** — o sistema trabalha apenas com o texto e
> os áudios."

Isso deixou de ser verdade na **v1306** (imagem JPG/PNG/WEBP e PDF passaram a ser lidos pela IA) e
na **v1307** (o link enviado pelo corretor passou a ser aberto e lido). Promessa de privacidade que
não corresponde ao produto não é documentação velha: é o cliente sendo informado errado sobre o que
acontece com o conteúdo dele.

Também estava errado o prazo de guarda: a política dizia que a impressão embaralhada da conexão
usada no cadastro "hoje não é apagada automaticamente", quando a migração `0018` criou a limpeza e
`api/criar-conta.js` a dispara — **7 dias**.

O que mudou nas páginas públicas:

- a seção 2.2 agora descreve, item a item, o que é lido: texto, áudio (com transcrição), **imagem
  (JPG/PNG/WEBP) e PDF** — de qualquer lado da conversa, os mais recentes, com teto por importação e
  teto diário por conta — e o **texto da página dos links que o próprio corretor enviou** (no máximo
  dois; link de cliente ou de terceiro **nunca** é aberto). **Vídeo continua fora**, e nenhum outro
  tipo de documento é lido;
- a seção 3 (para que os dados são usados) passou a citar essa leitura;
- a seção 4 diz que a OpenAI recebe **também as imagens e os PDFs lidos e o texto da página dos
  links**, não só o texto e os áudios;
- a seção 5 informa o prazo real de apagamento automático (7 dias);
- os Termos de Uso passaram a descrever a ferramenta como ela é hoje, e as duas páginas mostram a
  data desta revisão.

Guarda: `tests/v1322-politica-fiel-a-leitura-de-imagem-pdf-e-link.test.mjs`. O teste antigo
(`v1119`) exigia a frase falsa — ele foi corrigido pra exigir só o que continua verdadeiro: vídeo
não é analisado.

## 3. A nota que faltava

A v1320 tinha sido publicada sem `NOTAS-v1320.md` — a única versão recente sem nota. O arquivo foi
escrito a partir do registro da publicação e está marcado como escrito depois.

## O que a auditoria pediu e NÃO foi feito aqui (é decisão do dono)

- **Dividir os arquivos gigantes** (`app.js` com 13 mil linhas, `api/_pipeline.js` com 5,8 mil).
  É a maior dívida técnica do projeto e a causa do vaivém das últimas semanas — mas é obra de
  fôlego, feita por partes e com a suíte protegendo cada corte.
- **Travar a publicação quando o teste falha** e criar **ambiente de homologação**: hoje o teste
  roda mas não impede a subida, e só existe produção. Depende de mexer na configuração do GitHub e
  da Vercel.
- **Uma camada única de acesso ao banco**, pra que o isolamento entre empresas não dependa de
  alguém lembrar de filtrar por empresa em cada consulta nova. Hoje as consultas estão certas — o
  risco é a próxima.
- **Anonimizar o aprendizado reaproveitado entre clientes** (tirar nome, valor, endereço e
  empreendimento antes de o exemplo entrar na análise de outro cliente). Mexe no miolo do prompt,
  que o dono mandou congelar depois das reversões da v1247 e da v1315 — não se toca sem medir
  antes e depois na bateria de conversas.
- **Medir o resultado real da condução** (sugestão → mensagem enviada → resposta → avanço → venda).
  É o próximo salto do produto, não uma correção.

## Suíte

`npm test`: 30 arquivos checados + 467 testes, todos verdes.
