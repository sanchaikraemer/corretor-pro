# Corretor Pro — pacote único completo 0.1.4

Todos os arquivos que você precisa enviar estão na raiz. Não há pastas para selecionar no computador.

Durante a publicação, o próprio `build.js` cria a pasta `public` dentro da Vercel. O `server.js` concentra as rotas de funcionamento: health check, transcrição, atendimentos e exclusão de leads.

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
- salva localmente e mantém a mesma base atualizada automaticamente pelo link;
- tenta transcrever novamente quando um áudio falha;
- avisa quando a conversa ficou com áudio não transcrito;
- permite excluir um lead;
- usa o Supabase para manter os dados iguais em todos os acessos ao site.
