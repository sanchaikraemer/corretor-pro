# v775 — Importação em lote de conversas (ZIP de ZIPs)

## O pedido

O corretor tinha uma planilha com 200 leads de uma base anterior, 190 deles com o histórico de WhatsApp completo. Ele queria trazer todos pro Corretor Pro de uma vez, sem precisar abrir a tela de importação 190 vezes.

## Por que não dava pra automatizar isso de fora do app

As rotas `/api/*` são protegidas por uma chave (`CORRETOR_PRO_API_KEY`) que só existe nas variáveis de ambiente da Vercel e no `localStorage` do navegador de quem já configurou o app — nunca no código-fonte nem em nenhum ambiente de desenvolvimento. Não tinha como rodar a importação em lote de fora do app sem essa chave.

## O que foi feito

Nova ferramenta em **Mais → Configurações → "Importar conversas em lote (ZIP de ZIPs)"**. O corretor sobe um único `.zip` que contém vários `.zip` de conversas (um por cliente, cada um no formato normal de exportação do WhatsApp — o mesmo que a importação manual já aceita). O app então, sozinho:

1. Lê o pacote no navegador (`JSZip`, já usado em outras partes do app).
2. Pra cada conversa: sobe pro Storage, processa com a IA (`/api/processar-storage`, `action:"completo"`) e salva (`/api/lead-update`, `action:"salvar-novo"`) — os mesmos três passos que a tela normal de importação faz, só que em lote, com 3 em paralelo.
3. Usa a chave já salva no aparelho (o `fetch` do app já anexa `X-Corretor-Pro-Key` automaticamente em toda chamada `/api/*`) — nenhuma credencial nova precisa ser digitada.
4. Como o backend já deduplica por telefone/nome (`persistProcessingResult`), um lead que já existe é **atualizado**, nunca duplicado.
5. Marca no `localStorage` do navegador quais conversas já entraram com sucesso, pra rodar o mesmo pacote de novo (depois de uma falha parcial) sem reprocessar as que já deram certo.

## Testes

- `npm test` e `npm run build` passaram.
- Validado que o pacote de 190 conversas gerado a partir da planilha é lido corretamente (190 entradas `.zip`, manifesto ignorado).
- Falta validar em produção: subir o pacote real pela tela nova e conferir os leads criados/atualizados.
