# v875 — Identidade Visual v2.0 (Etapa 2: componentes + boot theme-aware)

## Contexto

Segunda etapa do plano do documento de identidade (a primeira, v874, alinhou os tokens/paleta).
Aqui o foco é **componentes**: remover os gradientes decorativos que o documento proíbe, corrigir
o flash do boot no tema claro e ajustar a proeminência do banner de instalação — sempre sem tocar
em lógica, IDs, eventos ou contratos.

## Mudança

### Boot no-flash coerente com o tema (`index.html`)
Antes o boot pintava petróleo escuro **sempre**, causando flash escuro para quem usa o tema claro.
Agora a IIFE de pré-pintura lê o tema salvo e define `--boot-bg`/`--boot-fg`/`--boot-sub` conforme
a paleta oficial (dark `#052B36`/`#F4F7FB`, light `#F3F6F7`/`#102A34`), aplicando também no
`theme-color`. O `<style>` do boot, o `body::before` e a tela `#bootPaint` passaram a usar essas
variáveis. Resultado: primeira pintura já no tema certo, sem flash.

### Remoção de gradientes decorativos (seções 2, 5, 9, 10, 12, 22, 23)
- **Body**: removido o brilho ambiente radial coral (fundo chapado premium).
- **Botões (`app.js`)**: achatados os gradientes **coral+azul** (`--lime`→`--cyan`) e **coral+verde**
  (`--lime`→`--acao`) para **coral sólido** (`var(--accent)`) — inclui os botões "Salvar".
  Exceção correta: o botão **"Vendido"** virou **verde sólido** (`var(--acao)`), pois venda é sucesso.
- **Barras de progresso genéricas** (`.progress-bar`): coral sólido.
- **Banner de instalação**: de gradiente coral para fundo coral suave chapado com borda mais discreta
  (menos proeminente, seção 23).
- **Seleção sem "mancha"**: KPI ativo e item de sidebar ativo deixaram de usar gradiente; a **sidebar
  ativa** agora usa fundo coral suave + **linha coral lateral** (`box-shadow:inset 3px 0 0`), como pede
  a seção 18. Removido também um quarto tom de coral solto (`255,82,72`) que sobrava numa sombra.
- **Painéis coral+azul** (insight-foco) e cartões de ação do lead: achatados para coral suave.

### Preservado de propósito
- A **barra de etapa** (`.cp704-etapa-fill`, âmbar→coral) e a **barra de reanálise** são indicadores
  funcionais, com design intencional e testes dedicados — mantidas.
- Gradientes de painel muito sutis (4–8% alpha) e específicos de telas ainda não revisadas ficam
  para a passagem tela-a-tela (Etapas 3-5).

## Verificação

- **Novo teste** `tests/v875-componentes-sem-gradiente`: garante o boot theme-aware e barra a volta
  dos gradientes de botão coral+azul/coral+verde, do brilho ambiente do body, do gradiente no banner,
  das "manchas" de seleção e do coral solto `255,82,72`.
- **`npm test`**: suíte completa verde (o `v864` da barra de etapa segue passando — o gradiente
  funcional dela foi preservado).
- **Validação visual (Chromium, mobile 412px e desktop 1366px, dark e light)**: Home, header, sidebar,
  banner, cards, FAB e navegação coerentes nos dois temas, sem regressão de layout; boot já pinta no
  tema salvo.

## Pendências (próximas etapas)

- **Etapa 2 (fim)**: amarrar `.btn`/`.card`/campos aos tokens de raio/altura/espaçamento de forma
  consolidada; hierarquia formal de botões (primário/secundário/sucesso/perigo) como classes.
- **Etapas 3-5 — Telas**: tela do lead, Agenda mobile (ações abaixo do conteúdo), Cérebro, Aprendizado,
  Desempenho, Gerador de proposta, e os gradientes de painel sutis remanescentes.
