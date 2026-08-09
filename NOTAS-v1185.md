# v1185 — o banco passa a se conferir sozinho, e o app para de "dar um jeito" quando falta trava

O dono trouxe quatro auditorias externas do sistema, todas feitas em cima da versão 1167. Elas
divergem em muita coisa, mas chegaram ao mesmo veredito sobre o que ainda é grave:

> Não é código quebrado. É que o código e o banco de dados podem estar em versões diferentes,
> e ninguém tem como saber.

E não é hipótese. Em 07/08/2026 a conferência à mão mostrou que a migração `0009` **nunca tinha
sido aplicada** no banco de verdade, enquanto da `0010` à `0014` já estavam. Descobrir isso deu
trabalho: foi preciso abrir o Supabase e conferir função por função.

O agravante era um padrão que aparecia em vários pontos do código: **quando uma peça de segurança
do banco não era encontrada, o app não avisava — ele voltava a trabalhar do jeito antigo**, de
antes das contas separadas. Na prática, a regra virava: se a trava estiver faltando, desligue a
trava.

Esta versão ataca as duas coisas.

## 1. O banco agora responde "o que está aplicado em mim"

Foi criada a migração `0017_registro_de_migracoes.sql`. Depois de rodada, existe no app:

**Menu → diagnóstico → `/api/diagnostico?mode=banco`** (só o administrador da plataforma vê)

Ele devolve a lista completa: o que está aplicado, o que falta, e **qual arquivo colar no SQL
Editor** para acertar. Em português, com o nome do arquivo.

O detalhe que faz isso valer alguma coisa: a conferência **não acredita em anotação**. Ela não
tem uma tabela de "marque aqui o que você rodou" — ela **olha o catálogo do Postgres** e procura
a tabela, a função, o índice, a trava e a permissão que cada migração deveria ter deixado. Se a
`0009` estiver faltando, aparece "faltando" mesmo que um documento jure o contrário.

Isso foi testado num **PostgreSQL 16 de verdade**, não em simulação, em três cenários:

| Cenário | O que a conferência respondeu |
|---|---|
| Banco como estava em 07/08 (sem a `0009`, sem a `0015`) | **acusou as duas como faltando** — as outras 15, aplicadas |
| Banco completo (a `0015` suprindo a `0009`) | tudo aplicado |
| Alguém reabre pro navegador a criação de empresa | **`0013` virou "faltando"** na hora |
| Alguém reabre pro navegador o contador de IA | **`0014` virou "faltando"** na hora |

Ou seja: além de dizer o que falta rodar, ela funciona como **alarme** se alguém reabrir uma
porta que já tinha sido fechada.

O código também passou a declarar de que versão de banco ele depende (`MIGRACAO_MINIMA_EXIGIDA`).
De propósito, **isso não derruba o app** quando o banco está atrás: tirar o sistema do ar por
conta própria deixaria corretor sem trabalhar. Ele reporta — e reportar já era o que faltava.

## 2. Três caminhos antigos foram retirados

Cada um deles existia por um motivo razoável na época, e cada um tinha virado o contrário do que
devia.

**a) Salvar o Cérebro.** Se a regra que separa a configuração de cada corretor não fosse encontrada
no banco, o app gravava pela regra antiga — a de quando a configuração era **uma só para o sistema
inteiro**. Num app com várias contas, isso é uma conta gravando **por cima da configuração de
outra**. Agora, se essa regra faltar, o salvamento **falha com aviso claro**. Perder um salvamento
é chateação; misturar o Cérebro de dois corretores é estrago que ninguém desfaz.

**b) Criar a conta.** As telas de cadastro e de entrada tinham um caminho reserva: se o servidor
avisasse que a trava contra cadastro falso em massa não estava instalada, **o navegador criava a
empresa sozinho**, falando direto com o banco. Só que a trava existe exatamente para tirar esse
poder do navegador. Esse caminho foi removido — e ele **já nem funcionava** desde que a trava foi
aplicada: só devolvia um erro em inglês, cru, na tela de quem estava se cadastrando. Agora, quando
o servidor recusa, **a pessoa vê o motivo em português**.

**c) A sugestão de SQL do Cérebro.** Quando a tabela do Cérebro não existia, o app oferecia um
botão **"Copiar SQL"** com o comando pronto para criá-la. O comando era do desenho **antigo**, sem
separação por corretor — rodá-lo hoje juntaria a configuração de contas diferentes na mesma linha.
O botão saiu. O aviso agora diz o que houve e manda aplicar as migrações oficiais.

## 3. Um bug de verdade: o Desempenho passava de um corretor para o outro

Este é o único achado das auditorias que era **erro em funcionamento**, e foi encontrado por
simulação na mão. A sequência:

1. o corretor A usa o app — acumula tempo de uso e atividade dos dias dele;
2. **A sai da conta.** O que é comercial (Cérebro, importação pendente, ZIP, nomes de cliente) é
   apagado, como já era desde a v1165 — certo. Mas o *carimbo* de quem era o dono do aparelho era
   apagado junto, enquanto os contadores de uso ficavam (de propósito: sair e voltar na mesma
   conta não pode zerar o Desempenho de quem já usava);
3. **o corretor B entra.** Sem carimbo, o app concluía "primeiro uso, este aparelho é seu" e não
   limpava nada;
4. B abria a tela **Desempenho** e via **o tempo de app e a atividade do corretor A** como se
   fossem dele.

Nenhuma conversa, cliente, ZIP ou Cérebro vazava — isso já ia embora no passo 2. Mas os números
que o corretor usa para se avaliar ficavam errados.

**A correção:** o carimbo agora **fica** depois da saída. Assim os dois casos funcionam sem ter
que escolher entre eles: a mesma conta que volta mantém o Desempenho; outra conta que entra é
reconhecida como troca de dono e recebe o aparelho limpo.

## Também nesta versão

O `README.md` das migrações dizia "ainda não foi aplicado no seu banco real" e falava só da `0001`
e da `0002` — texto de muitos meses atrás, que podia induzir alguém a fazer besteira. Ele agora
começa avisando que **nenhum documento sabe o que está em produção** e manda perguntar ao banco.

## Testes

Dois arquivos novos:

- `tests/v1185-desempenho-nao-passa-de-uma-conta-pra-outra.test.mjs` — roda o módulo de verdade
  com um aparelho simulado e reproduz a sequência A → sair → B, incluindo uma trava que falha se
  alguém voltar a apagar o carimbo na saída.
- `tests/v1185-banco-se-reporta-e-nada-cai-no-caminho-antigo.test.mjs` — guarda a migração `0017`
  (inclusive a regra de que **toda** migração do disco precisa estar na conferência) e falha se
  qualquer um dos três caminhos antigos voltar ao código.

O teste da v1165 foi ajustado: ele afirmava que o carimbo sumia ao sair — que era justamente o bug.

## O que continua pendente (e depende do dono)

As auditorias listaram mais coisas. Estas **não** entraram nesta versão porque dependem de decisão
ou de acesso que a sessão não tem:

- **rodar a `0017` no Supabase** — sem isso, o diagnóstico novo não tem o que ler;
- **ambiente de teste separado** (hoje tudo roda direto em produção);
- **cadastro à prova de robô de verdade** (a contagem atual não é feita numa operação só, então
  várias tentativas ao mesmo tempo podem furar o limite);
- **fila de conclusão da exclusão de conta** (o banco já apaga em transação; arquivos e login são
  "melhor esforço");
- **dividir o `app.js`**, hoje com mais de 13 mil linhas;
- **desligar de vez a chave compartilhada antiga** (`CORRETOR_PRO_LEGADO_DESLIGADO=sim`), depois de
  confirmar que nenhum aparelho antigo ainda depende dela.
