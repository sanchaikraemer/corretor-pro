# NOTAS v1107 — Auditoria geral: fuso horário, app offline e botões que falhavam em silêncio

## De onde veio

Pedido do dono: "analise o sistema completo, corrija os problemas e melhore o produto". Três
auditorias paralelas (servidor, tela, app instalado/publicação) varreram o código atrás de
defeito real e comprovável. Tudo que foi apontado foi verificado de novo antes de corrigir —
um dos achados se revelou falso alarme e foi descartado (ver "O que NÃO mudou").

## O que foi corrigido

### 1. Datas da conversa: mensagem de madrugada contava no dia anterior
O servidor roda em horário universal (UTC), 3 horas à frente de Brasília. A hora escrita no
arquivo exportado do WhatsApp (hora do Brasil) era tratada como se fosse hora universal — toda
mensagem entre 00h00 e 02h59 caía no dia civil **anterior** quando o app reconvertia pra
Brasília. Efeitos: data errada na lista (desde a v1101 a lista mostra a data), "dias parado"
com 1 dia a mais, e a própria IA recebendo a contagem de dias errada. Corrigido na raiz
(`parseDateTime`, em `api/_pipeline.js`): a hora do TXT agora é sempre interpretada como
horário de Brasília (-03:00, fixo desde 2019), independente do fuso do servidor.

### 2. Criar lead manual carimbava data/hora do servidor (3h adiantada)
"Criar lead manualmente" e "nova oportunidade de parceiro" montavam o carimbo com a hora do
servidor (UTC): lead criado às 21h30 saía anotado no **dia seguinte**, 00h30. Os caminhos
irmãos (observação por voz, reanálise) já tinham sido corrigidos em versões passadas — esses
dois tinham ficado pra trás. Agora usam o mesmo `dataHoraSaoPaulo()`.

### 3. "Mês passado" do Desempenho errava o mês em outros fusos do Brasil
O cálculo do mês anterior (v1106) usava o fuso do **aparelho**: em Cuiabá, Campo Grande ou
Manaus (UTC-4/-5), no dia 1º do mês o chip pulava um mês a mais pra trás (mostrava "Junho"
em pleno 1º de agosto, somando dois meses num só). Agora o mês anterior é derivado no
calendário de Brasília, igual ao resto do Desempenho.

### 4. App instalado morria offline: faltavam 4 arquivos no pacote
O pacote offline do app instalado (PWA) não incluía `js/tema.js` e `js/commercial-schema.js`
(sem eles o código principal nem executa) nem `vendor/supabase.js` e `contas-config.js` (sem
eles o login não sobe). Sem conexão, o app abria e travava pra sempre em "Carregando os
leads...". Os 4 entraram no pacote, e um teste novo garante que nenhum arquivo essencial
fique de fora de novo.

### 5. Troca de versão podia apagar um ZIP compartilhado ainda não importado
Ao detectar versão nova, o app apagava **todas** as caches — inclusive a que pode guardar um
ZIP compartilhado pelo WhatsApp que ainda não foi processado (reserva usada quando o
armazenamento principal falha). Era mais uma porta pra "compartilhei e a importação sumiu",
de forma intermitente. Agora a limpeza só remove as caches de arquivos versionados.

### 6. Botão "×" de descartar compromisso atrasado não atualizava a Agenda
O descarte gravava, mas a lista só atualizava saindo e voltando da tela (o botão chamava uma
função que não estava publicada pro HTML — falha silenciosa, só no console). Publicada a
função, o item some na hora.

### 7. Busca do computador não limpava os resultados ao abrir o lead
Clicar num resultado da busca do topo (computador) abria o lead, mas o campo não limpava e a
lista de resultados ficava aberta por cima da tela ao voltar. Mesma causa do item 6 (função
fora do alcance do clique); corrigido.

### 8. Fallback de gravação semeava de novo a "etapa suja" que a v1105 limpou
Quando a gravação principal de um lead novo falha, a gravação reserva ainda escrevia um TEXTO
("Conversa processada pelo Motor Real...") na coluna que diz se o cliente é Ativo/Arquivado —
exatamente a sujeira que a autolimpeza da v1105 corrige. Agora nasce "Ativo".

### 9. Reimportar apagava o histórico de importações acumulado
Reimportando por um dos dois caminhos possíveis, a lista interna de importações do lead era
substituída pela última (perdia a trilha de auditoria e enfraquecia a limpeza de arquivos ao
apagar o lead). Agora acumula (teto de 50), como o outro caminho já fazia.

### 10. Textos e nomes de arquivo
- "1 lead atendidos hoje" → "1 lead atendido hoje"; pill do topo "1 leads" → "1 lead";
  aviso "Planilha de 1 leads baixada" → concordância certa.
- Planilha e backup baixados depois das 21h saíam com a **data de amanhã** no nome do arquivo
  (data universal) — agora usam a data de Brasília.

## Limpeza
- `_s.mjs` (script de depuração de outra sessão, esquecido na raiz do repositório) removido.
- Comentário desatualizado em `api/_zipUpload.js` (citava rota removida na v1083) corrigido.
- Meia regra morta de CSS na Home removida (o `#resumoDia` escondido na linha 428 era sempre
  atropelado pela regra posterior que o mostra — zero efeito visual, confirmado no navegador).

## O que NÃO mudou (falso alarme verificado)
A auditoria apontou que a listagem devolvia a etapa "crua" enquanto o banco gravava a
normalizada — mas a v1105 já normaliza dos DOIS lados (tela e banco) com a mesma régua, e o
teste da v1105 fixa de propósito que a leitura devolve o dado como está. Nada a corrigir;
uma tentativa de "correção" aqui foi revertida ao rodar a suíte.

## Validação

| Verificação | Resultado |
|---|---|
| Suíte completa | 281 testes verdes (novo: `v1107-fuso-brasilia-e-correcoes-auditoria`) |
| `npm run build` | ok, versão 1107 |
| Navegador de verdade | Home/Desempenho/Agenda/busca conferidos em 390px e 1280px |

## Arquivos alterados

**Código:** `api/_pipeline.js`, `api/_persistence.js`, `api/lead-update.js`, `api/_zipUpload.js`,
`app.js`, `service-worker.js`, `styles.css`

**Removido:** `_s.mjs`

**Versão:** `package.json`, `package-lock.json`

**Documentação:** `NOTAS-v1107.md` (novo)

**Testes (novo):** `tests/v1107-fuso-brasilia-e-correcoes-auditoria.test.mjs`
