# ESTADOS DE PROCESSAMENTO E TRATAMENTO DE ERROS

## Nunca mostrar apenas "processando"
O sistema deve mostrar etapas claras:

1. Recebendo arquivo.
2. Validando ZIP.
3. Lendo conversa.
4. Separando audios.
5. Transcrevendo audios.
6. Montando linha do tempo.
7. Analisando atendimento.
8. Gerando mensagens.
9. Finalizado.

Cada etapa deve ter:
- percentual ou barra de progresso;
- mensagem simples;
- status visivel;
- opcao de tentar novamente em caso de erro;
- detalhes tecnicos escondidos.

## Erro ruim
Failed to fetch

## Erro correto
Nao foi possivel conectar ao servidor agora. Verifique sua internet e tente novamente.

## Acoes em caso de erro
- Tentar novamente.
- Ver detalhes tecnicos.
- Reimportar conversa.
- Voltar para atendimento.

Regra:
Erro tecnico cru nao deve aparecer na tela principal do corretor.
