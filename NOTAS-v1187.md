# v1187 — desfazendo o erro da v1186: o app já cuidava de cadastro repetido

## O que aconteceu

Na auditoria da v1186 eu encontrei código órfão no `app.js` — um painel de ações do cliente que
tinha deixado de ser desenhado na v908 — e concluí que dois recursos tinham se perdido: "Juntar
cliente duplicado" e "Excluir definitivamente". Devolvi os dois num bloco "Mais opções" na tela do
cliente.

O dono derrubou os dois, e estava certo nas duas coisas:

> "Como é que eu vou saber, dentro do lead, se ele é duplicado ou não? Isso só funcionaria se ele
> me mostrasse: nome tal e tal, é a mesma pessoa? Daí eu clico sim ou não e unifica. (...) Pra que
> mais um botão excluir definitivamente se ele já tem lá em cima em editar?"

**E tem um motivo mais forte ainda: o app já faz isso.** Fui conferir e são três camadas, nenhuma
delas passando por um botão na tela do cliente:

1. **O servidor junta sozinho na importação.** `_buscarProcessamentoExistenteV681` reconhece o
   mesmo cliente por telefone, nome do arquivo e nome, e reaproveita o cadastro que já existe.
2. **Quando o nome é só parecido, a importação pergunta** — com os dois nomes na tela:
   *"Pode ser o mesmo cliente que já existe: 'Fulano'. O nome desta importação ('Fulana') é
   parecido, mas não idêntico. É o mesmo cliente?"* É exatamente o sim/não que o dono descreveu, no
   único momento em que ele tem os dois cadastros na frente.
3. **A lista agrupa cópias num card só** (`dupeIds`), e apagar leva todas as cópias junto.

E "Excluir definitivamente" já existia em **Editar lead → Zona perigosa → "Excluir este lead"**.

## O que mudou nesta versão

- **O bloco "Mais opções" saiu**, com os dois botões. O painel órfão foi removido de vez.
- **A fusão manual da v1148 ganhou uma porta de entrada discreta em Editar lead**, e só ela. Ela
  serve para o caso raro que a pergunta da importação não pega: a mesma pessoa com dois cadastros
  de nomes bem diferentes. Fica onde o corretor já vai para administrar o cadastro, e não na tela do
  cliente pedindo que ele adivinhe.
- **Os testes que eu tinha escrito errado foram reescritos.** A guarda contra código morto agora
  exige que as três camadas de verdade continuem de pé (o reconhecimento no servidor, a pergunta da
  importação e o agrupamento de cópias na lista), em vez de exigir um painel que não devia existir.

## A lição, registrada no código

Código órfão **não é automaticamente uma feature perdida**. Antes de religar qualquer coisa que a
varredura acuse como morta, é preciso conferir se o produto já resolve aquilo por outro caminho —
foi o que faltou na v1186. O comentário no `app.js`, onde o painel morava, guarda essa história
inteira para a próxima pessoa que passar por ali.

Continua valendo o resto da v1186: a limpeza de código morto, os 96 KB a menos em toda abertura, o
CSS sem dono e a migração `0018` do cadastro atômico.

## Testes

`npm test` — 354 verdes. Três testes ajustados (`v1148`, `v904`, `v1186-nada-de-codigo-morto`).
