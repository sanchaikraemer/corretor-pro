# v827-13 — corrige a qualidade do fallback determinístico da v827-12

## O problema

A v827-12 resolveu a análise ser descartada, mas o fallback determinístico tinha dois
bugs visíveis que apareceram assim que foi pra produção:

1. **Saudação corrompida e duplicada.** A remoção de expressões proibidas do Cérebro
   usava correspondência de substring, sem respeitar fronteira de palavra. Quando "oi"
   estava na lista de proibidas (regra comum: "não use oi, use bom dia/boa tarde/boa
   noite"), a busca por "oi" também casava o "oi" que existe DENTRO de "noite", cortando
   a palavra e deixando "Boa nte!". Como o texto resultante não batia mais com o padrão
   esperado, o código prependia a saudação de novo — resultado: **"Boa noite! Boa nte!
   Vi que ficamos de conversar sobre Renaissance (ap de 3 quartos) sobre construtora...".**
2. **Cláusula sem sentido.** Quando `diagnostico.proximoPasso` vinha vazio, o fallback
   usava `quemDeveAgirAgora` como reserva — um campo que guarda só um nome/papel (ex.:
   "Cliente"), não uma frase. Isso gerava mensagens como **"Ficou combinado Cliente."**

## A correção

- `sanitizarMensagemDeterministica` agora remove proibidas com fronteira de palavra
  (`\b`), nunca como substring solta, e a saudação é adicionada **uma única vez**, por
  último, depois de toda a sanitização — nunca entra no texto que passa pela remoção de
  proibidas.
- O "próximo passo" só é usado na frase "Ficou combinado ___." quando tem 2+ palavras
  (uma cláusula de verdade); um valor solto como "Cliente"/"Você" cai no texto genérico
  em vez de virar frase sem sentido.
- Pequeno ajuste de fluidez: quando o produto identificado já vem com parênteses (ex.:
  "Renaissance (ap de 3 quartos)"), a âncora extra da conversa é anexada com vírgula em
  vez de abrir um segundo parêntese.

## Validação

- Versão interna: `7.127.13`. Versão exibida: `827-13`.
- `tests/v827-12-fallback-mensagens.test.mjs` ganhou os casos de regressão específicos:
  saudação não pode duplicar, "noite" não pode virar "nte" ao remover a proibida "oi", e
  um valor solto em `proximoPasso` não pode virar "Ficou combinado X.".
- Suíte completa (33 conjuntos) e build (`versão=827-13`) sem erro.
