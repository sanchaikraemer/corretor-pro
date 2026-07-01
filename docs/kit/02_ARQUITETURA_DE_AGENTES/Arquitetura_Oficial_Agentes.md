# ARQUITETURA OFICIAL DE AGENTES - DIRECIONA CORRETOR

A arquitetura oficial do Direciona deve ser granular, coordenada e orientada a acao. Os agentes nao sao modulos soltos; eles trabalham em cadeia, coordenados pelo Direciona Core.

## Lista oficial de agentes

1. Direciona Core / Agente Coordenador
2. Agente ZIP
3. Agente Transcricao
4. Agente Timeline
5. Agente Perfil
6. Agente Objeções
7. Agente Timing
8. Agente Respostas
9. Agente Cerebro
10. Agente Memoria
11. Agente Similaridade
12. Agente Aprendizado
13. Agente Material Inteligente
14. Agente Pipeline
15. Agente Dashboard
16. Agente Agenda
17. Agente Vendas

## Fluxo macro

Corretor -> PWA/Interface -> Direciona Core -> ZIP -> Transcricao -> Timeline -> Perfil/Objecoes/Timing/Memoria -> Cerebro/Similaridade -> Respostas/Material/Agenda/Pipeline -> Dashboard -> Interface -> Acoes -> Aprendizado.

## Regra central

O corretor nao deve ver a complexidade dos agentes. A interface deve mostrar apenas: quem atender, por que atender, quando retomar, qual acao tomar e o que falar.

## Funcoes resumidas

### 1. Direciona Core
Coordena todos os agentes, decide a sequencia, consolida resultados e escolhe o que aparece para o corretor.

### 2. Agente ZIP
Recebe, valida e processa o ZIP exportado do WhatsApp. Identifica TXT, audios e midias ignoradas.

### 3. Agente Transcricao
Transforma audios em texto e associa cada transcricao ao ponto correto da conversa.

### 4. Agente Timeline
Reconstrui a conversa cronologica misturando mensagens e audios transcritos.

### 5. Agente Perfil
Identifica perfil comercial provavel, motivacao, produto de interesse e maturidade de compra.

### 6. Agente Objecoes
Detecta objecoes explicitas e implicitas: preco, entrada, financiamento, localizacao, prazo, decisao com conjuge, falta de urgencia etc.

### 7. Agente Timing
Calcula dias sem resposta, tipo de retomada, melhor horario e urgencia.

### 8. Agente Cerebro
Aplica metodologia comercial, regras, estilo de abordagem e aprendizados do corretor ou empresa.

### 9. Agente Memoria
Armazena informacoes comerciais importantes do lead ao longo do relacionamento.

### 10. Agente Similaridade
Compara o lead atual com casos anteriores e sugere abordagem baseada em padroes parecidos.

### 11. Agente Aprendizado
Aprende com o resultado real das mensagens, visitas, propostas, vendas ou silencio.

### 12. Agente Respostas
Gera exatamente 3 mensagens: Direta, Consultiva e Retomada, aplicando contexto e regras do Cerebro.

### 13. Agente Material Inteligente
Sugere planta, tabela, video, folder, simulacao, material de valorizacao ou convite para visita conforme contexto.

### 14. Agente Agenda
Organiza proximo contato, atrasados, visitas e agenda critica.

### 15. Agente Pipeline
Organiza leads por etapa e mantem a pipeline limpa.

### 16. Agente Dashboard
Mostra o que importa hoje: fila, prioridade, motivo, acao, horario e mensagem.

### 17. Agente Vendas
Registra vendas, remove o lead da pipeline principal e preserva historico.
