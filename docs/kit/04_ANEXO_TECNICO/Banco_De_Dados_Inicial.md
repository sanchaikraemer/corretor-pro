# BANCO DE DADOS INICIAL - REFERENCIA FUNCIONAL

Este arquivo e referencia tecnica. Nao precisa aparecer para o corretor.

## direciona_leads
Campos provaveis:
- id
- nome
- telefone
- empreendimento_interesse
- etapa
- status
- prioridade
- probabilidade_resposta
- probabilidade_comercial
- ultima_interacao
- proximo_contato
- resumo
- observacoes
- criado_em
- atualizado_em

## whatsapp_processamentos
Campos provaveis:
- id
- lead_id
- nome_arquivo
- status
- progresso
- erro
- texto_extraido
- timeline_json
- audios_encontrados
- audios_transcritos
- resultado_analise
- criado_em
- atualizado_em

## cerebro_regras
Campos provaveis:
- id
- titulo
- conteudo
- categoria
- origem
- ativo
- criado_em
- atualizado_em

## vendas
Campos provaveis:
- id
- lead_id
- cliente
- empreendimento
- unidade
- box
- valor
- data_venda
- observacoes
