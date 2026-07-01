# Atualização 661

## Trava fantasma ao finalizar a importação

- `renderProcessedResult` (monta a tela depois de importar o ZIP da conversa) era chamada em dois pontos sem `await` nem `.catch()`. Se algo desse errado no meio dela, o erro virava uma promise rejeitada em silêncio e a tela ficava travada em "Conversa processada", sem nunca mostrar o resultado.
- A função passou a ser envolvida por try/catch: em caso de erro, mostra uma caixa vermelha explicando o problema com um botão "Recarregar", em vez de travar sem aviso.
- Correção cirúrgica — nenhuma linha de lógica foi alterada, apenas o envelope try/catch.
- Cache PWA isolado na versão 661 (`service-worker.js`) para forçar a atualização do PWA.
