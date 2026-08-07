# v1177 — exportou a conversa, a análise sai. Ponto final.

Dono, 07/08/2026, logo depois da v1176: *"acabei de exportar um cliente e não atualizou de novo.
Quando eu exporto uma conversa tem que fazer análise e ponto final. Eu não tenho que exportar um
cliente e daí o sistema vai me mandar fazer análise."*

## Defeito 1 — a exportação reaproveitava justamente a análise que a tela recusa

Desde a v1141 existe uma economia: reimportar a mesma conversa **sem nenhuma mensagem nova** não
paga análise nova — o app reaproveita a que já estava salva. Certo, e continua valendo.

O problema é que ele reaproveitava **sem conferir se aquela análise ainda serve pra ser mostrada**.
Quando a análise salva é de uma versão antiga, o cadastro mostra *"Análise comercial pendente nesta
versão. Reanalise para evitar informação antiga."* — ou seja, a tela recusa aquele texto. Reexportar
esse cliente reaproveitava exatamente o texto recusado: a exportação **não mudava nada** e o app
continuava mandando ele reanalisar na mão. Pra sempre.

Agora a regra é a mesma dos dois lados: análise salva só é reaproveitada **se a tela puder
mostrá-la como está**. Não podendo, a IA roda na hora — isso não é retrabalho, é a única forma de a
exportação entregar o que ele espera. A economia continua de pé no caso que interessa (análise boa
+ nenhuma mensagem nova = nada pago).

## Defeito 2 — a trava da v1176 tinha ficado larga demais

A v1176 impediu que duas pessoas diferentes fossem fundidas num cadastro só. Mas ela exigia nomes
compatíveis também quando a pista era o **nome do arquivo** — e o nome do cadastro pode ter sido
**editado à mão** pelo corretor (v1061), ficando diferente do nome do contato no celular. Nesse
caso o mesmo cliente deixaria de ser reconhecido e a exportação criaria um cadastro repetido em vez
de atualizar o que existe.

A trava agora vale **só onde o problema realmente existia: o telefone** — a pista que cruzava
clientes sem nenhuma relação (o número do próprio corretor escrito dentro das conversas). Nome de
arquivo e nome do cliente voltam a valer sozinhos, como sempre valeram.

## Testes

`tests/v1177-exportou-conversa-entrega-analise.test.mjs` (novo): análise salva recusada pela tela
(arquitetura antiga, sem carimbo, reconciliação local, reanálise pendente) nunca é reaproveitada —
a exportação analisa de novo; análise boa continua sendo reaproveitada sem cobrança; o mesmo
cliente com o nome do cadastro editado à mão continua sendo atualizado (nada de cadastro
repetido); e a trava por telefone da v1176 continua no lugar.

`tests/v1141-reimportacao-nao-paga-retrabalho.test.mjs` ganhou o carimbo de arquitetura na análise
salva de exemplo — que é o que uma análise atual de verdade sempre carrega.

Suíte completa verde: 24 arquivos, 343 testes.
