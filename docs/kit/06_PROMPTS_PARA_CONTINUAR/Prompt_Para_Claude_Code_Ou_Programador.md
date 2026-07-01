# PROMPT PARA CLAUDE CODE OU PROGRAMADOR

Objetivo: construir ou continuar o Direciona Corretor.

O Direciona Corretor e um copiloto comercial para corretores de imoveis focado em atendimento via WhatsApp. Nao deve ser um CRM tradicional. Deve transformar conversas reais em acao comercial pratica.

Resultado esperado para o corretor:
- Quem atender agora.
- Por que esse lead merece atencao.
- Qual e o contexto real.
- Quando retomar.
- Qual acao tomar.
- Qual mensagem enviar.

Fluxo obrigatorio:
1. Receber ZIP exportado do WhatsApp.
2. Extrair TXT da conversa.
3. Identificar audios.
4. Transcrever audios.
5. Inserir transcricoes na timeline na ordem cronologica correta.
6. Analisar conversa inteira.
7. Identificar perfil, objecoes, timing e prioridade.
8. Gerar proxima acao.
9. Gerar exatamente 3 mensagens: Direta, Consultiva e Retomada.
10. Criar/atualizar lead real.
11. Salvar historico.
12. Mostrar na home/fila quem atender e o que fazer.

Arquitetura funcional:
- Direciona Core coordena tudo.
- ZIP recebe e valida arquivo.
- Transcricao converte audio em texto.
- Timeline monta a conversa completa.
- Perfil entende o cliente.
- Objecoes detecta travas explicitas e implicitas.
- Timing calcula retomada e melhor horario.
- Cerebro aplica metodologia comercial.
- Memoria guarda preferencias e historico do lead.
- Similaridade compara casos parecidos.
- Aprendizado mede resultado das abordagens.
- Respostas gera mensagens.
- Material Inteligente sugere planta, tabela, video ou folder.
- Agenda organiza retornos.
- Pipeline organiza etapas.
- Dashboard mostra a acao do dia.
- Vendas registra conversoes.

Regras de interface:
- Mobile-first.
- Base preto/grafite.
- Neon como acento, nao fundo dominante.
- Home limpa.
- Nao mostrar logs, JSON ou erro tecnico cru.
- Processamento deve ter etapas e progresso.
- Se a informacao nao ajuda o corretor a agir agora, nao deve aparecer na home.

MVP minimo:
ZIP, TXT, audio, transcricao, timeline, analise, 3 mensagens, lead salvo, pipeline basico, agenda basica, dashboard diario, Android/iOS/Desktop.

Nao avance para login, planos pagos ou sofisticacao antes do nucleo funcionar de ponta a ponta.
