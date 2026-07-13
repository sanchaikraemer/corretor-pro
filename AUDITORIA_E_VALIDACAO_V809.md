# Auditoria e validação — Corretor Pro v809

## Escopo revisado

A versão recebida (`corretor-pro-main (26)`) foi descompactada e usada como única base. A revisão foi feita em duas passagens:

1. rastreamento dos fluxos de importação, atendimento, observações, aprendizado, geração de sugestões e renderização;
2. revisão cruzada do código alterado, persistência, service worker, inicialização da PWA, caches, datas e testes de regressão.

## Problemas confirmados na versão recebida

### 1. Primeira exportação do WhatsApp era descartada cedo demais

O aplicativo lia o registro `latest`, apagava o ZIP do IndexedDB/Cache e chamava o processamento sem aguardá-lo. Em um cold start, a Home, a atualização do service worker e a leitura do compartilhamento competiam entre si. Se a tela recarregasse ou o arquivo ainda não estivesse visível na transação, o primeiro envio era perdido. Na segunda tentativa, o app e o service worker já estavam ativos, por isso funcionava.

### 2. Observação manual acionava um fluxo incorreto

O registro de observação usava a rota de reanálise. Isso podia trocar as sugestões sem solicitação do corretor e misturava duas ações diferentes: salvar um fato e gerar uma nova análise.

### 3. Aprendizado manual podia incorporar campos que o corretor não alterou

O formulário enviava todos os campos e o backend os marcava como manuais, mesmo quando apenas um havia sido editado. Isso poderia transformar inferências antigas em ensinamentos supostamente confirmados.

### 4. Atendimento podia parecer não atualizado

A tela fazia uma atualização local, mas uma leitura defasada do banco podia sobrescrevê-la. A data da análise também podia aparecer como se fosse a data da última mensagem. Além disso, copiar uma sugestão ainda acionava um hotfix antigo que registrava contato manual.

### 5. Restavam estruturas de score/confiança

A interface já escondia parte dos números, mas o pipeline ainda devolvia campos de confiança e existiam funções aposentadas de probabilidade. Isso não atendia à exigência de remover o mecanismo comercial numérico do sistema.

## Correções aplicadas

### Share Target confiável

- ID único por compartilhamento;
- fila persistente no IndexedDB e fallback no Cache Storage;
- busca exata pelo ID para não abrir ZIP antigo;
- tratamento do compartilhamento antes da Home;
- bloqueio de recarga automática durante a importação;
- exclusão somente depois que o lead é salvo, atualizado ou descartado explicitamente;
- retomada após falha, fechamento ou perda de conexão, inclusive se o app fechar antes de salvar o lead;
- botão explícito para recuperar ou descartar uma importação pendente.

### Aprendizado automático sem reanálise involuntária

- nova ação `observacao-adicionar` salva o fato e agenda o aprendizado;
- nenhuma chamada à OpenAI é feita ao salvar a observação;
- sugestões atuais permanecem intactas;
- apenas campos realmente modificados são ensinados;
- observações antigas e novas são reconhecidas como contexto real do corretor;
- sugestões da IA continuam excluídas da fonte de aprendizado;
- não é necessário “reanalisar tudo” ou “aprender tudo” no uso normal.

### Atendimento imediato e coerente

- atualização otimista da tela e das listas em memória;
- mesclagem de eventos após o refetch para impedir regressão visual;
- preservação do horário local mais recente;
- separação entre última mensagem e último atendimento;
- observações manuais não contam como mensagem real do WhatsApp;
- copiar sugestão não marca atendimento;
- evento repetido no mesmo dia atualiza o horário mais recente.

### Remoção de score e redundâncias

- retirados campos numéricos da geração;
- limpeza recursiva de campos antigos na persistência e leitura;
- removidas funções e badges de probabilidade/confiança;
- removidos blocos duplicados de leitura e próxima ação.

## Testes executados

Todos concluídos sem erro:

- validação sintática de todos os arquivos JavaScript;
- regra de retomada após sete dias e validação integrada;
- regressão do carregamento da Home;
- aprendizado contínuo e bloqueio de sugestões da IA;
- Share Target em cold start e retenção do ZIP;
- aprendizado por observação sem reanálise;
- atualização imediata do atendimento e proteção contra leitura defasada;
- remoção de score, probabilidade e blocos redundantes;
- build de produção da versão 809;
- `npm audit`: zero vulnerabilidades conhecidas.

## Limite do ambiente de validação

O fluxo foi validado por análise estrutural, testes automatizados e build. O teste final de integração com o menu real “Exportar conversa” do WhatsApp exige a PWA publicada em HTTPS e um aparelho Android. Esse único teste não pode ser reproduzido dentro do ambiente local de código. Após publicar, o teste de aceite deve ser feito com o app totalmente fechado e apenas uma exportação.

## Teste de aceite após a publicação

1. Fechar completamente o Corretor Pro.
2. No WhatsApp, exportar uma conversa uma única vez para o Corretor Pro.
3. Confirmar que aparece “Conversa recebida. Preparando a importação…”.
4. Escolher o período dos áudios e aguardar a leitura, sem voltar ao WhatsApp para reenviar.
5. Salvar uma observação e confirmar que ela aparece na hora, sem gerar novas sugestões.
6. Marcar atendimento e confirmar que “Último atendimento” mostra imediatamente a data e a hora atuais.
7. Copiar uma sugestão e confirmar que o lead não muda para atendido.
