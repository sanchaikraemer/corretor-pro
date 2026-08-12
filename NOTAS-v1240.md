# NOTAS v1240 — o código para de mandar no método; o Cérebro manda

Data: 12/08/2026. Duas frases do dono, na sequência:

> "esquece as coisas pequenas como cada palavinha por palavrinha, se atente a analise toda do
> histórico… tudo e sobre isso, TUDO"

> "q eu saiba a única regra era seguir as ordens do cerebro"

A segunda é a que reorganiza o produto.

## O que estava acontecendo

Toda análise mandava **três coisas** pra IA: a conversa do cliente, **um texto fixo escrito no
código** e o Cérebro dele. O texto do código tinha **25.717 letras e 23 proibições** — método
comercial (como qualificar, o que olhar em cada situação), estilo (que palavra não usar) e regras
acumuladas versão após versão, cada vez que alguém consertava uma reclamação.

Nada disso é do código. **Método comercial é a cabeça do corretor**, e cada organização tem a sua.
Estava tudo ali disputando espaço com o que ele escreveu no Cérebro — e vencendo, porque era maior.

## O que mudou

| | Antes | Agora |
|---|---|---|
| Corretor **com** Cérebro | 25.717 letras de regra do código | **17.373** |
| Conta nova (sem Cérebro) | 25.717 | 22.340 (mantém um ponto de partida) |

**1. O método comercial saiu do prompt de quem tem Cérebro.** Ele continua existindo, mas só como
ponto de partida pra conta nova — quem ainda não escreveu o dele. No instante em que escrever, é o
Cérebro que manda. Antes, o método de outra pessoa ia junto mesmo pra quem já tinha o seu.

**2. A lista de estilo/jargão saiu do texto enviado à IA** e virou uma linha só ("escreva como este
corretor escreve, não como uma IA"). A garantia não enfraqueceu — ficou **mais forte**: desde a
v1238 essas frases são **cortadas pelo código** antes de chegar na tela. Pedir pro modelo já tinha
falhado duas vezes (v1212 e v1219 proibiam por escrito e ele passou por cima; o dono flagrou "faz
sentido" e "conforme conversamos" na tela mesmo com a regra publicada).

**3. Seis blocos que diziam a mesma coisa viraram um.** "Não repetir", "já deu permissão",
"pergunta sem resposta", "gancho da retomada", "retomada depois de dias", "pedido sem resposta" —
todos eram variações de "leia a conversa e não ignore o que já foi dito", e existiam porque a IA
não estava lendo. Com a leitura obrigatória da v1239 viraram repetição: **6.045 → 3.821 letras**,
com os exemplos concretos preservados (são os erros reais que a IA já cometeu com ele).

**4. O que FICOU no código, de propósito:** o formato da resposta e o **"não invente"** — nunca
afirmar preço, endereço, cidade, prazo ou condição que não esteja na conversa nem no Cérebro, e
nunca escrever que o corretor fez algo que não fez. Não é método: é o que impede a IA de assinar
uma invenção com o nome dele na frente de um cliente real. Vale mesmo que o Cérebro esqueça de
dizer.

## O texto que saiu não foi jogado fora

Está em `PARA-COLAR-NO-CEREBRO.md`, na raiz do projeto: o método comercial e a lista de estilo,
inteiros, pra ele ler, cortar o que não é a verdade dele, reescrever com as palavras dele e colar
no Cérebro. O que ele não colar simplesmente deixa de existir — que é o ponto.

## Um erro meu no meio do caminho

Ao cortar o bloco de estilo eu **apaguei o bloco do Cérebro inteiro** junto: o corte ia de
"LINGUAGEM DE IA" até o fim do prompt, e depois da reordenação da v1239 o Cérebro estava no meio
desse intervalo. Por alguns minutos o prompt saiu sem o Cérebro, sem o modo prévia e sem a voz
aprendida do corretor. A suíte pegou (foi ela que apontou "a voz do corretor precisa chegar no
prompt"), restaurei e refiz o corte com um trecho fechado e uma trava conferindo que o Cérebro não
está dentro do que vai ser removido. **Nada disso chegou a ser publicado.**

## Validação

- Versão: `7.1240.0` / exibida **1240**.
- `npm test` inteiro verde (405 testes).
- **15 testes atualizados**, um a um, preservando a intenção de cada um — cada um deles guarda um
  erro real que já aconteceu com o dono. Os que mais mudaram: v945 e v1058 (o método virou
  ponto-de-partida, e o teste agora confere que ele NÃO vai mais pra quem tem Cérebro, sem deixar
  de existir), v1212 (a lista de jargão deixou de ser cobrada no prompt e passou a ser cobrada no
  corte do código), v1127/v1225/v1230/v1235 (os seis blocos viraram um; as regras continuam
  trancadas, com os exemplos reais).
- Sem mudança de tela nesta versão — nada de `app.js`, `index.html` ou `styles.css`.
