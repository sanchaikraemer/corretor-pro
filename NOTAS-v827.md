# Corretor Pro — Atualização 827

Terceiro módulo do plano. Tema: **Aprendizado e informações comerciais**. Esta primeira
entrega trata o §7.4 (nome do corretor e janela de áudio). A remoção do catálogo
comercial fixo (§7.1) vem em seguida.

## Nome do corretor vem do Cérebro (§7.4)

- O nome fixo **"Sanchai"** foi eliminado de todas as rotas e prompts do backend
  (`_pipeline.js`, `lead-update.js`, `reanalisar-lead.js`).
- O nome usado na análise vem sempre da configuração **"Seu nome (como aparece no
  WhatsApp)"** do Cérebro (`corretorNome`). Na ausência de configuração, entra um rótulo
  genérico ("o corretor") — nunca um nome cravado no código.
- O painel continua com "Sanchai ou Construtora Senger", agora lido da configuração, sem
  estar escrito no código.

## Janela de áudio com chave estável (§7.4)

- A preferência da janela de áudio usava uma chave com o **número da versão**
  (`..._v__VERSION__`), então **zerava a cada atualização**. Agora usa uma **chave
  estável**.
- O **padrão persistente** vem do Cérebro (campo "dias de importação" / `diasImportacao`),
  com a chave estável como reserva e 90 dias como último recurso.
- A escolha feita **durante uma importação** passou a ser **exceção apenas daquela
  importação** — não sobrescreve mais o padrão. O padrão é ajustado só no Cérebro.

## Validação

- Versão interna: `7.127.0`. Versão exibida: `827`.
- Novo teste `tests/v827-nome-audio.test.mjs`: confirma que não há nome fixo no código,
  que o nome vem do Cérebro, que a chave de áudio é estável (sem versão), que o padrão
  vem do Cérebro e que a escolha na importação não vira padrão.
- Suíte completa (27 conjuntos) e build (`versão=827`) sem erro.

## Remoção total das informações comerciais fixas (§7.1) — versão 827-1

Remoção radical de todo o catálogo comercial cravado no código. A IA passa a se apoiar
**apenas** em fontes reais (Cérebro, observações, análises e histórico da conversa) e, na
ausência de informação, tem **cautela em vez de inventar** (§7.2).

Removido do código ativo:

- **Catálogo interno** com preços e faixas (`CATALOGO_SENGER_FALLBACK`, `RENAISSANCE_LINHA`,
  `DIFERENCIAIS_ENCANTAR`) e as funções que o liam (`tipoDoProduto`, `fatosDoProduto`,
  `diferenciaisRelevantes`, `loadCatalogoSenger`).
- **Catálogo externo** (tabela via GitHub Pages): removidas `nomesEmpreendimentosSenger`,
  `parseSengerDataJs` e o módulo órfão `api/_cerebro-orquestrado.js` inteiro.
- **Listas fixas de empreendimentos** usadas para detectar/normalizar produto
  (`detectProduct`, `products` na persistência, `EMPS` na leitura de print, a lista de
  autocomplete `EMPREENDIMENTOS_SENGER` e o regex `PRODUTOS_RX`).
- **Rede de segurança que "completava" o produto** a partir do catálogo
  (`empreendimentoDaConversa`): sem catálogo, o produto vem só da conversa; quando a IA não
  identifica, fica "Não identificado".
- **Instruções de prompt com dados fixos**: nomes de empreendimentos, condições e o nome de
  uma pessoa foram substituídos por orientação genérica que remete ao Cérebro e aos fatos da
  conversa. As referências fixas a empresa/cidade ("Construtora Senger — Carazinho/RS") nos
  prompts e nos defaults viraram texto neutro.
- Um valor default inventado ('Renaissance') e os normalizadores de nome de produto foram
  neutralizados.

### Validação

- Novo teste `tests/v827-catalogo.test.mjs`: **busca automatizada** (§7.5) confirma que
  nenhum preço, empreendimento, catálogo ou a tabela externa aparecem no código ativo, que
  o módulo externo foi removido e que `detectProduct` não usa mais lista fixa.
- `tests/v820-produto-empreendimento.test.mjs` removido (testava justamente o preenchimento
  via catálogo fixo, agora eliminado — §11.4 do plano).
- Suíte completa (27 conjuntos) e build (`versão=827-1`) sem erro.

## Impacto esperado

As mensagens deixam de citar preços/empreendimentos "de cabeça". O que a IA souber vem do
**Cérebro** (método, tom, diferenciais, regras) e do que estiver **na própria conversa**.
Para reintroduzir informação comercial, o caminho passa a ser o Cérebro — não o código.

## Como testar depois de publicar

1. Ajustar o período de áudio numa importação e, depois de uma atualização de versão,
   confirmar que o padrão continua o mesmo (não zerou).
2. Conferir que o nome nas mensagens segue o configurado no Cérebro.
