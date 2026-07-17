# v872 — Reanalisar com mensagem clara quando o lead não tem conversa salva

## Contexto

Ao tocar em "Reanalisar" / "Atualizar análise comercial" em certos leads, aparecia o erro
técnico **"Não foi possível atualizar: Lead sem timeline pra reanalisar."**

## Causa (diagnóstico)

O Reanalisar reprocessa a partir da CONVERSA do lead — a `timeline_json` salva no banco. Esses
leads têm uma DATA de última mensagem (`lastInteractionAt`, que a tela mostra em "Última
mensagem — …"), mas **não têm a conversa em si salva** (`timeline_json` vazia). Sem conversa,
o backend (`api/reanalisar-lead.js`) responde "Lead sem timeline pra reanalisar." Acontece com
leads que não vieram de uma importação de ZIP real (criados manualmente, por print, de outra
base) ou cuja timeline não foi persistida.

## Mudança (`app.js`)

O `ui670Reanalisar` passou a **reconhecer esse erro específico** e trocar o texto técnico por
uma orientação clara: *"Este lead não tem a conversa do WhatsApp salva, então não há o que
reanalisar. Importe o ZIP da conversa deste cliente (ou registre uma observação acima) e tente
de novo."* Os demais erros seguem como antes.

## Verificação

- Novo teste `tests/v872-reanalisar-sem-timeline`: garante o mapeamento do erro "sem timeline"
  pra a mensagem clara.
- `npm test`: suíte completa verde.

## Observação

Isto melhora a mensagem, não "cria" conversa onde não há. Se algum lead que VEIO de importação
de ZIP também cair nesse erro, aí é sinal de que a timeline não está sendo persistida na
importação — precisaria de diagnóstico em produção (Supabase) pra confirmar.
