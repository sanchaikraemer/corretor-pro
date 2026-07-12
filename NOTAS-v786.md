# Atualização 786 — Condução diária

- Substitui a linguagem visual de CRM por quatro ações: Fazer agora, Cliente respondeu, Programados e Aguardando cliente.
- Remove da interface principal Quentes, Esfriando, Reaquecer, Funil e etapas comerciais; mantém as etapas somente internamente para preservar dados e compatibilidade.
- Unifica a classificação usada na Home, Condução, Atendimentos, Desempenho e Central de atenção.
- Garante que todo cliente ativo entre em exatamente uma das quatro visões, sem grupo oculto ou sobreposição.
- Cliente respondeu considera a última mensagem real e o último atendimento, ignorando notas manuais e alterações em `updatedAt`.
- Programados considera somente lembretes e compromissos futuros válidos; compromissos passados não permanecem ativos.
- Uma nova resposta do cliente tem prioridade sobre um agendamento anterior.
- Transforma Atendimentos em uma lista única ordenada pela próxima ação, sem Preparação da carteira, temperatura ou funil.
- Faz indicadores, métricas e atalhos abrirem diretamente o filtro correspondente.
- Migra automaticamente filtros antigos salvos no navegador para evitar telas vazias.
- Substitui a linguagem visível de Geladeira por Arquivados, preservando o valor interno para compatibilidade com os dados existentes.
- Otimiza a classificação e a ordenação para carteiras grandes, evitando recomputações desnecessárias por cliente.
- Validação final: instalação limpa, zero vulnerabilidades, testes de sintaxe, build de 11 arquivos e auditoria de interface com 15 cenários comerciais e 2.000 clientes, sem erros de página ou console.
