# Sistema único — fusão dos protótipos (junho/2026)

Este código é o resultado da fusão dos sistemas que existiam soltos, montado para
ficar **idêntico às telas oficiais (Home / Atendimentos — Opção A clara + versão escura)**
e, ao mesmo tempo, usar o melhor backend disponível.

## De onde veio cada parte

| Camada | Origem | Por quê |
|--------|--------|---------|
| **Frontend / layout** (`index.html`, `app.js`, `styles.css`, `share.html`, ícones, logos) | `corretor-pro` v653 (patch "somente arquivos alterados") | É o layout fiel ao mockup (Panorama do dia, sidebar 9 itens, KPIs, donut, funil, "Continuar atendendo"). |
| **Backend / IA** (`api/_cerebro-orquestrado.js`, `api/_pipeline.js`, `api/_persistence.js`, `api/processar-storage.js`, `api/reanalisar-lead.js`, `api/lead-update.js`, `api/cerebro-config.js`, `api/diagnostico.js`, `api/leads-recentes.js`, `api/criar-upload-url.js`, `api/limpar-tudo.js`) | `direciona-corretor` v651 | Backend de IA orquestrado (multi-agente), muito superior ao `server.js` monolítico. O frontend v653 **já chama exatamente esses 8 endpoints**. |
| **Build** (`build.js`, `vercel.json`) | `direciona-corretor` | Substitui `__VERSION__`/`__BUILD_ID__` e empacota `vendor/jszip.min.js` a partir do npm. |

## Bugs de produção corrigidos nesta fusão

1. **`Atualização #__VERSION__` literal na sidebar** → o `build.js` antigo do v653 só copiava o HTML
   sem substituir os marcadores. O `build.js` correto resolve (`__VERSION__` → versão do `RESTORE_POINTS.md`).
2. **Importação do WhatsApp quebrada (`/vendor/jszip.min.js` 404)** → o build agora copia
   `node_modules/jszip/dist/jszip.min.js` para `public/vendor/jszip.min.js`.
3. **`favicon.png` / `manifest.json` 404** → entram na lista de arquivos publicados pelo build.

## Como rodar / publicar

```bash
npm install
npm run build      # gera public/ com versão injetada e vendor/jszip
```

Deploy: Vercel (`buildCommand: node build.js`, `outputDirectory: public`).
Defina as variáveis de ambiente do `.env.example` (Supabase + OpenAI) para o cérebro funcionar.

## Pendências conhecidas

- Os testes de domínio (`teste-comercial-real.mjs`, `teste-validacao-jessica.mjs`, etc.) referenciados
  no `package.json` **não vieram em nenhum zip** — só `teste-performance-historico.mjs` está presente.
  O script `test` foi ajustado para rodar o que existe; o conjunto completo ficou em `test:full`.
- Dados zerados na tela são esperados até conectar Supabase + OpenAI e importar conversas.
