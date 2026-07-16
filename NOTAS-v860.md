# v860 — remoção completa do termômetro (quente/morno/frio)

## Contexto

A v859 (correção do Cérebro, ver abaixo) veio pronta do dono. Em cima dela, o dono pediu
de forma explícita e enfática: **"termômetro NÃO PODE EXISTIR"**, e escolheu remover *tudo,
inclusive por dentro*. O termômetro era a leitura/classificação de leads como
quente/morno/frio — tanto a leitura mostrada no lead quanto as abas de triagem.

Base desta fatia: a v859 do dono (arquivo `corretorprov859cerebroregrasobjecoesativas.zip`),
que corrige o Cérebro. Esta v860 **não altera** essa correção — só remove o termômetro.

## Descoberta que tornou a remoção segura

Antes de mexer, foi confirmado que **os campos de temperatura já eram vestigiais**:
- `leituraComercial.temperatura` **não é mais gerado** pelo pipeline (0 ocorrências em
  `api/_pipeline.js`) — o `app.js` ainda exibia um campo que a IA nem produz mais.
- Os valores de `tipoRetomada` (`quente-fechar`/`morno-confirmar`/`frio-reaquecer`)
  **nunca são atribuídos** no código atual — só comparados. Ou seja, para qualquer lead
  analisado pela versão atual eles são sempre vazios; as comparações `=== "quente-fechar"`
  são inertes hoje e só "acendiam" em análises salvas por versões bem antigas.

Isso confirmou que remover a leitura e renomear os rótulos é comportamentalmente seguro.

## O que mudou (só `app.js`)

1. **Leitura "Temperatura" removida por completo:**
   - Linha do cartão do lead (`["Temperatura", lc.temperatura]`) — removida.
   - Coluna `TEMPERATURA` do Excel/CSV (cabeçalho + variável + célula) — removida.
   - Fallbacks de lógica que consultavam `leituraComercial.temperatura` (em `interesse`,
     em `leadEhQuente` e na exportação) — removidos. Não sobrou nenhuma ocorrência da
     palavra `temperatura` no `app.js`.

2. **Abas de triagem renomeadas** (nomes escolhidos pelo dono):
   `Quentes → Agora`, `Esfriando → Parando`, `Reaquecer → Reativar`.
   Aplicado nos **dois** blocos de pipeline/atendimentos — atenção: existem dois
   `carregarPipeline` no arquivo e o **segundo (~linha 11874) sobrescreve o primeiro**,
   então o bloco realmente vivo é o de baixo. Ambos foram atualizados para ficarem
   consistentes (KPIs, tabs e `acaoRow`).

3. **Microcópia/tags de temperatura neutralizadas:** "lead quente escondido" →
   "oportunidade com sinais fortes"; "não esfriar" → "manter o ritmo"; "— frio"/"janela
   esfriando" → "janela fechando"; tag `⚠ REAQUECER` → `⚠ REATIVAR`; ícone/tag ❄️ de
   "Esfriando" → ⏳ "Parando"; rótulos `Precisa reaquecer`/`Reaquecer`/`Esfriou` →
   `Precisa reativar`/`Reativar`/`Parou`; textos do radar ("esfriando/esfriaram" →
   "parando/pararam"; "dinheiro mais quente" → "dinheiro mais valioso").

## O que foi mantido de propósito

- **Chaves internas e nomes de função** (`tipoRetomada` valores, `leadEhQuente`,
  `ehEsfriando`, keys de filtro `quentes`/`esfriando`/`reaquecer`, keys de ícone) — são
  identificadores de código **invisíveis ao usuário** e, no caso do `tipoRetomada`, já
  inertes. Renomeá-los seria puro risco sem nenhum benefício visível. O termômetro deixou
  de existir em tudo que o corretor vê e em tudo que o app produz/exibe.
- O **normalizador de exibição** já existente (troca "esfriando"→"perdendo ritmo",
  "reaquecer"→"retomar" etc. em tempo de render) foi mantido como rede de segurança.
- O ícone de chama do KPI "Agora" (`ui631Icon('quente')`) foi mantido para não arriscar
  layout; é um SVG abstrato, sem texto de temperatura.

## Sobre a v859 (correção do Cérebro) — incorporada como base

A v859 do dono conserta um bug real da v858: as **Regras** e **Objeções** passaram a ser
salvas em bloco de texto (`regrasTexto`/`objecoesTexto`), mas o leitor da análise
(`formatCerebroPrompt` via `sanitizeCerebroConfig`) ainda lia só os arrays legados
(vazios) — então o que o corretor digitava nunca chegava na IA. A v859 faz
`sanitizeCerebroConfig`/`hasCerebroInstructions`/`formatCerebroPrompt` preferirem o bloco
de texto, com os arrays antigos como fallback. Correção verificada e completa; suíte verde.

## Verificação

- `npm test`: suíte completa (agora com `v859-cerebro-blocos-chegam-ia` e o novo
  `v860-sem-termometro`) — sem erro.
- `node build.js`: build limpo, versão 860.
- Não foi possível rodar o app de ponta a ponta nesta sessão (sem credenciais de
  Supabase/OpenAI). A validação foi por `node --check`, testes-guarda e varredura completa
  de texto visível de temperatura no `app.js` (zerada).

## Observação para o futuro (ainda em aberto, a pedido do dono foi adiado)

- `api/analisar.js` continua sendo a única rota **sem `requireApiKey`** e roda o pipeline
  OpenAI completo — rota pública que gasta crédito. Fica registrado para uma próxima fatia.
