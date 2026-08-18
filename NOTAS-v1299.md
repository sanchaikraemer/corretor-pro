# v1299 — o "me avise" no fim e o "se quiser posso" caem na mesma rede

Print do dono, 18/08/2026 às 17h40, já na versão 1298. Agora as três sugestões **entregam** — o
"Fazer agora" virou *"Enviar de forma clara e objetiva as condições de pagamento"* e a terceira abre
com *"Vou te passar agora as condições de pagamento, nos detalhes"*. O problema ficou no rabicho:

1. *"…Se quiser comentar algum ponto específico ou ajustar algo, **me avise**, certo?"*
2. *"…**se quiser posso** te detalhar as principais condições de pagamento…"*
3. *"…**Me avise** se precisar de algum ajuste ou simulação diferente."*

A regra contra isso está escrita no pedido desde a v1296 e mesmo assim as frases voltaram. **Regra
sozinha não segurou.** O que segura, e já está provado aqui desde a v1295, é a rede: o app percebe e
**a própria IA reescreve** a mensagem.

## O que muda

Duas coisas passam a ser tratadas igual à frase de robô:

- **Fecho que devolve a bola.** Quando a mensagem TERMINA mandando o cliente avisar ("me avise se
  precisar", "qualquer coisa me chama", "fico no aguardo", "estou por aqui", "pode contar comigo"),
  ela volta pra IA, que reescreve terminando na entrega ou na pergunta concreta que a mensagem já
  tinha — sem trocar um fecho de espera por outro.
- **Pedir licença pra entregar.** "Se quiser posso te detalhar" / "se precisar posso mandar" viram
  "te detalho agora" / "te mando agora". Oferecer a informação é o seu trabalho, não um favor que
  precisa de autorização. (Mesma família do "sem compromisso", que você mandou tirar na v1298.)

E a régua também entrou por escrito no pedido, com a troca pronta ao lado, pra IA não precisar
adivinhar o que colocar no lugar.

## O que NÃO cai na rede (importante)

A conferência do fecho olha **só o fim da mensagem**, e só pega a construção aberta — avisar **se /
caso / quando / qualquer coisa**. Continuam passando limpo:

- *"Me avise **qual** formato prefere para a simulação: à vista ou parcelado?"* — pergunta concreta.
- *"Consigo te receber quinta às 18h ou sábado de manhã. Qual fica melhor?"* — dois horários
  continuam liberados (a exceção da v1298).
- *"Me avise se preferir por áudio. Te mando o quadro agora e amanhã te ligo às 9h?"* — o "me avise"
  está no meio; o fim é pergunta concreta.

## O que continua proibido no código

Nada é cortado, emendado ou substituído por frase genérica: quem reescreve é a IA. E a troca só vale
se a reescrita voltar **limpa** — se ela ainda trouxer problema (por exemplo, trocar "me avise" por
"fico no aguardo"), fica valendo o texto original. Análise nenhuma é descartada por causa disso.

## Testes

- Novo `v1299-fecho-e-licenca-caem-na-rede`, montado com as três mensagens exatas do print: as três
  formas reconhecidas, quatro mensagens boas que **não** podem ser acusadas (pergunta concreta,
  dois horários, "me avise" no meio), o caminho completo pela análise com as duas voltando limpas e a
  terceira intocada, e a reescrita ainda suja sendo recusada.
- `v1295` continua verde e passou a valer mais forte: a troca agora exige reescrita limpa, em vez de
  "menos problema que antes".

Suíte inteira verde: 29 arquivos checados + 453 testes.
