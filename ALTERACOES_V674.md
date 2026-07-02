# Atualização 674

## Correções

- O botão **Atualizar análise comercial** passa a usar imediatamente o resultado confirmado pela API, sem permitir que uma leitura antiga do cache sobrescreva a análise recém-gravada.
- A API não informa mais sucesso quando o banco não recebeu a atualização; em conflito de gravação, relê e tenta novamente, ou devolve erro claro.
- A análise comercial é reconciliada novamente depois da mesclagem com os dados anteriores, evitando que estado ou mensagem antigos retornem.
- O schema comercial passa para **674**.
- Quando a oportunidade terminou e não existe ação urgente, mensagens anteriores são apagadas de forma determinística, inclusive se o provedor de IA estiver temporariamente indisponível.
- O caso “comprador final adquiriu outro imóvel” grava: oportunidade encerrada, parceria ativa, nenhuma ação urgente e nenhuma mensagem recomendada.
- Compromissos e lembretes antigos são removidos quando a oportunidade já está encerrada.
- O último compromisso deixa de mostrar uma promessa antiga quando o desfecho final já foi informado.
- Os indicadores gerais de Ativos, Quentes, Agenda e Reaquecer permanecem ocultos enquanto um lead estiver aberto, mesmo durante atualizações automáticas da Home.
