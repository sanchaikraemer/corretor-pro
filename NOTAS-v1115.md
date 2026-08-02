# NOTAS v1115 — O aprendizado voltou a ser LIDO, e a IA não inventa mais endereço

## O caso real que revelou o problema

Prints do dono (02/08/2026): a cliente Carmen perguntou o endereço do Personalité e as 3
sugestões responderam que ele fica "em região central de **Venâncio Aires**" — o prédio é em
**Carazinho** (esquina Ernesto Alves × Alexandre da Motta). A IA inventou uma cidade, com o
endereço certo já ensinado pelo corretor em conversas anteriores. Palavras do dono: *"creio
que o sistema não esteja aprendendo com o que já foi dito"*. Ele estava certo — e era pior:
o sistema aprendia, guardava... e nunca consultava.

## As duas causas encontradas

**1. O conhecimento era gravado a cada análise e NUNCA lido.** A rotina
`atualizarConhecimentoCorretor` extrai (pagando uma chamada de IA) os fatos que o corretor
ensina em cada conversa e grava no bloco `corretor-conhecimento`. A função que LIA esse bloco
foi removida na v1092 como "sem chamador" — formalizando um desligamento que já existia. Ou
seja: o custo do aprendizado era pago em toda análise e o benefício nunca chegava ao prompt.

**2. A regra anti-invenção não cobria dados de fato.** O piso comercial do prompt proibia
afirmar condição comercial sem fonte (preço, desconto, prazo, pagamento) — mas não dizia nada
sobre **endereço, cidade, localização, características**. A IA se sentiu autorizada a
"completar" com uma cidade plausível.

## O que foi corrigido

1. **A leitura voltou** (`conhecimentoCorretorTexto`, filtrada por empresa, cache de 60s no
   mesmo padrão da memória comercial): toda análise/geração de sugestões agora recebe o bloco
   "FATOS ENSINADOS PELO CORRETOR" no prompt de sistema (Cérebro continua prevalecendo em
   conflito). Gravação de fato novo e limpeza do Cérebro invalidam o cache na hora.
   **Efeito imediato**: o bloco vinha sendo alimentado esse tempo todo — o conhecimento já
   acumulado passa a valer na PRÓXIMA análise, sem precisar reensinar nada.
2. **Regra anti-invenção estendida a dados de fato**: endereço, rua, bairro, CIDADE, região,
   metragem, unidades, prazo de entrega — só afirmar o que estiver no Cérebro, no bloco de
   fatos ou na própria conversa. Sem fonte, a mensagem se oferece a confirmar/enviar o dado —
   nunca afirma. ("Afirmar a cidade errada destrói a credibilidade do corretor" está no prompt
   com todas as letras.)
3. **A extração do aprendizado passa a capturar endereços explicitamente** (rua, bairro,
   cidade, pontos de referência) — o endereço que o dono mandou pra Carmen hoje entra na
   memória na próxima análise daquela conversa.

## Validação

| Verificação | Resultado |
|---|---|
| Suíte completa | 284 testes verdes (novo: `v1115-conhecimento-lido-e-fatos-nao-inventados`) |
| `npm run build` | ok, versão 1115 |

O teste novo exercita a leitura real com servidor de mentira (filtro por empresa, cache de
60s, invalidação) e fixa os 3 pontos do prompt (carregamento, bloco de fatos, proibição).

## Arquivos alterados

**Código:** `api/_pipeline.js`, `api/lead-update.js`

**Documentação:** `NOTAS-v1115.md` (novo)

**Versão:** `package.json`, `package-lock.json`

**Testes (novo):** `tests/v1115-conhecimento-lido-e-fatos-nao-inventados.test.mjs`
