# v1122 — importação voltou a ser rápida (transcrição de 4 em 4 → 10 em 10)

## O que o dono relatou

> "está demorando bastante pra enviar o zip de conversa atualizada, mais de 1 minuto, e antes era
> bem mais rápido, sem falar que selecionei últimos 30 dias apenas"

## A causa — regressão da v1119

Na v1119, pra estancar o vazamento de custo de Whisper, a transcrição dos áudios da importação
passou a rodar com **concorrência limitada a 4**. O problema real que aquilo resolvia era o
`Promise.all` **sem teto nenhum** (todos os áudios de uma vez, pico de memória e de custo). Mas 4
foi conservador demais: uma conversa com muitos áudios virou várias rodadas em fila, e a importação
que era rápida passou de 1 minuto.

## A correção

Concorrência padrão de **4 → 10** (teto do override por ambiente de 8 → 16). Continua protegendo
contra o pico descontrolado — que era o ponto —, sem enfileirar importação normal.
Ajustável por `CORRETOR_PRO_TRANSCRICAO_CONCORRENCIA`.

## Sobre a lentidão GERAL relatada junto (não é isto)

O dono relatou, na mesma mensagem, lentidão pra salvar observação, contadores demorando a atualizar,
"carregamento demorou mais que o normal" repetido, e o "copiar mensagem" só marcando atendimento na
**segunda** tentativa. **Isso não é a concorrência da transcrição** — é o Supabase limitando o
serviço por ter estourado a cota de egress do plano grátis (o painel marca "EXCEEDING USAGE LIMITS",
5.002/5 GB, 100%).

O sintoma bate exatamente: `registrarMensagemEnviada` (app.js) espera até 15s pela gravação do
atendimento e **tenta de novo uma vez** se falhar — quando o banco responde devagar, a 1ª tentativa
estoura o tempo e só a 2ª pega. É por isso que "só marcou atendimento após a segunda vez que cliquei
em copiar". O mesmo vale pra observação lenta e contadores atrasados.

A v1121 (sync de fundo 30s → 2min) reduz o consumo daqui pra frente, mas **não desfaz** o que já foi
gasto no ciclo — o contador zera dia 26. A solução real é subir o Supabase pro plano Pro (~US$
25/mês), que multiplica o limite por 50. Registrado aqui pra não se perder: **enquanto a cota estiver
estourada, qualquer lentidão relatada precisa ser lida à luz disso antes de se procurar bug no app.**

## Teste

Sem teste novo — a mudança é de um número já coberto por `tests/v1119-endurecimento-privacidade-custo.test.mjs`
(que verifica que a transcrição usa o pool de concorrência, e não `Promise.all` sem teto). Suíte
completa verde.
