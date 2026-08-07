# v1176 — exportei a conversa de uma cliente e abriu o cadastro de OUTRA

Dois prints do dono em 07/08/2026 (versão 1175): ele exportou a conversa de uma cliente e, no fim
da importação, o app abriu o cadastro de **outra pessoa** — com a análise carimbada naquele minuto.

## O que estava acontecendo

O app precisa reconhecer, a cada importação, se aquela conversa é de um cliente que **já existe**
(pra atualizar o cadastro em vez de criar um cadastro repetido). Ele usava três pistas, nesta
ordem: **telefone**, **nome do arquivo** e **nome do cliente**.

O problema estava na primeira: o "telefone do cliente" era o **primeiro número que aparecesse
escrito em qualquer lugar da conversa** — mensagem dele, mensagem do corretor, áudio transcrito,
tanto fazia. E qual é o número que mais aparece escrito nas conversas de um corretor? **O dele
mesmo** ("qualquer coisa me chama no (54) 9…"), mandado pra praticamente todo mundo.

Resultado: duas clientes diferentes que receberam esse mesmo número escrito ficavam com a **mesma
chave de identidade**. Como o telefone é conferido ANTES do nome, a importação da segunda era
tratada como "esse cliente já existe" — e a conversa dela era despejada dentro do histórico da
primeira, sem perguntar nada. No fim, o app abria o cliente errado. Era isso que o print mostrava.

Tinha ainda um segundo jeito de a mesma coisa acontecer: quando o aparelho compartilha o ZIP **sem
nome** (o app usa "conversa-whatsapp.zip" nesse caso), duas importações sem nome ficavam com a
mesma chave de arquivo — e colavam uma na outra pelo mesmo caminho.

## O que a v1176 muda

**1. Número escrito no meio da conversa não é mais o telefone do cliente.**
O único telefone que o app aceita do arquivo é o do **próprio contato exportado** — aquele que o
WhatsApp escreve no lugar do nome quando o contato não está salvo na agenda. Todo o resto continua
guardado, mas só como informação: nunca decide de quem é o cadastro. Quando o número não vem no
arquivo, quem preenche é você, em **Editar** — e esse número, agora, **não é mais apagado** por uma
reimportação (antes ele era sobrescrito pelo que fosse achado no texto).

**2. Nenhuma pista sozinha junta duas pessoas diferentes.**
Telefone e nome de arquivo servem pra RECONHECER o mesmo cliente entre uma exportação e outra — não
são prova. Agora, quando os dois lados têm nome de gente e são nomes de pessoas claramente
diferentes, a junção automática está proibida: entra um cadastro separado, que você pode juntar
depois na mão (botão **Juntar clientes**), em vez de misturar duas conversas de um jeito que
ninguém consegue desfazer.

Continua liberado o caso real de sempre: contato **renomeado no celular** entre duas exportações —
"Fulana" que virou "Fulana Sobrenome", ou o nome que ganhou o empreendimento no fim. Esse é o mesmo
cliente e segue sendo reconhecido (inclusive pra não pagar transcrição/análise de novo).

**3. Arquivo sem nome não identifica ninguém.**
"conversa-whatsapp.zip" e parecidos deixaram de valer como identidade de cliente.

**4. A tela deixou de aceitar de olhos fechados o cliente que o servidor apontou.**
Quem manda no fim é o nome que está na tela: nome de outra pessoa, o app ignora a indicação; nome
só parecido, ele **pergunta** ("é o mesmo cliente?") em vez de atualizar sozinho.

## O que isso NÃO conserta

Cadastro que **já foi misturado** antes desta versão continua misturado — o app não tem como
adivinhar quais mensagens vieram de qual conversa. Reexportando a conversa da cliente que abriu
errado, ela agora entra no cadastro dela, certinho; o cadastro que recebeu as mensagens a mais
precisa ser conferido (e, se atrapalhar, é caso de me avisar pra eu ajudar a separar).

## Testes

`tests/v1176-conversa-nunca-entra-no-cliente-errado.test.mjs` — tranca as cinco frentes: número
citado na conversa não vira telefone do cliente; o número do próprio contato exportado continua
valendo; mesmo telefone com nomes de pessoas diferentes NÃO junta; mesmo cliente renomeado continua
sendo reconhecido; arquivo genérico não identifica ninguém; id vindo do navegador apontando pra
outra pessoa é recusado; telefone digitado à mão sobrevive à reimportação; e a tela confere o nome
antes de aceitar o cliente indicado pelo servidor.

`tests/v825-import-integridade.test.mjs` foi ajustado no ponto que cobrava o comportamento antigo
(o número do texto virando telefone do cliente) — que era exatamente o defeito.

Suíte completa verde: 24 arquivos, 342 testes.
