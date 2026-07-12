# Atualização #797 — Fim do "Cliente respondeu", Leitura do dia removida e data no selo de Programado

## Mudanças

### 1. Categoria "Cliente respondeu" extinta
- A classificação "Cliente respondeu" foi removida de toda a experiência. Ela apenas indicava que a última mensagem importada era do cliente (muitas vezes só um "ok"/"até"), gerando um número inflado sem valor de decisão.
- Sem esse atalho, cada lead é classificado pela **ação real**: quem precisa de resposta cai em **Fazer agora**; o resto em **Programados** ou **Aguardando cliente**.
- Removida de: Home, Condução (abas e filtros), Central de atenção (sino), Leitura do dia, Ritmo comercial e painel Visão geral (onde o card virou **Aguardando cliente**).

### 2. "Leitura do dia" removida da Home
- O bloco "Leitura do dia" (o resumo com "X responderam, Y pedem ação...") foi retirado da tela principal, por ser desnecessário.

### 3. Selo de compromisso mostra a data
- Na Condução, aba **Programados**, o selo laranja deixa de repetir a palavra "Programado" (já implícita na aba e no título) e passa a mostrar a **data do compromisso** (ex.: "Hoje · 14:00", "Amanhã", "15/07 · 10:00").

## Observações

- A classificação e a ordenação seguem íntegras nas demais visões; nenhum dado foi apagado.
- O registro manual "O cliente respondeu sua última mensagem?" (usado para o aprendizado após copiar uma mensagem) é um recurso separado e foi **mantido**.
- Sem alteração em importação, análise, agenda, propostas, Supabase ou OpenAI.
