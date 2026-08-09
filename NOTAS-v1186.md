# v1186 — auditoria pente-fino: dois botões que nunca apareceram, 61 funções mortas e o cadastro à prova de robô

O dono mandou quatro auditorias externas do sistema (feitas na v1167) e pediu, antes de dormir:
conferir se procediam, fazer uma auditoria própria, montar um checklist e executar tudo durante a
madrugada, revisando duas vezes. Esta nota registra o que mudou. O relatório completo da conferência
está em `AUDITORIA-v1186.md`.

## O achado principal: três telas tinham sumido, e ninguém tinha como saber

Varrendo o `app.js` com um analisador de sintaxe, apareceram, ao todo, **61 funções que ninguém
chamava** (40 no `app.js`, 21 nas rotas do servidor). A maioria era só peso morto. Mas três eram
tela de verdade, e uma delas dói:

**1. "Juntar cliente duplicado" nunca apareceu no app.** É o recurso da v1148 — o dono pediu, foi
feito, foi testado, foi publicado. Só que o botão foi escrito dentro de um painel de ações do lead
que a **v908** tinha parado de desenhar (naquela versão as ações principais subiram pra barra de
ícones do topo). O código funciona, a rota do servidor funciona, a janela de escolha do cadastro
duplicado funciona — faltava só o botão que abre. **Desde o dia em que foi feito, nunca esteve na
tela.**

**2. "Excluir definitivamente" também estava sem porta de entrada.** Mesmo painel. A barra do topo
só tem "Arquivar"; excluir de vez não tinha por onde.

**3. A barra de etapa do lead** ("Negociando · passo 5 de 6") também não era desenhada — mas essa
está **certa**: a v889 registra que o dono mandou tirar o funil de 6 etapas ("muitos leads
'avançados' estão longe de fechar; o funil não mede qualificação") e trocá-lo pela barra de
interesse do cliente, que é a que aparece hoje. O que ficou pra trás foi só o código e ~20 linhas
de CSS de um chip que ninguém mais desenha.

### Por que os testes não pegaram

Porque eles conferiam **o texto do arquivo**, não a tela. O teste da v1148 procurava o botão escrito
no `app.js` — e ele estava escrito, dentro de código que não roda. O mesmo com a barra de etapa: um
teste chegava a **executar** a função e medir o preenchimento da barra com precisão de duas casas
decimais, três meses depois de ela ter saído da tela.

### O que mudou

Os dois botões que faltavam voltaram, num bloco **"Mais opções"** recolhido, ao lado de "Detalhes
comerciais", na tela do cliente. Só os dois: Proposta, Editar, Arquivar, Mensagens, Reanalisar,
Agendar e Marcar já estão na barra do topo e não podem aparecer duplicados. Excluir para sempre
ficou recolhido de propósito — não é botão de tocar sem querer.

Ao conferir o bloco novo em print, apareceu um detalhe que só dá pra ver com a tela na frente: no
**tema claro**, "Excluir definitivamente" ficava com a mesma cara de um botão comum — uma regra de
tema claro tinha prioridade maior que a do botão de perigo. Botão que apaga um cliente para sempre
tem que parecer perigoso nos dois temas. Corrigido e conferido em print. (Esse defeito existia havia
tempo; ninguém tinha como ver, porque o painel nunca era desenhado.)

E entrou uma **guarda automática** (`tests/v1186-nada-de-codigo-morto.test.mjs`): a partir de agora,
função que ninguém chama **quebra a suíte**, com a explicação de que ou falta ligar na tela, ou deve
ser apagada. A mesma guarda cobre o servidor: ação que nenhuma tela pede também falha.

## O app ficou mais leve

| | antes | depois |
|---|---|---|
| baixado em toda abertura | ~940 KB | ~840 KB |
| `app.js` | 13.893 linhas | 13.520 linhas |
| `styles.css` | 180 KB | 136 KB |
| funções que ninguém chama | 61 | 0 |

**96 KB deixaram de ser baixados em toda abertura.** A biblioteca que lê arquivos ZIP era carregada
sempre, por todo corretor — mas ela só serve pra enxugar o ZIP do WhatsApp na importação e pra
montar a planilha de exportação. Quem abre o app pra ver a fila do dia nunca usava. O curioso é que
o carregamento sob demanda **já existia no código** e nunca era usado, porque a biblioteca sempre já
estava lá. Agora ela é baixada na hora em que o corretor vai importar.

**167 classes de CSS sem dono saíram** (31% do arquivo): sobras de gerações antigas de tela.
Conferido com print antes/depois em 7 telas — Hoje no celular, Hoje no computador, Hoje no tema
claro, entrar, criar conta, privacidade e painel administrativo: **zero pixel de diferença**.

Também saíram do servidor três ações que nenhuma tela pedia (duas eram "cauda de compatibilidade"
de aparelhos com versão antiga em cache — a cauda expirou, são 13 versões desde então) e um nome de
ação fantasma que o app mandava e nenhuma rota atendia (funcionava por acaso, caindo no caminho
padrão).

## O cadastro à prova de robô virou uma operação só

A auditoria apontou, com razão, que a trava contra cadastro falso em massa **não era atômica**: o
servidor contava quantas contas saíram daquela conexão nas últimas 24h, decidia, criava a empresa e
só então somava +1 no contador. Entre o "conta" e o "soma" havia uma janela — cinco pedidos ao mesmo
tempo liam "4", todos passavam, todos criavam.

Não ficou na teoria. Subi um **PostgreSQL 16 de verdade** e disparei oito cadastros simultâneos da
mesma conexão, com limite 5:

- caminho antigo: **8 contas criadas**;
- função nova (migração `0018`): **5 criadas, 3 recusadas** — exatamente o limite.

Agora contar, decidir, criar e registrar acontece **dentro da mesma transação**, com trava por
conexão (corretores diferentes não esperam um pelo outro). Cada conta em teste gasta crédito de IA
pago pelo dono; era esse buraco que deixava um robô multiplicar isso.

Na mesma migração: a **impressão da conexão deixou de ser guardada pra sempre**. Ela só é consultada
nas últimas 24 horas e nada nunca apagava o resto — agora sai depois de 7 dias, sozinho.

## O que você precisa fazer

**Abrir o Supabase → SQL Editor → New query, colar `supabase/migrations/0018_cadastro_atomico_e_limpeza.sql`
inteiro e clicar em Run.** Uma vez só. Se ainda tiver pendente a `0017` (da versão anterior), rode
ela antes.

Sem isso nada quebra: o cadastro continua funcionando pelo caminho antigo, a trava continua no
servidor — só perde a exatidão quando chegam vários pedidos no mesmo instante. E não fica escondido:
o servidor avisa no registro dele, e `/api/diagnostico?mode=banco` mostra a `0018` como "faltando".

## Testes

`npm test` — **354 testes, todos verdes** (eram 352). Dois arquivos novos:

- `v1186-nada-de-codigo-morto.test.mjs` — a guarda descrita acima;
- `v1186-migracao-0018-cadastro-atomico.test.mjs` — trava antes da contagem, criação depois da
  decisão, registro na mesma transação, código de recusa próprio, limpeza que nunca apaga o dia
  corrente, e nada liberado pro navegador.

**Onze testes antigos foram corrigidos** porque guardavam código morto — cada um agora aponta pro
que a tela realmente faz, com o histórico anotado dentro do arquivo. Esse era o problema silencioso
por trás dos três recursos sumidos: um teste que passa enquanto guarda um fantasma dá a impressão de
cobertura que não existe.

## O que não entrou, e por quê

- **Unificar as notas num `CHANGELOG.md`** (pedido de uma das auditorias): não. O `CLAUDE.md` deste
  projeto manda criar um `NOTAS-vNNN.md` por versão, e é o que você usa pra lembrar do que foi feito.
- **Migrar pra TypeScript**: exigiria uma etapa de compilação num projeto que hoje publica arquivo
  estático direto. Custo alto, ganho pequeno perto do resto.
- **Ambiente de teste separado, CI bloqueando o merge, revisão jurídica da privacidade, desligar a
  chave compartilhada antiga**: dependem de decisão ou de acesso seus, não de código. Estão
  detalhados no fim de `AUDITORIA-v1186.md`.
- **Dividir o `app.js` em módulos**: continua pendente. A limpeza tirou ~370 linhas, mas a divisão em
  si é obra grande e arriscada de fazer sem você olhando a tela.
