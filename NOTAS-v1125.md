# v1125 — excluir lead volta pra Home de verdade, e arquivar já soma no card "Arquivados"

## O que o dono relatou

Dois relatos no mesmo dia, logo depois da v1124:

1. *"depois q excluir um lead, ele deve voltar a tela da home, e nao ficar travado ali sem fazer
   nada."*
2. *"depois q arquivei um lead, foi pra home automaticamente e ta certo. porem nao aumentou o
   número de arquivados, tive q atualizar a pagina."*

## Problema 1 — a tela morta depois de excluir

Quando você abre um cliente, o app entra num **modo detalhe**: ele esconde o cabeçalho da tela
Hoje, os cartões de números e as listas, pra sobrar espaço só pro cliente. Quem sai desse modo é o
botão "Voltar".

Excluir o lead não passava por aí: apagava o cliente e mandava "mostrar a tela Hoje" — só que o
modo detalhe continuava ligado. Resultado: a tela Hoje voltava a ser a tela da vez, **mas com tudo
escondido**, e a área do cliente ainda com o cadastro que acabou de ser apagado. Do lado de cá, é
uma tela parada, sem nada pra tocar — exatamente o que o dono descreveu.

Agora os dois caminhos de exclusão (o botão "Excluir" dentro de "Editar lead" e o "Excluir
definitivamente" do fim da tela do cliente) usam **o mesmo caminho do botão "Voltar"**: desliga o
modo detalhe, sai de qualquer lista aberta, redesenha a tela Hoje inteira — cabeçalho, cartões e
listas de volta.

Dois arremates no mesmo lugar:

- **Cancelar não tira mais você da tela do cliente.** Antes, clicar "Cancelar" na confirmação de
  exclusão levava pra Hoje do mesmo jeito (e dar erro também). Agora só sai da tela do cliente se
  ele foi mesmo excluído.
- **O cliente excluído some das listas na hora.** Faltava tirá-lo de uma das listas guardadas na
  memória do app — justamente a que a tela Hoje usa antes de perguntar ao servidor. Por isso ele
  ainda aparecia nas listas e nos contadores até um F5.

## Problema 2 — arquivar não mexia no card "Arquivados"

**Arquivar não é apagar** — e essa diferença passou a importar agora que a tela Hoje tem o card
"Arquivados" (v1124).

Arquivar estava usando a mesma limpeza da exclusão, que tira o cliente de **todas** as listas,
inclusive da carteira inteira. E é da carteira inteira que sai o número do card. Ou seja: o
cliente sumia em vez de mudar de situação, então o contador não tinha como subir — só depois de
atualizar a página, quando o servidor devolvia tudo de novo.

Agora arquivar **muda a situação do cliente** nas listas que o app já tem na mão: ele sai dos
atendimentos ativos e continua na carteira, marcado como arquivado. O número sobe na hora.

O mesmo vale pro contrário: **reativar** um cliente na tela de Arquivados já desce o contador e
soma no "Total de leads" na hora, sem F5 (isso também não funcionava).

Arquivar também passou a usar a mesma volta pra Hoje da exclusão — antes o cabeçalho da tela Hoje
("Boa tarde, ...") ficava escondido depois de arquivar, mesmo com os cartões aparecendo.

## Conferido no navegador

App publicado, celular (390px), passo a passo:

1. Tela Hoje normal: cabeçalho visível, 6 cartões, "Arquivados = 1".
2. Cliente aberto: cabeçalho e cartões **escondidos** — é a situação em que o problema acontecia.
3. Depois de excluir: cabeçalho **visível**, 6 cartões **visíveis**, listas redesenhadas, nenhum
   resto do cliente apagado na tela.
4. Depois de arquivar um cliente: "Arquivados" foi de 1 para **2** na hora; ativos caíram de 2
   para 1.
5. Depois de reativar: "Arquivados" voltou para **1**; ativos voltaram para 2.

## Teste de regressão

`tests/v1125-excluir-lead-volta-pra-home.test.mjs` — garante que os dois caminhos de exclusão (e o
caso do cliente que já não existia no banco) voltam pela rota que desliga o modo detalhe; que
cancelar não tira o corretor da tela; que o cliente excluído sai de todas as listas em memória; e
que arquivar/reativar sobem e descem o número de arquivados na hora, sem sumir com o cliente da
carteira.
