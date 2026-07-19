# v874 — Identidade Visual v2.0 (Etapa 1: tokens globais / base)

## Contexto

Recebemos o documento **"Corretor Pro — Sistema de Identidade Visual v2.0" (Premium Comercial)**
e o prompt de implementação correspondente. A identidade aprovada define uma paleta oficial
(Dark Premium azul-petróleo + Light Premium branco-gelo), o **coral oficial `#FF6258`**, tipografia
Inter, semântica de cor fixa, escala de espaçamento/raio e um plano de implantação em etapas —
começando obrigatoriamente pelos **tokens globais**.

O prompt exige preservar 100% do funcionamento (importação, Share Target, IA, Cérebro, Supabase,
PWA, agenda, propostas, navegação) e proíbe "publicar sem testar" ou "afirmar que está pronto sem
revisar". Por isso esta versão entrega a **Etapa 1 (Base)** completa e verificada; componentes e
telas seguem em incrementos seguros nas próximas versões.

## Diagnóstico (auditoria real, sem supor)

O app já tinha a arquitetura de dois temas (`html[data-theme="dark"|"light"]`, Inter, base petróleo),
mas com **três camadas de cor conflitantes** e valores fora da paleta aprovada:

1. `:root`/`html[data-theme]` legado (styles.css ~675) — coral `#FF6B5C`, fundo `#08171D`.
2. **"CAMADA FINAL #657"** (styles.css ~1025) — a que de fato renderiza o **dark**: coral próprio
   `#FF5B50`, petróleo `#001A25`.
3. **"#751 tema claro"** (styles.css ~1542) — a que de fato renderiza o **light**.

Além disso, o boot/no-flash e o `theme-color` usavam um **terceiro petróleo** (`#001E2B`), e o
service-worker (fallback offline) repetia o coral/petróleo antigos. Resultado: coral em 3 tons e
petróleo em 3 tons convivendo — exatamente a "inconsistência de acabamento" que o documento aponta.

## Mudança

**Unificação da identidade na paleta oficial (doc pág. 4 e 15), sem tocar em lógica.**

- **Coral**: migrado para `#FF6258` em TODAS as camadas e literais (`#FF6B5C`, `#FF5B50`, `#FF704F`,
  `#FF6257` e os `rgba` correspondentes) em `styles.css`, `index.html`, `app.js`, `service-worker.js`.
- **Petróleo unificado**: boot, `body::before`, `theme-color` e fallbacks passaram de `#001E2B` para
  o fundo oficial `#052B36`; o `theme-color` por tema agora é `#052B36` (dark) / `#F3F6F7` (light).
- **Dark Premium oficial** (camada #657, a que renderiza): Fundo `#052B36`, Fundo 2 `#082F3B`,
  Superfície `#0D3946`, Elevado `#124653`, Borda `#205665`, Texto `#F7FAFB`, Secundário `#C2CDD2`,
  Auxiliar `#8FA0A8`.
- **Light Premium oficial** (camada #751, a que renderiza): Fundo `#F3F6F7`, Superfície `#FFFFFF`,
  Superfície suave `#EEF3F5`, Borda `#D7E0E4`, Texto `#102A34`, Secundário `#596A72`,
  Auxiliar `#7E8D94`, Coral suave (seleção) `#FFF0EE`.
- Os blocos `html[data-theme]` legados também foram alinhados, eliminando paleta obsoleta.
- **Tokens de escala do design system** (base para as próximas etapas), num `:root` neutro de tema:
  `--space-1..7`, `--radius-sm/md/lg/xl/pill`, `--control-height-sm/md/lg`, `--font-size-xs..3xl`,
  `--font-weight-*`, `--brand-primary`/`-hover`/`-soft` e `--status-success/warning/danger/info`.

O coral continua idêntico nos dois temas; muda apenas o contexto ao redor — exatamente a regra do doc.

## Verificação

- **Novo teste** `tests/v874-identidade-tokens`: trava a paleta oficial nas camadas que renderizam
  (cp #657 dark + #751 light), garante os tokens de escala e **falha se qualquer coral/petróleo antigo
  reaparecer** em styles.css, index.html, app.js ou service-worker.js.
- **`npm test`**: suíte completa verde.
- **Validação visual (Chromium 412px, dark e light)**: confirmado que os valores efetivos renderizados
  são a paleta oficial (`--bg`/`--panel`/`--text`/`--accent` corretos) e que Home, header, cards,
  banner, FAB e navegação inferior aparecem coerentes, sem quebra e sem regressão de layout.

## Pendências (próximas etapas do plano do documento)

Esta versão é a **Etapa 1 (Base)**. Ainda a fazer, em incrementos verificados:
- **Etapa 2 — Componentes**: amarrar `.btn`/`.card`/campos aos tokens de raio/altura/espaçamento;
  remover o gradiente coral→verde do CTA e demais gradientes decorativos; hierarquia de botões.
- **Etapa 3-5 — Telas**: Hoje (reduzir banner de instalação), tela do lead, Agenda mobile (ações
  abaixo do conteúdo), Cérebro, Aprendizado, Desempenho, Gerador de proposta.
- **Boot em tema claro**: o no-flash pinta petróleo mesmo no light — avaliar pintar conforme o tema
  salvo para evitar flash escuro em quem usa o claro.
