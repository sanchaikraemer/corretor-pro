# v1175 — "Salvando… 94%" com a rodinha girando pra sempre depois que a gravação já tinha falhado

Print do dono em 07/08/2026, já na versão 1174: depois da importação inteira ter rodado, a tela
ficou parada em **"Salvando — salvando no banco de dados… (94%)"**, com a rodinha girando e nada
acontecendo. Pergunta dele: *"pq apareceu isso apos o carregamento?"*.

## O que estava acontecendo

Não era travamento. A **gravação no banco falhou** — e o app tratou o fracasso assim:

- mostrou o motivo num **toast**, que some sozinho em poucos segundos;
- fez voltar os botões de tentar de novo (lá embaixo, fora da vista);
- e **não encostou na linha de andamento**.

Aquela linha ("Salvando — salvando no banco de dados… 94%", com rodinha) continuava exibindo o
último estado bom que tinha visto. Quem os libera — os botões "Nova análise" e "Diagnóstico" no
alto da tela — é justamente o desenho de etapas, que nunca mais foi chamado; então eles também
seguiam travados. Quinze segundos depois do toast sumir, o que sobrava na tela era exatamente a
foto de um sistema pendurado.

É a **mesma lição do 92% da v1174**, agora num passo adiante do fluxo: todo caminho de erro precisa
**mexer na tela que ficou pra trás**. Escrever o aviso num lugar que desaparece e deixar a tela
antiga como estava é pior do que não avisar — vira travamento aos olhos de quem usa.

## O que a v1175 faz

Os dois caminhos de gravação (salvar cliente novo e atualizar cliente existente) passam a terminar
no mesmo lugar quando falham (`cpImportacaoFalhouNaGravacao`):

| | Antes | Agora |
| --- | --- | --- |
| Linha de andamento | congelada em "Salvando… 94%" | **"Falha recuperável — <motivo>"**, 100% |
| Rodinha | girando pra sempre | **parada** |
| "Nova análise" / "Diagnóstico" | travados | **liberados** |
| Tela cheia da importação | podia continuar de pé | **fechada** |
| Motivo | só num toast que some | **escrito na tela, e fica** |

E o aviso que fica diz a única coisa que importa naquele momento: **a análise não foi perdida** —
os botões de tentar de novo continuam valendo (o resultado da IA segue guardado, não precisa
exportar a conversa outra vez nem pagar análise de novo).

O recado especial de queda de conexão (v1096 — "a gravação não terminou a tempo, toque em Salvar
lead pra tentar de novo") continua existindo, só que agora também **fica na tela** em vez de
passar voando.

## Arquivos

- `app.js` — `cpImportacaoFalhouNaGravacao` (fim de linha honesto), usada por `salvarLeadPendente`
  e pelo caminho de atualizar cliente existente. `renderEtapas` e essa função passam a ser
  dirigíveis de fora (mesmo motivo de `cpImportOverlaySincronizar`: conferência em navegador de
  verdade e diagnóstico).
- `tests/v1175-gravacao-que-falha-nao-deixa-tela-girando.test.mjs` — regressão.
- `tests/v1080` e `tests/v1088` — atualizados pro desenho novo, mantendo a intenção original
  (erro traduzido, nunca cru; tela cheia sai ANTES do aviso).

## Conferido

- Suíte completa verde (24 arquivos, 341 testes).
- Visual no Chromium headless (412×915), no app publicado, reproduzindo o print: com a tela na
  etapa "Salvando" o resultado computado era `Salvando — salvando no banco de dados... (94%)`,
  rodinha **ligada**, botões **travados**; ao mandar a gravação falhar, virou
  `Falha recuperável — HTTP 500 (100%)`, rodinha **desligada**, botões **liberados**, tela cheia
  fechada e o motivo escrito no quadro da importação. Nenhum erro de página.

## O que este pacote NÃO responde

**Por que a gravação falhou** naquela importação. O motivo real estava no toast que sumiu, e esta
sessão não tem acesso aos registros de produção. A partir desta versão o motivo fica escrito na
tela — se acontecer de novo, o print já vai trazer a resposta junto.
