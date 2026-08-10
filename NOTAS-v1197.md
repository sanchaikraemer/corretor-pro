# v1197 — "copiei sem querer e não mandei": agora dá pra desfazer

## O relato

Palavras do dono (10/08/2026, com print da tela do cliente Bocorni): *"quero que veja como podemos
fazer pra deletar essa resposta que acabei copiando mas não mandei, foi sem querer"*.

No print, a mensagem sugerida aparecia em **Últimas mensagens** como se tivesse sido enviada, e o
painel do lado registrava *"Copiou mensagem"* e *"Contato manual — Mensagem enviada"*.

## O que estava acontecendo (e o que doía de verdade)

Copiar uma sugestão registra **três** coisas de uma vez:

1. a mensagem no histórico do cliente;
2. o **atendimento do dia** — e é esta a mais cara: cliente atendido sai da fila "Fazer agora" pelo
   período de descanso configurado (padrão 5 dias);
3. a marca de uso que alimenta o Desempenho ("Copiou mensagem").

Ou seja: uma cópia sem querer não sujava só o histórico — **tirava o cliente da fila do dia**, sem
que ninguém tivesse falado com ele. E não havia como voltar atrás.

## O que mudou na tela

No **Últimas mensagens**, a mensagem que o app registrou quando você copiou agora tem um **✕** do
lado direito. Tocar nele pergunta:

> **Não enviei essa mensagem**
> Ela sai do histórico deste cliente. Se foi a única que você copiou hoje, o atendimento de hoje
> também é desfeito e o cliente volta pra fila.

Confirmando, as três coisas são desfeitas de uma vez.

**O ✕ só aparece na mensagem que o app registrou.** Fala que veio da conversa exportada do
WhatsApp — sua ou do cliente — não tem o botão: aquilo é registro do que aconteceu de verdade, e o
servidor também recusa apagar por esse caminho, mesmo que alguém tente por fora.

## A regra do atendimento (pensada pro dia a dia)

O atendimento do dia só é desfeito se, depois de tirar aquela mensagem, **não sobrar nenhuma outra
mensagem copiada no mesmo dia** para aquele cliente. Se você copiou duas e quer apagar só uma, o
atendimento continua valendo — porque a outra ainda vale.

Atendimento de **outros dias** nunca é tocado. **Observação** feita no mesmo dia também não: ela é
trabalho de verdade, não efeito da cópia.

## Como foi conferido

- **A rota rodou de verdade** contra um banco simulado, em 5 situações: a única cópia do dia (some
  do histórico e o atendimento é desfeito), duas cópias no mesmo dia (apaga uma e o atendimento
  continua), tentativa de apagar fala do cliente (recusada, e nada é gravado), mensagem que não
  existe mais (recusada) e chamada sem identificar a mensagem (recusada).
- **No navegador de verdade**, com um cliente montado com os três tipos de linha (fala do cliente,
  mensagem copiada e observação): o ✕ apareceu **só** na mensagem copiada, a pergunta apareceu com
  o texto certo, e o app mandou pro servidor a ação certa, com a mensagem e o cliente certos.
  Nenhum erro.
- **Nos dois temas.** No tema claro o ✕ tinha nascido quase invisível (borda e fundo em branco
  transparente sobre fundo branco) — flagrado em print **antes** de publicar e corrigido. É a
  mesma armadilha da v1078 e da v1186; agora há um teste que impede a regra de sumir numa faxina
  futura.

## Testes

`npm test` — **366 testes, todos verdes**. Novo: `tests/v1197-desfazer-mensagem-copiada.test.mjs`,
que trava a rota (as 5 situações acima), a tela (o ✕ só na mensagem certa, a pergunta antes, o
redesenho depois) e a aparência nos dois temas.

## O que NÃO entrou

- **Desfazer uma observação** pelo mesmo ✕: parece o mesmo problema, mas não é. A observação também
  é gravada no campo de Observações do cliente (texto corrido, que a IA lê nas próximas análises);
  tirar só a linha do histórico deixaria o texto lá, e o corretor acharia que apagou. Fica anotado
  como pedido separado, se você quiser.
