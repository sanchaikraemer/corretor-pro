# NOTAS v1105 — Auditoria do backup real: a coluna de etapa estava suja em 244 registros

## De onde veio

O dono baixou o backup completo (botão devolvido na v1104) e mandou o arquivo. Foram lidos os
**298 registros** reais — 249 ativos e 49 arquivados.

## O que a auditoria encontrou

**1. A coluna que diz se o cliente é Ativo ou Arquivado estava suja em 244 dos 298.** Em vez de
"Ativo"/"Geladeira", havia **texto de análise da IA** gravado ("Acompanhamento do andamento no
cartório...", "Aguardar retorno do cliente..."). Herança de versões antigas, perpetuada porque a
reimportação copiava a etapa anterior como estivesse.

Na tela isso não aparecia (a leitura convertia tudo pra Ativo), mas era uma bomba armada: se um
texto futuro contivesse "fechado" ou "desistiu" no meio da frase — coisa comum numa análise —
o cliente seria **arquivado sem ninguém mandar**.

**2. O caso Jamil, comprovado com os dados reais:** 135 mensagens, você respondendo até 26/06 —
e **zero** atendimento marcado no app. A correção da v1103 já estava valendo em produção (o
cálculo novo já estava gravado nos 298 registros).

**3. Os números do atendimento:** 160 registros têm atendimento marcado no app; 276 têm mensagem
sua na conversa; e **20 ativos nunca receberam nenhum contato seu** — esses são os "NUNCA"
verdadeiros (Gelson, Manu, Marli, Lair, Bruna, Estevan, Giulia, Isabela, Romeu, Nelson, Gilmara,
entre outros).

**4. A migração opcional do banco continua não aplicada** (nenhum registro tem as colunas de
busca rápida). O app convive com isso — só segue mais lento na importação.

## O que foi corrigido

- **Texto nunca mais arquiva.** Só etiqueta curta legada ("Vendido", "Perdido") vira Arquivado —
  regra aplicada na leitura (tela) e na gravação (servidor).
- **A reimportação para de perpetuar a sujeira**: preserva a etapa anterior **normalizada**
  (arquivado continua arquivado; texto vira Ativo limpo).
- **Autolimpeza**: a mesma regravação de cache que já roda a cada carga da lista aproveita a
  viagem e corrige a etapa suja no banco — os 244 registros se limpam sozinhos com o uso,
  sem migração manual.

## Validação

| Verificação | Resultado |
|---|---|
| Suíte completa | 279 testes verdes |
| `npm run build` | 27 arquivos, versão 1105 |
| Navegador de verdade | app abre limpo na 1105 |

O teste novo usa os textos REAIS do backup do dono (inclusive o caso de risco: "Cliente desistiu
do Renaissance, focar no Personalité" precisa continuar Ativo) e prova a autolimpeza acontecendo.

## Arquivos alterados

**Código:** `api/_persistence.js`, `app.js`

**Versão:** `package.json`, `package-lock.json`

**Documentação:** `NOTAS-v1105.md` (novo)

**Testes (novo):** `tests/v1105-etapa-nunca-arquiva-por-texto.test.mjs`

**Testes (atualizado):** `tests/v1082-arquivado-nao-volta-e-memoria-sobrevive.test.mjs`
