# v1282 — cliente salvo como "Corretor" ou "Imobiliária" deixa de virar o lado da empresa

## O que o dono via

Um contato salvo no celular como **"Anderson Corretor"**, **"Imobiliária Central"**, **"Construtora
Boa Vista"** ou **"Plantão Centro"** entrava na carteira como **"Cliente não identificado"** — e a
análise daquela conversa saía errada, sem nenhum erro na tela.

É justamente o **corretor parceiro**, que o sistema atende de propósito (tem regra própria no
prompt: "o lead de verdade é o cliente DELE").

## O que estava acontecendo por dentro

Achado da auditoria de 16/08/2026 (`AUDITORIA-v1281.md`), reproduzido **rodando as funções de
verdade**, com o mesmo texto de conversa e só o nome do contato mudando:

```
contato salvo como "Anderson Ruviaro"    → cliente "Anderson Ruviaro",         2 tentativas  ✔
contato salvo como "Anderson Corretor"   → cliente "Cliente não identificado", 3 tentativas  ✘
contato salvo como "Imobiliária Central" → cliente "Cliente não identificado", 3 tentativas  ✘
```

O caminho, do começo ao fim:

1. `ehLadoDaEmpresa` trata como lado da empresa qualquer autor com
   `construtora | imobiliária | corretor | corretora | atendimento | plantão | incorporadora` no
   nome. A lista existe por um bom motivo: reconhecer o rótulo do **próprio** corretor.
2. `pickClientName` aplicava essa lista **antes de olhar a prova**. Eliminado o único outro
   participante, sobravam zero candidatos e o cadastro nascia "Cliente não identificado".
3. Sem `clientName`, `_ladoDaMensagem` perde a primeira regra dela ("autor que contém o primeiro
   nome do contato é o cliente") e cai na seguinte: nome com essas palavras = **corretor**.
4. A partir daí as falas do contato entravam em **dois blocos que vão direto pro pedido da IA**:
   - **`TENTATIVAS DO CORRETOR AINDA SEM RESPOSTA`** (v1277) — o pedido do cliente virava "oferta
     que ele mesmo já ignorou", com a instrução *"NENHUMA das três pode ser isto de novo com outras
     palavras"*. Ou seja: a IA ficava **proibida de tratar exatamente o que o cliente pediu**. E a
     contagem inflada dispara a regra de duas tentativas (obriga uma das três a propor encontro
     pessoal com dois dias marcados).
   - **`COMO ESTE CORRETOR ESCREVE`** (v1212) — o jeito de escrever do **cliente** virava a régua
     da voz do corretor, com a instrução de copiar aquele registro.

Nada disso aparecia como erro. Passava nos 437 testes da suíte.

## O que mudou

**Prova vence palpite.** A exportação do WhatsApp nomeia o arquivo com o **contato** da conversa,
nunca com o dono do aparelho ("Conversa do WhatsApp com Fulano.txt"). Se um autor bate com esse
nome, ele é o contato — e isso agora é verificado **antes** da lista de palavras de função.

- `pickClientName` (`api/_pipeline.js`) passou a procurar o contato do arquivo **entre todos os
  autores**, e não só entre os que sobraram do filtro. A ordem anterior fazia o filtro apagar a
  resposta antes de a pergunta ser feita.
- Guarda nova: esse atalho só vale se o autor **não for o próprio corretor**. Para isso a parte de
  `ehLadoDaEmpresa` que reconhece o dono da conta (rótulo do sistema + nome configurado no Cérebro,
  sem a lista de palavras) foi extraída em `ehOProprioCorretor` — **sem mudar o que
  `ehLadoDaEmpresa` faz**, ela continua idêntica e continua sendo usada em todo o resto.
- Nada mais foi tocado: a lista de palavras continua valendo, `_ladoDaMensagem` não mudou (ela se
  conserta sozinha assim que o nome do cliente está certo), e a regra da **v1180** — sem prova e com
  dois ou mais candidatos, o app **não escolhe** — continua de pé.

Depois da correção, os três casos entregam o nome certo e as **2** tentativas certas, sem a fala do
cliente na lista.

## Leads antigos

Reimportar a conversa conserta o cadastro: `guessLeadData` recalcula o nome a partir do arquivo em
toda análise. Não é preciso mexer em nada à mão.

## Guarda

`tests/v1282-contato-com-corretor-no-nome.test.mjs` — roda as funções de verdade com 5 nomes de
contato, confere nome do cliente e contagem de tentativas, e ainda testa as duas fronteiras: o
rótulo do próprio corretor nunca vira cliente (mesmo com o nome do arquivo apontando pra ele), e
sem prova com 2+ candidatos o app segue devolvendo "Cliente não identificado".

Suíte completa: **23 arquivos checados + 438 testes, todos verdes.**

## O que fica de fora desta versão (registrado de propósito)

`nomeClienteConfirmadoPelaConversa` (a conferência do nome que a **IA** apontou) continua usando
`ehLadoDaEmpresa` inteira, então um "Anderson Corretor" apontado pela IA ainda é recusado ali. Hoje
isso é inofensivo — o nome já vem certo da importação, e a função só serve para **corrigir**, então
recusar significa "não mexer". Fica anotado como a próxima parada dessa família, não como pendência
urgente.
