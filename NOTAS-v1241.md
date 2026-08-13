# NOTAS v1241 — a auditoria do dono, item por item

Data: 13/08/2026. O dono mandou auditar tudo o que eu publiquei ontem (v1235–v1240). **A auditoria
dele foi melhor que a minha**: achou defeitos que eu não achei e desmontou promessas que eu tinha
escrito nas notas como se fossem fato. As correções abaixo seguem a ordem de prioridade que ele
definiu.

## 1. Histórico integral — a conversa ia cortada, calada

Ele: *"o sistema diz 'analise toda a conversa e siga o Cérebro', mas o código ainda pode esconder
parte da conversa"*.

Existiam **dois esconderijos**:

- **Modo incremental** (v1222): a partir de 15.000 caracteres, com análise anterior salva, a
  conversa antiga **não era reenviada** — ia um resumo dela + o fim + as mensagens novas.
- **Teto técnico de 30.000 caracteres**: passou disso, a parte antiga era descartada.

O modo incremental era uma decisão de **custo** que eu tomei no lugar dele e que passou a valer
mais que a leitura completa que o produto promete na tela.

Agora: **o modo incremental fica desligado** (o limiar virou infinito) e **o teto subiu de 30.000
para 120.000 caracteres** — o suficiente pra uma conversa de anos. Nada foi apagado: religa por
variável de ambiente se o custo apertar, sem publicar nada.

Medido: conversa de 300 mensagens, **300 chegam** na IA — inclusive na reimportação, que era o
caso onde o passado sumia.

**Custo:** análises de clientes antigos passam a ler mais texto, então ficam um pouco mais caras.
Foi a escolha dele, e está registrada aqui.

## 2. O Cérebro como única autoridade comercial

Ele: *"ficou bastante método comercial cravado em outro trecho do prompt... o Cérebro ganha em caso
de conflito explícito, mas onde ele não disser nada, esse método paralelo continua decidindo"*.

Verdade — a v1240 tinha tirado um bloco grande e deixado outro. Saíram agora do pedido de quem tem
Cérebro: os ângulos comerciais das três mensagens, "as três não podem ser três pedidos de licença",
"cliente já disse sim", "pergunta do corretor sem resposta", "pedido sem resposta direta" e a
"retomada depois de dias — regra dura".

Tudo continua existindo **como ponto de partida de quem ainda não escreveu o Cérebro**.

| | v1239 | v1240 | **v1241** |
|---|---|---|---|
| Corretor com Cérebro | 25.717 letras | 17.373 | **11.873** |
| Conta nova | 25.717 | 22.340 | 23.005 |

Ficou pra todo mundo só o que **protege o corretor** (não inventar preço, endereço, cidade, prazo,
condição; não escrever que ele fez algo que não fez) e o que a **tela** precisa (o formato e "as
três são três caminhos pro mesmo passo").

## 3. O Cérebro fecha o prompt de verdade

Ele: *"depois do === FIM DO CÉREBRO === o sistema ainda pode inserir aprendizado, casos, mensagens
reais e fatos... a descrição da v1239 é tecnicamente falsa"*.

Era falsa mesmo. Agora o aprendizado, os casos, a voz real e os fatos vêm **antes**, e o Cérebro é
o último bloco do prompt de sistema. O teste confere que nenhum bloco novo abre depois dele.

## 4. A prova de "quanto foi lido" estava mentindo

Ele: *"a tela pode dizer que a IA leu a conversa inteira quando não leu... é um bug objetivo da
prova que foi criada justamente para você conferir"*.

Confirmado rodando: **300 mensagens na conversa, 177 chegaram na IA, e a tela ia dizer "leu a
conversa inteira (300 mensagens)"**. O corte por tamanho acontecia separado do modo incremental e
ninguém contava.

Agora, quando encosta no teto, o registro vira **"parte da conversa"** e diz quantas de quantas
foram.

## 5. O furo das frases proibidas

Ele: *"se tudo for eliminado, ela devolve o texto original... uma mensagem composta exclusivamente
por algo proibido pode sobreviver justamente porque foi totalmente proibida"*.

Certíssimo, e pior: **havia um teste MEU exigindo esse furo**. Reproduzido — a sugestão chegou na
tela com **três** frases proibidas, ainda marcada como "limpa pelo código", porque a escolha era só
por quantidade de palavras e o clichê inteiro tinha mais palavras que a reescrita limpa.

Consertado: a escolha agora é **1º sem nenhuma frase proibida, 2º a mais inteira**. Junto vieram
quatro furos menores achados na mesma auditoria:

- **"a disposição dos lotes"** (o arranjo do imóvel) era confundido com "fico à disposição" e a
  frase legítima do corretor era cortada fora;
- **"Tranquilo por aqui."** com ponto final era acusado e não era cortado (só a versão com vírgula
  funcionava) — e o conserto não pode levar junto o "Tudo bem?", que é cumprimento legítimo;
- **clichê com espaço duplo** era acusado e escapava do corte;
- **"quis saber se"** ficou órfã na v1240: saiu do prompt e nenhum código pegava.

## 6. O Cérebro cortado sem aviso

Ele: *"alguém pode colar 25.000 caracteres, ver isso na tela, e o banco ficar apenas com os
primeiros 20.000, sem um aviso claro"*.

Agora, ao salvar, se algum campo não couber, aparece uma pergunta dizendo **qual campo, quanto tem,
quanto cabe e quanto se perde** — com a opção de voltar e encurtar. O corte deixou de ser silencioso.

## 7. Documentação que mandava o contrário do código

Ele: *"documentação e código estão mandando fazer coisas opostas... para um agente de código, isso
é perigoso"*.

- `CLAUDE.md` mandava usar o fallback `construirMensagensDeterministicasCerebro`, que **não existe
  mais** e cujos testes hoje exigem que não volte.
- `ESTADO-ATUAL.md` dizia que reimportação sem novidade reaproveita a análise sem chamar a IA —
  revogado na **v1221**.

Os dois foram corrigidos, com a data e o motivo, pra próxima sessão não reintroduzir o erro.

## O que ficou de fora, e por quê

A auditoria automática que eu rodei em paralelo levantou 37 suspeitas, mas **22 dos 30 revisores
morreram por limite de sessão** — justamente os que iam atacar cada achado. Confirmei à mão as que
estão acima. Uma delas era **falsa**: a v1240 estava sim publicada na `main`. As demais suspeitas
(observação com várias linhas que sobrevive no texto corrido da memória; `recomendacaoContato` fora
da lista da carteira; cache do detalhe em voo ressuscitando observação apagada) **não foram
verificadas e ficam para a próxima rodada** — não vou dá-las como resolvidas sem prova.

## Validação

- Versão: `7.1241.0` / exibida **1241**.
- Novo teste `tests/v1241-auditoria-do-dono.test.mjs`: tranca os sete itens, na ordem dele, cada
  bloco citando o defeito exato — e vários rodam a análise de verdade em vez de procurar texto.
- 7 testes atualizados (v1058, v1127, v1206, v1222, v1225, v1238, v1240-relacionados), preservando
  a intenção de cada. O mais importante: o assert da v1238 que **exigia o furo** foi invertido.
- `npm test` inteiro verde (406 testes).
