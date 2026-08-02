# NOTAS v1111 — Planos recalibrados: Pro 15/dia + 150/mês, Pro Master 30/dia + 300/mês

## O que o dono pediu

Logo depois da v1110 (Pro 25/250, Master 50/500):

> "Eu ainda estou achando demais [...] cinco por dia até sete dias grátis, depois quinze por
> dia com limite por mês, e depois trinta por dia com limite por mês. Mais de trinta por dia
> aí tem que ser um perfil personalizado."

## O que mudou

Só os números dos planos (a mecânica inteira da v1110 continua igual — mensagens leem o teto
em vigor sozinhas):

| Conta | Por dia | Por mês | Ao bater no limite |
|---|---|---|---|
| Teste grátis (7 dias) | 5 | — | Convite pra contratar (WhatsApp) |
| **Pro** | 15 *(era 25)* | 150 *(era 250)* | Convite pro Pro Master ("o dobro") |
| **Pro Master** | 30 *(era 50)* | 300 *(era 500)* | Convite pra **plano personalizado** |
| Conta original (dono) | 200 (fusível) | — | Aviso neutro |

Régua usada: o uso real do próprio dono — usuário pesado, 200+ clientes na carteira — é de
70–80 análises por MÊS (~3/dia útil). 15/dia é 5x isso; 150/mês é quase o dobro do mês
inteiro dele. "Mais de 30/dia = personalizado" já estava pronto desde a v1110: o convite do
Pro Master leva direto pro WhatsApp comercial negociar caso a caso.

Todos os números seguem ajustáveis sem publicar nada:
`CORRETOR_PRO_LIMITE_{DIA,MES}_{PRO,PROMASTER}` na Vercel.

## Validação

| Verificação | Resultado |
|---|---|
| Suíte completa | 283 testes verdes (cenários do teste v1110 recalibrados: 15ª entra/16ª bloqueia etc.) |
| `npm run build` | ok, versão 1111 |

Sem mudança visual — os textos mostram o número do teto em vigor sozinhos (verificado na v1108/v1110).

## Arquivos alterados

**Código:** `api/_pipeline.js`

**Documentação:** `ESTADO-ATUAL.md`, `NOTAS-v1111.md` (novo)

**Versão:** `package.json`, `package-lock.json`

**Testes (atualizado):** `tests/v1110-planos-pro-e-pro-master.test.mjs`
