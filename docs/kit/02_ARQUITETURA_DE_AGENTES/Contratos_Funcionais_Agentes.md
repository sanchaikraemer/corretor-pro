# CONTRATOS FUNCIONAIS DOS AGENTES

Cada agente deve seguir o mesmo contrato:

1. Entrada
2. Processamento
3. Saida
4. Nivel de confianca
5. Proximo destino

Isso evita resposta sem base, modulo solto e informacao confusa.

## Direciona Core
Entrada: acao do usuario, lead atual, status, dados existentes, timeline e analise anterior.
Processamento: decide agentes, organiza sequencia, evita redundancia, valida dados, consolida resultado e decide o que aparece na interface.
Saida: plano de execucao, agentes acionados, analise consolidada, proxima acao e dados para interface.

## Agente ZIP
Entrada: ZIP do WhatsApp, lead relacionado e origem da importacao.
Processamento: valida arquivo, identifica TXT, identifica audios, separa midias ignoradas e cria registro de processamento.
Saida: TXT extraido, lista de audios, metadados, status e erros.
Destino: Transcricao e Timeline.

## Agente Transcricao
Entrada: audios, metadados e referencia temporal.
Processamento: transcreve, limpa ruido, associa ao arquivo original e tenta preservar horario/contexto.
Saida: texto transcrito, status, confianca e data/hora vinculada.
Destino: Timeline.

## Agente Timeline
Entrada: TXT, audios transcritos e metadados.
Processamento: separa mensagens por autor, identifica datas, intercala texto/audio, calcula pausas, ultima interacao e tempo parado.
Saida: timeline cronologica, ultima interacao, dias sem resposta, quantidade de mensagens, quantidade de audios e resumo.
Destino: Perfil, Objecoes, Timing e Memoria.

## Agente Perfil
Entrada: timeline, resumo, dados do lead e produto de interesse.
Processamento: identifica perfil, intencao, motivacao, produto provavel e maturidade.
Saida: perfil provavel, motivacao, produto, maturidade, resumo e confianca.
Destino: Objecoes, Timing, Respostas e Dashboard.

## Agente Objecoes
Entrada: timeline, perfil, mensagens-chave e momentos de sumico.
Processamento: detecta objecoes explicitas e implicitas, cruza perguntas com comportamento e interpreta sumicos.
Saida: objecoes, risco comercial, gatilhos de atencao e sugestao de abordagem.
Destino: Cerebro, Respostas e Dashboard.

## Agente Timing
Entrada: timeline, ultima interacao, padrao de resposta e datas/horarios.
Processamento: calcula tempo parado, tipo de retomada, melhor horario e urgencia.
Saida: dias sem resposta, tipo de retomada, melhor horario, urgencia e prioridade temporal.
Destino: Respostas, Agenda e Dashboard.

## Agente Cerebro
Entrada: perfil, objecoes, timing, regras, metodologia e aprendizados.
Processamento: busca regras, define tom, estrategia, o que evitar e proxima conducao.
Saida: regras aplicadas, tom, estrategia, alertas e metodo sugerido.
Destino: Respostas, Dashboard e Aprendizado.

## Agente Respostas
Entrada: timeline, perfil, objecoes, timing, regras do Cerebro, memoria, similaridade e aprendizados.
Processamento: escolhe estrategia, aplica tom, evita frases proibidas e gera 3 opcoes uteis.
Saida: mensagem direta, mensagem consultiva, mensagem de retomada, objetivo, motivo e regra aplicada.
Destino: Interface, Dashboard e Aprendizado.

## Agente Dashboard
Entrada: analise consolidada, prioridade, agenda, pipeline, respostas, riscos e materiais.
Processamento: seleciona o que importa, reduz ruido e organiza fila.
Saida: lead prioritario, motivo, proxima acao, mensagem, melhor horario, agenda critica e fila rapida.
Destino: Home/Tela Hoje/Interface principal.
