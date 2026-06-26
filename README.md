# Corretor Pro — pacote único completo 0.1.3

Todos os arquivos que você precisa enviar estão na raiz. Não há pastas para selecionar no computador.

Durante a publicação, o próprio `build.js` cria a pasta `public` dentro da Vercel. O `server.js` concentra as três rotas de funcionamento: health check, transcrição e atendimentos.

## Para atualizar o GitHub

1. Extraia o ZIP.
2. No repositório `corretor-pro`, clique em **Add file → Upload files**.
3. Selecione todos os arquivos extraídos.
4. Clique em **Commit changes**.

Os arquivos com o mesmo nome substituirão a versão anterior. Não é necessário criar pastas manualmente.

## Variável obrigatória para transcrição

Na Vercel, configure `OPENAI_API_KEY`.

## O que esta versão faz

- instala como PWA;
- recebe ZIP compartilhado pelo WhatsApp no Android;
- lê textos e transcreve `.opus`;
- monta uma linha do tempo única;
- ignora imagens, vídeos e PDFs;
- salva localmente no aparelho;
- permite Supabase opcional.
