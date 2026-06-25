# Corretor Pro — primeira função

Projeto novo, construído do zero para receber uma conversa exportada do WhatsApp, transformar áudios em texto e montar um atendimento textual contínuo.

## Identidade aplicada

- logotipo aprovado do Corretor Pro;
- verde-esmeralda `#059669`;
- verde-escuro `#065F46`;
- chumbo `#1F2937`;
- cinza médio `#6B7280`;
- cinza-claro `#F3F4F6`;
- branco `#FFFFFF`;
- tipografia Poppins.

## O que esta versão faz

- instala como PWA e exibe o ícone aprovado;
- no Android, aparece como destino ao compartilhar um ZIP exportado do WhatsApp;
- recebe o ZIP e inicia o processamento automaticamente;
- lê somente o TXT da conversa;
- transcreve somente áudios `.opus`;
- ignora imagens, vídeos, PDFs, figurinhas e outras mídias;
- posiciona cada transcrição no local cronológico correto;
- salva o atendimento no aparelho e, quando configurado, também no Supabase;
- ao receber novamente a mesma conversa, adiciona apenas itens novos;
- mostra a lista de atendimentos e o atendimento textual completo;
- permite editar o nome do atendimento.

## Variáveis na Vercel

- `OPENAI_API_KEY`
- `OPENAI_TRANSCRIPTION_MODEL` (opcional; padrão: `whisper-1`)
- `SUPABASE_URL` (opcional nesta primeira versão)
- `SUPABASE_SERVICE_ROLE_KEY` (opcional nesta primeira versão)

Sem Supabase configurado, o sistema continua funcionando e salva localmente no aparelho.

## Banco

Execute `supabase.sql` no SQL Editor do Supabase para ativar a cópia remota dos atendimentos.

## Publicação

1. Envie todo o conteúdo desta pasta para a raiz do repositório `corretor-pro`.
2. Importe o repositório na Vercel com Framework Preset `Other`.
3. Cadastre as variáveis de ambiente.
4. Faça o deploy.

## Limitações desta primeira entrega

- o recebimento direto por `share_target` será testado em navegador Chromium no Android;
- cada áudio enviado à função da Vercel está limitado a 4 MB nesta versão;
- sem login, a recuperação em outro aparelho ainda não existe.
