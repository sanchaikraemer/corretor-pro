# Atualização #803 — Agenda por dia, compromisso não some mais

## Correção principal (bug)

- Compromisso marcado para **hoje** deixava de contar quando **a hora passava** (a conta usava a hora exata). Agora a agenda trabalha **por dia**: marcou para hoje, fica o dia inteiro.
- Compromisso que **venceu e não foi atendido** deixa de sumir no meio de "Fazer agora": continua na **Agenda**, com selo vermelho **"Atrasado · era DD/MM"**. Só sai quando você marca atendimento.

## Ajustes de nome e apresentação

- **"Programados" agora se chama "Agenda"** em toda a interface (era o mesmo conceito que a tela Agenda — não fazia sentido ter dois nomes).
- Na lista de **Fazer agora**, o selo laranja deixou de repetir "Fazer agora" e passou a mostrar **há quantos dias o cliente está parado** (ex.: "há 4 dias").
- Central de atenção separa **"na agenda"** (hoje e próximos) de **"compromissos atrasados"**.

## Compatibilidade

- Sem alteração em dados, importação, propostas, Supabase ou OpenAI.
