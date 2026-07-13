# Atualização #809 — Confiabilidade, aprendizado e importação na primeira tentativa

## Importação do WhatsApp / Share Target

- Corrige a perda do ZIP na primeira exportação quando o Corretor Pro estava fechado ou iniciando.
- Cada compartilhamento recebe um ID próprio e fica salvo como pendente no IndexedDB, com fallback no Cache Storage.
- O aplicativo trata o compartilhamento antes de montar a Home e bloqueia recargas automáticas enquanto houver um ZIP pendente.
- O ZIP não é mais apagado antes da leitura: permanece recuperável até o lead ser salvo, atualizado ou a análise ser descartada explicitamente.
- Se a internet cair, a análise falhar ou o app fechar, a importação permanece guardada e pode ser retomada.
- Evita abrir um ZIP antigo enquanto o novo compartilhamento ainda está terminando de ser salvo.

## Aprendizado contínuo real

- Salvar uma observação não reanalisa o lead e não troca as três sugestões atuais.
- A observação aparece imediatamente na linha do tempo e entra automaticamente na fila de aprendizado.
- O sistema aprende com mensagens reais, observações, visitas, ligações, propostas registradas e respostas posteriores do cliente.
- Sugestões produzidas pela própria IA continuam bloqueadas como fonte de aprendizado.
- Na memória manual, somente os campos realmente modificados pelo corretor são marcados como ensinamento; clicar em salvar sem alterar nada não cria aprendizado artificial.
- O botão de leitura completa da carteira foi renomeado para “Reprocessamento manual da carteira”, pois o funcionamento normal é automático.

## Atendimento e coerência de datas

- “Última mensagem” usa a última mensagem real do WhatsApp; observações e horário de reanálise não substituem essa data.
- “Último atendimento” aparece separadamente com a data e a hora corretas.
- Ao marcar atendimento, data, hora, status e caches da tela são atualizados imediatamente.
- Uma resposta defasada do banco não desfaz a atualização que já apareceu na tela.
- Nova marcação no mesmo dia atualiza o horário do atendimento mais recente.
- O atendimento não é mais duplicado nas observações.
- Copiar uma sugestão ou abrir o WhatsApp não marca o lead como atendido e não cria mensagem falsa no histórico.

## Limpeza da interface e dos dados

- Removidos da geração, persistência e interface os percentuais de probabilidade, score e confiança comercial.
- Mantida somente a ordenação interna baseada em fatos reais, sem exibir pontuação.
- Removidos os blocos repetidos “Leitura do dia / O que merece sua atenção”.
- Removido o bloco redundante “Próxima ação recomendada” quando a mesma orientação já está no card principal.

## Validação

- Versão interna: `7.109.0`.
- Versão exibida: `809`.
- Testes de sintaxe de todos os arquivos JavaScript concluídos.
- Testes automatizados de retomada, Home, aprendizado contínuo, Share Target em cold start, observações, atendimento e limpeza de score concluídos.
- Build limpo concluído e auditoria de dependências sem vulnerabilidades conhecidas.

Não há criação de tabela, coluna ou função nova no Supabase nesta atualização.
