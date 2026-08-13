# NOTAS v1246 — notas e arquivados sobem pra barra de cima

Data: 13/08/2026. Pedido do dono, com print e um círculo vermelho no espaço vazio da barra:

> "quero q elimine o card 'bloco de notas' e coloque ele ali em cima onde circulei"
> "sem atender mais de 30 dias, pode deletar tb, nao sera mais necessario"
> "arquivados tambem pode eliminar o card, mas coloque um icone la em cima q possa ver e
> acompanhar e abrir eles novamente se um dia quiser"

Mandei quatro modelos e ele escolheu o **B**: notas e arquivados entram DENTRO da mesma pastilha do
calendário e do sino, separados por risquinho. A barra fica com um objeto só à direita.

## O que mudou na tela

- A fileira de quadradinhos foi de **7 para 4**: Fazer agora, Total de leads, Aguardando cliente,
  Atendidos.
- **Sem atender 30d+** — apagado. Sem o quadradinho, a lista não tinha mais nenhuma porta de
  entrada, então a função, a rota e a coluna dela saíram também: código morto que sobra só engana
  quem lê depois. A **régua** (`cpSemAtenderHaDias`) continua, porque a fila "Fazer agora" usa ela.
- **Arquivados** e **Bloco de notas** viraram botões no bloco do topo, na ordem: notas, arquivados,
  calendário, sino — o que é arquivo antes do que é agenda.
- O desktop voltou a **4 colunas**. Coluna a mais que quadradinho deixa card esticado sozinho numa
  segunda linha (foi o defeito da v1124, quando entrou o sexto sem mexer no CSS).

## Um número, uma conta só

`cp1246AtualizarBlocoTopo` preenche os dois números, com a MESMA conta que os quadradinhos faziam:
notas por `cp1170PendCount`, arquivados pela carteira inteira (`state.todosLeads`, porque a Home só
recebe a ativa). Dois lugares contando a mesma coisa sempre divergem — foi a lição das v1215/v1227.

## O que a suíte não teria pego

Na conferência visual em navegador de verdade (390px), o bloco passou de ~118px para **209px** com
os dois botões novos e começou a comer o nome da marca: aparecia **"Corretor Pr"**. Apertei o
espaçamento do bloco no celular e ele voltou para 167px, com a marca inteira de novo. Conferido em
1440px, 820px e 390px: nenhum estouro lateral e a fileira nas colunas certas (4 / 4 / 2).

## Testes

`tests/v1246-notas-e-arquivados-no-topo.test.mjs`. Ajustados os que descreviam a tela antiga: v826,
v1071, v1077 (os dois), v1098, v1124, v1170, v1171. Removido `v1072`, que testava inteiro a lista
apagada.

Suíte: **411 testes, todos verdes.**
