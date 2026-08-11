# v1221 — importou, analisa. Sem exceção.

Dono, 11/08/2026: *"Mas a regra é sempre que fizer uma importação, tem que fazer a reanálise. Não
existe essa regra já?"*

**Existia pela metade.** E a metade que faltava é a causa de tudo o que ele viu hoje à noite.

## As duas regras que se atropelavam

| Quando | O que ele pediu | O que virou código |
|---|---|---|
| 05/08 (v1141) | *"vou perder MUITO DINHEIRO com retrabalho que já está salvo"* | Reimportação **sem nenhuma mensagem nova** deixou de chamar a IA: reaproveitava a análise salva. |
| 07/08 (v1177) | *"quando eu exporto uma conversa tem que fazer análise e ponto final"* | A exceção foi **estreitada** (só reaproveita se a tela ainda aceitar aquela análise), mas continuou existindo. |

Foi essa exceção que produziu o print das 18h33: ele reimportou o mesmo cliente, a conversa não
tinha uma mensagem nova, o sistema devolveu a análise de 40 minutos antes — escrita sob as regras
antigas, com as "opções novas" que ele nunca ofereceu — e ainda carimbou "Última análise, 18:33"
(isso já foi corrigido na v1220).

## O que muda agora

**A exceção acabou. Importou, a IA analisa** — com mensagem nova ou sem nenhuma.

O dinheiro que ele defendeu na v1141 continua defendido no lugar onde ele realmente pesa: **áudio
já transcrito deste cliente não é transcrito de novo**. Essa era a economia nº 2 daquela versão,
independente desta, e não foi tocada — numa conversa com muito áudio, é ela que responde pela maior
parte do custo. O que volta a acontecer por importação é uma análise de texto.

### Rede de segurança (não estava no pedido, mas sem ela a regra faria estrago)

Se a análise nova **não der certo** — IA fora do ar, teto de análises do dia atingido, retorno sem
as três mensagens —, a análise anterior é **mantida** em vez de o cadastro ficar vazio. Ela volta
carimbada como o que é (mantida, não recém-feita), então a data de "Última análise" não muda e a
tela diz na hora: *"não consegui analisar agora — mantive a análise anterior"*.

Sem isso, um dia de cota estourada transformaria "reimportar um cliente" em "perder a análise que
ele já tinha" — o oposto do que a regra quer.

### Textos da tela

Os avisos que prometiam a economia antiga saíram, porque deixaram de ser verdade:

- durante a análise: *"comparando com a conversa já salva — só a novidade paga análise"* →
  **"juntando com a conversa já salva e analisando tudo de novo"**;
- ao salvar: *"nada novo: análise salva mantida, nada pago"* → **"não consegui analisar agora —
  mantive a análise anterior"** (só aparece quando a rede de segurança agiu);
- no quadro do resultado: *"Nada novo nesta conversa: … nada a pagar por retrabalho"* → **"A
  conversa foi analisada de novo, do zero — toda importação analisa"**.

## Arquivos alterados

- `api/_pipeline.js` — o atalho saiu; `analiseUtilizavel` (a mesma régua da tela) + `manterAnaliseSalva`
  (a rede de segurança); `incrementalMeta.analiseNovaTentada` registra que a IA foi chamada.
  A marca `REGRAS_MENSAGENS_VERSAO`, criada na v1220 só pra decidir quando o atalho valia, foi
  removida junto com ele.
- `js/importacao.js` — os três textos acima.
- `tests/v1221-importou-analisa-sempre.test.mjs` — guarda nova, executando a reimportação de
  verdade: sempre chama a IA; mantém a salva quando a nova não presta; não mantém quando a salva
  também não presta; a tela não promete mais economia.
- `tests/v1141-...`, `tests/v1162-...`, `tests/v1177-...` — atualizados para a regra nova (as
  economias de áudio e a chave do nome do arquivo, que continuam valendo, seguem guardadas).
- `tests/v1220-regra-nova-nao-reaproveita-analise-velha.test.mjs` — removido junto com o que ele
  protegia.
- `package.json` / `package-lock.json` — versão 1221.

Sem mudança de tela nesta versão além dos textos citados (conferidos no código publicado).
