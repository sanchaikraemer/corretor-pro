# Corretor Pro — v081

Aplicativo web/PWA para importar conversas exportadas do WhatsApp, organizar mensagens e transcrições, analisar o atendimento com inteligência comercial e sugerir próximas respostas.

## v081

Pacote entregue:

- visual mobile revisado em grafite/preto/cinza com verde-limão somente como destaque;
- remoção dos avatares dos cards de atendimento;
- remoção dos percentuais da lista, trocando por leitura comercial: `Responder`, `Alta`, `Média`, `Baixa` ou `Sem análise`;
- correção de proporções e estouro de layout no mobile;
- tela interna do lead alinhada visualmente com a tela inicial;
- limite de áudio mantido em 12 MB;
- cache local de transcrição por áudio no IndexedDB para evitar retranscrever o mesmo áudio em reimportações;
- reaproveitamento de transcrição anterior quando disponível;
- fluxo de importação com feedback mais claro durante transcrição.

## Arquivos principais

- `index.html` — estrutura da PWA;
- `styles.css` — interface visual;
- `app.js` — lógica principal do cliente;
- `db.js` — IndexedDB local;
- `server.js` — backend/API;
- `whatsapp.js` — parser de conversas do WhatsApp.
