# NOTAS v1109 — Teste grátis: 5 análises por dia

## O que o dono pediu

Logo depois da v1108 (teto de 10 + convite de contratação no WhatsApp):

> "to achando 10 análises ate demais por dia e de graça, o que voce acha de 5?"

## O que mudou

Só o padrão do teto do teste grátis: **10 → 5 análises por dia**
(`LIMITE_ANALISES_IA_DIA_TESTE_PADRAO`, em `api/_pipeline.js`). Todo o resto da v1108 continua
igual — a mensagem de limite mostra o número certo sozinha (ela lê o teto em vigor, não tem
número cravado) e o botão do WhatsApp comercial segue aparecendo só pra conta em teste.

Racional comercial: em 7 dias de teste ainda dá até 35 análises de graça — suficiente pra
sentir o valor — e quem esbarra no teto é exatamente o lead quente que vale a conversa no
WhatsApp. Se aparecer desistência demais no teste, dá pra voltar pra 10 **sem publicar nada**:
basta cadastrar `CORRETOR_PRO_LIMITE_ANALISES_DIA_TESTE=10` na Vercel (a variável manda sobre
o padrão do código).

## Validação

| Verificação | Resultado |
|---|---|
| Suíte completa | 282 testes verdes (teste da v1108 atualizado pro novo padrão) |
| `npm run build` | ok, versão 1109 |

Sem mudança visual além do número dentro do texto já verificado na v1108.

## Arquivos alterados

**Código:** `api/_pipeline.js`

**Documentação:** `ESTADO-ATUAL.md`, `NOTAS-v1109.md` (novo)

**Versão:** `package.json`, `package-lock.json`

**Testes (atualizado):** `tests/v1108-limite-teste-10-e-convite-whatsapp.test.mjs`
