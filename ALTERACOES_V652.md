# Alterações V652 — correção estrutural de desempenho

## Problema confirmado

A V651 preservou o histórico completo, mas ainda deixava o aplicativo lento porque a inicialização montava telas escondidas, alguns cliques eram processados duas vezes e diversas áreas recalculavam a carteira inteira antes de o navegador conseguir mostrar a troca de tela.

## Correções aplicadas

- Inicialização carrega somente a Home e os dados indispensáveis; Pipeline, Agenda, Carteira, Vendas e relatórios são montados apenas quando abertos.
- Removido o segundo listener de navegação que executava alguns cliques duas vezes.
- A troca visual acontece antes do processamento da tela, usando o próximo frame do navegador.
- Telas já renderizadas reutilizam o conteúdo enquanto a base não mudou.
- Pipeline deixa de renderizar duas vezes os mesmos dados em memória.
- Carteira passa a montar 80 linhas por vez, com botão “Carregar mais”; todos os leads continuam acessíveis.
- A abertura do lead mostra resposta visual imediata e monta o histórico integral em momento ocioso.
- A listagem no servidor deixa de criar cópias completas das timelines e não transporta campos legados pesados da análise.
- O detalhe de cada lead continua devolvendo todas as mensagens e a análise integral, sem limite de 40 mensagens.

## Validação

- Teste com 125 mensagens: 8 mensagens na prévia e 125 no detalhe.
- Teste com 350 mensagens: 8 mensagens na prévia e 350 no detalhe.
- Validado que campos pesados não necessários não são enviados na carteira, mas permanecem no detalhe.
- JavaScript do front e das APIs validado sintaticamente.
