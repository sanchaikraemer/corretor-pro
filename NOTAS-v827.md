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

## Ainda dentro do Módulo 827 (próxima entrega)

- **Remoção das informações comerciais fixas (§7.1):** apagar preços, prazos, produtos,
  empreendimentos e o catálogo (interno e o externo via GitHub Pages) cravados no código;
  garantir que a ausência de informação vire cautela, não invenção; e manter as fontes
  válidas (Cérebro, observações, análises e históricos reais) com detecção de conflito.

## Como testar depois de publicar

1. Ajustar o período de áudio numa importação e, depois de uma atualização de versão,
   confirmar que o padrão continua o mesmo (não zerou).
2. Conferir que o nome nas mensagens segue o configurado no Cérebro.
