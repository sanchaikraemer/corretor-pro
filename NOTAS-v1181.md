# v1181 — a segunda porta: o nome do arquivo estava puxando a conversa pro cadastro errado

Depois da v1180, o dono exportou a conversa do Anderson de novo e **caiu no lead do Estevan outra
vez**. A v1179 e a v1180 consertaram de quem é o NOME que aparece no cartão — mas não era só isso
que decidia em qual cadastro a conversa entra.

## O que estava acontecendo

O app reconhece "esse cliente já existe" por três pistas: **telefone**, **nome do arquivo** e **nome
do cliente**. A v1176 travou o telefone (número escrito na conversa não junta duas pessoas), e a
v1177 deixou o **nome do arquivo valendo sozinho**, com o argumento de que "o nome do arquivo é o
nome do contato exportado, então não pode misturar ninguém".

Deixou de ser verdade no minuto em que uma importação entrou no cadastro errado. Quando isso
acontece, a gravação **carimba no cadastro invadido o nome do arquivo da outra pessoa**. Foi o que
sobrou da importação original: o cadastro do Estevan ficou com o nome de arquivo do Anderson colado
nele. A partir daí, **toda** reexportação da conversa do Anderson batia nessa pista e voltava pro
cadastro do Estevan — com o nome do cliente já correto e tudo, porque essa pista nem olha o nome.

Por isso a v1180 pareceu não ter resolvido nada: ela corrigiu a plaquinha do nome, e a conversa
continuou entrando na porta errada.

## O que a v1181 muda

**Nenhuma pista junta duas pessoas diferentes — agora vale pra todas, sem exceção.**
O nome do arquivo passou a obedecer à mesma trava que o telefone já obedecia desde a v1176: se o
nome do cliente desta importação e o nome do cadastro encontrado são **pessoas claramente
diferentes**, a conversa NÃO entra lá — entra num cadastro próprio.

A trava não exige nomes iguais, então o que já funcionava continua funcionando:
- reexportar a conversa do **mesmo cliente** atualiza o cadastro dele, como sempre;
- cadastro que você **renomeou à mão** ("Anderson terreno NVR") continua sendo reconhecido;
- cadastro que ainda **não tem nome analisado** continua sendo atualizado pelo arquivo.

O que ela proíbe é só isto: a conversa de uma pessoa entrar no cadastro de outra.

## O que fazer agora

Exporte a conversa do Anderson mais uma vez. Ela vai criar o **cartão dele**, com o nome dele e só
a conversa dele. O cartão antigo (o do Estevan, que ficou com as mensagens misturadas) não se
conserta sozinho — depois de conferir que o novo entrou certinho, **apague o cartão misturado** e,
se o Estevan for um cliente de verdade, importe a conversa dele de novo pra ele voltar limpo.

Antes de testar, confira o número no topo do app: precisa estar **Atualização #1181**. Se ainda
aparecer um número menor, feche e abra o app de novo — ele guarda a versão anterior no celular.

## Efeito colateral aceito

Se você renomear um cadastro pra um nome **completamente diferente** do contato do WhatsApp (não só
com palavras a mais — outro nome mesmo), a próxima exportação daquela conversa vai criar um cadastro
separado em vez de atualizar o antigo. Isso se resolve com o botão **Juntar clientes**. É um
incômodo pequeno perto do estrago do outro lado: conversa entrando no cliente errado, que ninguém
consegue desfazer depois.

## Testes

`tests/v1181-arquivo-nao-junta-pessoas-diferentes.test.mjs` — reproduz exatamente o cadastro
invadido (lead do Estevan carregando o nome do arquivo do Anderson) e prova que a conversa do
Anderson não volta pra lá por nenhum dos três caminhos da busca (coluna indexada, id vindo do
navegador e varredura antiga); e prova que o mesmo cliente, o cadastro renomeado à mão e o cadastro
sem nome analisado continuam sendo reconhecidos.

`tests/v1177-exportou-conversa-entrega-analise.test.mjs` teve o ponto que cobrava a decisão antiga
(trava só no telefone) atualizado para a regra nova, com a explicação do porquê da reversão.

Suíte completa verde: 24 arquivos, 347 testes.
