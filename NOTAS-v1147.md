# v1147 — o prédio da meta passa a respeitar a meta DO CORRETOR

Print do dono: ele mudou a meta pra **20 atendimentos/dia** no Cérebro e a tela "Atendimentos"
continuou dizendo **"meta 10/dia"**, com o prédio já cheio em **"20/10"**. Palavras dele: "o prédio
deve ficar cheio somente quando atender 20, que é pré-definido, não acha?".

## Causa

A meta dessa tela estava **cravada em 10** no código (`const CP788_META_DIA = 10`), enquanto o card
"Fazer agora" já usava a meta do Cérebro (`cpMetaAtendimentosDia`). Duas fontes para a mesma regra —
e a tela mais visível estava na fonte errada.

## O que mudou

- A tela "Atendimentos" (texto do topo, contador do dia e o prédio) usa a **mesma** meta do "Fazer
  agora": a configurada no Cérebro (1 a 50; 10 continua só como último recurso).
- A meta é lida **no momento de desenhar**, não quando o app abre: mudar no Cérebro vale na hora,
  sem precisar recarregar.

## Validação

| Verificação | Resultado |
|---|---|
| Suíte completa | 320 testes verdes |
| Teste novo | `v1147-meta-do-predio-vem-do-cerebro` (a meta não pode voltar a ser cravada; prédio, contador e texto usam a mesma régua; leitura no desenho; mesma função do "Fazer agora") |
| `npm run build` | ok, versão 1147 |

## Arquivos alterados

**Código:** `app.js` · **Documentação:** `NOTAS-v1147.md` (novo) · **Versão:** `package.json`,
`package-lock.json` · **Testes:** `tests/v1147-meta-do-predio-vem-do-cerebro.test.mjs` (novo)
