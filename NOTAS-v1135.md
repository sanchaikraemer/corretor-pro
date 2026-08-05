# v1135 — auditoria da madrugada: a causa comum de três bugs, corrigida na raiz

O dono pediu uma auditoria completa do sistema enquanto dormia: código linha a linha, pesquisa de
mercado e três revisões. Esta nota registra o que **mudou no código**. O relatório completo (o que
foi encontrado e não foi mexido, e a pesquisa de mercado) foi entregue na conversa.

## O achado principal: não era um bug, eram três com a mesma causa

Nas últimas semanas apareceram três defeitos com a mesma cara — "mexi e a tela não mudou":

- **v1125** — "arquivei, foi pra Home certinho, porém não aumentou o número de arquivados".
- **v1133** — "deletei e não saiu daí" (lembrete excluído continuava na Agenda).
- Remarcar lembrete mostrava a data antiga até sair da tela. Ninguém tinha relatado.

Cada um foi corrigido individualmente, atualizando a memória na mão. A auditoria mostrou que os três
saíam do mesmo lugar.

**O sistema tem duas camadas de cache com regras diferentes:**

1. `carregarTelaAtiva()` compara `state.viewRendered[tela]` com `state.dataRevision`. Essa camada
   está **certa**: depois de qualquer gravação a revisão sobe e a tela é marcada pra recarregar.
2. Só que `carregarAgenda()`, por dentro, tinha um atalho que desenhava de `state.todosLeads` e
   voltava — **sem olhar revisão nenhuma**.

Ou seja: a camada de fora decidia "precisa recarregar", chamava `carregarAgenda()`, e a camada de
dentro desenhava do mesmo pedaço de memória velho. A decisão certa era anulada pela de dentro.

Nesse desenho, **cada ação nova precisa lembrar de atualizar a memória na mão — e esquecer não dá
erro nenhum**, só mostra dado velho. É uma armadilha que continuaria produzindo bugs.

## A correção

Separar duas coisas que estavam misturadas:

- **Pintar rápido** — a memória serve pra isso, mesmo velha; é melhor que "Carregando..." a cada
  navegação.
- **Estar certo** — se a memória não está em dia, vai ao servidor e repinta.

Para isso, `state.carteiraRevisao` guarda **em que revisão a carteira em memória foi preenchida a
partir do servidor**. Enquanto bater com `dataRevision`, a memória está em dia. Quando não bater,
alguma coisa mudou desde então e a tela revalida.

O carimbo só é posto onde os dados vieram mesmo de `getLeadsData` — nunca onde a lista recebe uma
cópia da própria memória (o atalho da Home, por exemplo, não carimba). **A direção da falha
importa:** esquecer de carimbar deixa a tela revalidar à toa (mais lenta); carimbar sem ter buscado
mostraria dado velho como novo, que é exatamente o defeito que esta peça existe pra impedir.

A sincronia manual da memória continua valendo (`cpMarcarEtapaLocal`, `cpAtualizarLembreteLocal`,
`removerLeadDosCaches`) — é ela que evita o piscar. A revalidação é **rede de segurança**, não
substituta.

## Custo: a revalidação NÃO aumenta o consumo do banco

Isso importa porque a cota do Supabase do dono está estourada. Medido em navegador real:

- memória em dia → **0** buscas extras (o atalho continua valendo integralmente);
- depois de uma gravação → **1** busca (que é exatamente quando ela precisa acontecer).

Não há tráfego novo em uso normal.

## Documentação

`ESTADO-ATUAL.md` ganhou duas seções que faltavam e que explicam o sistema pra quem chegar depois:

- **5-A. Jornada do cliente novo** — os 5 passos do caminho que decide a venda (link → convite →
  cadastro → importação → prévia → Cérebro), com os avisos de "não reintroduza isto" nos pontos que
  já foram consertados entre a v1128 e a v1134.
- **5-B. Cache de tela e memória** — a armadilha descrita acima, escrita pra ninguém repetir.

E a seção 8 (pendências) ganhou, no topo, a **maior pendência técnica encontrada na auditoria**: a
listagem lê a conversa inteira de todos os leads a cada carga (ver o relatório e a seção 8).

## Arquivos

- Alterados: `app.js` (carimbo + revalidação da Agenda), `js/state.js` (`carteiraRevisao`),
  `ESTADO-ATUAL.md`, `tests/v1133-...` (passou a exigir a garantia nova, mais forte).
- Novo: `tests/v1135-carteira-em-memoria-sabe-se-esta-velha.test.mjs`.

## Conferido

- Suíte completa: **308 testes verdes**.
- Chromium, com a rede simulada e contando as chamadas: memória em dia = 0 buscas extras; depois de
  gravar = 1 busca; 3 cartões desenhados; nenhum erro.
