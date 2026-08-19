# v1305 — endereço inventado, preço vencido, e a tela avisando quando a sugestão sai furada

Dois prints do dono na manhã de 19/08/2026, e as duas coisas são a mesma doença: **afirmar o que não
se sabe**.

## 1. Endereço inventado ("Rua das Flores, 123")

A cliente respondeu ao anúncio e perguntou o que mais importa: *"Onde fica? Endereço"*. As três
sugestões responderam com uma rua, um número e um ponto de referência que **não existem em lugar
nenhum daquela conversa**.

É o pior erro possível: endereço errado por escrito manda o cliente para o lugar errado.

A trava criada na v1301 não pegou por um detalhe bobo: ela procurava o nome logo depois da palavra
"rua", e o nome vinha com conectivo no meio ("Rua **das** Flores") — a leitura parava ali. O mesmo
buraco deixou passar "próximo ao **hospital** HCC", porque a palavra "hospital" ficava entre o
gatilho e o nome.

**Agora a checagem não depende disso.** Ela olha a palavra de endereço (rua, avenida, travessa,
estrada, rodovia, alameda, loteamento, bairro, "número 123") e cobra que aquilo esteja escrito na
conversa ou numa observação daquele cliente. Não está? A mensagem volta pra IA reescrever sem o
endereço. Pontos de referência (hospital, shopping, colégio, praça, terminal, igreja...) entraram na
mesma conta.

Endereço que **está** na conversa continua podendo ser repetido — é fato daquele atendimento.

## 2. Preço de dez meses atrás voltando como preço de hoje

Outro print, outra cliente: em **30/10/2025** você anunciou nessa conversa *"De R$ 390.000 por
R$ 350.000"*. Ela sumiu e voltou **dez meses depois**, em 18/08/2026, com *"posso ter mais
informações sobre isso?"*. As três sugestões responderam repetindo os R$ 350.000 como se fosse o
preço de hoje — uma promoção quase anual oferecida por escrito a quem pode cobrar.

**A causa não era falta de regra.** A IA lê a conversa como um bloco só: a mensagem de outubro de
2025 e a de ontem chegam nela com a mesma cara. Faltava o dado mais simples — **quantos dias tem
cada valor citado**.

**Agora o pedido leva isso como fato**, não como sermão:

> VALORES CITADOS HÁ MUITO TEMPO NESTA CONVERSA (idade contada até hoje):
> - R$ 390.000 — dito há 393 dias
> - R$ 350.000 — dito há 293 dias
>
> Preço, desconto, promoção e condição de pagamento mudam. Nenhum desses valores pode ser repetido
> como se fosse o de hoje…

E, se mesmo assim o número velho aparecer na sugestão, a rede pega e devolve pra IA reescrever: sem
o número, confirmando o valor atualizado e aproveitando para perguntar como a pessoa pretende
comprar.

O prazo de validade usado é **60 dias**. Valor citado dentro desse prazo é tratado como atual; acima
disso, precisa ser confirmado antes de afirmar.

## 3. A tela avisa quando a sugestão sai com problema conhecido

Nos dois prints havia sugestão com coisa que o app **já sabe** reconhecer (pedido de licença, fecho
de espera, endereço inventado) e, mesmo assim, ela apareceu normal na tela. Da sua parte não havia
como saber se a trava tinha rodado e falhado ou se nem tinha rodado.

Agora, quando alguma das três sai com problema que o app conhece e não conseguiu refazer, a linha
embaixo das sugestões diz, em vermelho:

> · **2 sugestões saíram com problema** (confira antes de enviar)

Mesma ideia da porcentagem da v1304: quando o app não consegue entregar limpo, ele **fala**, em vez
de deixar parecendo normal.

## Conferido

Suíte inteira verde, com guarda nova em `tests/v1305-endereco-inventado-e-aviso-na-tela.test.mjs`
(as três sugestões do print do endereço, o preço de dez meses atrás, e cinco mensagens boas que não
podem ser acusadas). A linha vermelha foi aberta em navegador de verdade, em tela de celular, sobre
o visual publicado.
