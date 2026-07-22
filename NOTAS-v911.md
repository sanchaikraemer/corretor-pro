# v911 — limpeza no lead + reforma de "Oportunidades esquecidas"

Seis remoções/ajustes pedidos pelo dono. Tudo tirado **do código** (funções órfãs incluídas).

## 1. Chip do "papel do contato" (embaixo do nome do lead) — removido
Aquela etiqueta que mostrava "Comprador direto" / "Intermedeia compradores…" saiu. O nome do lead
fica limpo. (Era o resto do "Contato principal da oportunidade" que já tínhamos começado a tirar.)

## 2. Ícone "Excluir" saiu do topo do lead
O Excluir não fica mais na barra de ícones. Continua acessível **dentro do Editar** (Zona perigosa ·
"Excluir este lead") — nada se perde. Sobrou só uma linha mais limpa de ações no topo.

## 3. Card "Como usar" — removido do Menu
Não explicava nada de útil e ainda levava a uma tela com o Raio-X. Fora.

## 4. "Raio-X da carteira" — removido de vez
Ele lia "gargalos por etapa", "recebeu proposta" e "teve visita" — dados que o app **não sabe de
verdade** (etapa você mandou tirar; proposta/visita a IA não crava). Apagados: `insightFocoHTML`,
`temVisitaLead`, `leadsRaioX`, `abrirRaioX` e o `leadTemProposta` que só eles usavam.

## 5. "Últimos atendimentos" — saiu da home
Redundante com o "Atendimentos" da barra de baixo. Botão e função órfã (`abrirUltimosAtendimentos`)
removidos.

## 6. "Oportunidades esquecidas" — reformada por FATO real
Antes ordenava por um "peso" que dependia de etapa/proposta/visita (o mesmo problema do Raio-X).
Agora:
- **Entra** quem VOCÊ já atendeu (dinheiro investido) **ou** teve conversa real (5+ msgs do cliente),
  e está **parado 7+ dias** (e não está nos 10 de "Fazer agora").
- **Ordena pelos mais antigos** (mais tempo parado primeiro), **no máximo 10**.
- Os rótulos "negociação aberta / visita/proposta em jogo" e o "Alta/Média" saíram — no lugar, o
  fato: **"você já atendeu · parado Nd"** ou **"N msgs do cliente · parado Nd"**.

## Verificação
- `tests/v911-limpeza-lead-e-esquecidas.test.mjs` (novo) cobre os 6.
- Ajustados os testes que fixavam o que foi removido: v866-ui-limpeza, v883, v902, v905, v908.
- Suíte inteira verde; `node --check` e build OK.

## Arquivos
- `app.js`, `index.html`, `tests/v911-...` (novo) + 5 testes ajustados, `NOTAS-v911.md`,
  versão **910 → 911**.
