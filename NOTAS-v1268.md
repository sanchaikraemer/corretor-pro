# v1268 — tema claro deletado + faxina geral no código

Ordem do dono (13/08/2026, madrugada):

> "pode deletar o tema claro do sistema, bem como todas linhas de código e arquivos. também quero q
> faça uma faxina e limpe códigos e linhas ou arquivos desnecessário e corrija os corrompidos,
> revise geral."

Resultado em número: **878 linhas removidas, 123 acrescentadas** (a maior parte das acrescentadas é
comentário explicando o que saiu e por quê).

## 1. Tema claro — removido de ponta a ponta

| Onde | O que saiu |
|---|---|
| `styles.css` | **~480 linhas**: todas as regras `html[data-theme="light"]` e o bloco de estilo do cartão "Aparência" |
| `js/tema.js` | **arquivo apagado** (38 linhas) — guardava a preferência, alternava e atualizava a cor da barra |
| `index.html` | o cartão **"Aparência"** inteiro (escolha Claro/Escuro) e o script de boot que lia a preferência salva e escolhia a paleta |
| `app.js` | o import e a chamada do módulo |
| `build.js` / `service-worker.js` | o arquivo saiu das listas de publicação e do pacote offline |

O tema escuro agora é **fixo no `<html>`** (`data-theme="dark"`, `color-scheme:dark`) e a cor da
barra do navegador é constante. As variáveis `--boot-*` também saíram: elas só existiam pra trocar
de paleta no arranque; hoje o fundo oficial é pintado direto.

**Quem tinha o tema claro salvo no aparelho abre no escuro** — conferido no navegador, com a
preferência antiga gravada de propósito antes de recarregar.

## 2. Faxina — o que era código morto de verdade

| Item | Tamanho | Por que era morto |
|---|---|---|
| Bloco `V684-FINAL — IA COMERCIAL 2.0` | **103 linhas** | Montava um cartão de "raciocínio comercial" no cliente. As três funções não eram chamadas por ninguém desde que o wrapper antigo de `renderLeadFoco` saiu (#724-2). |
| Primeira `renderResumoDia` | **47 linhas** | Era declarada e **substituída** mais abaixo no próprio arquivo. Nunca rodava — e ainda assim varria TODOS os leads somando seis contadores (quentes, mornos, frios, esfriando, aguardando ação, lembretes do dia) que ninguém lia, porque os elementos que os mostravam saíram da tela há versões. |
| `renderLeadsParecidos` | **~75 linhas** | A seção "Você já trabalhou clientes parecidos" foi ocultada a pedido do corretor, e o jeito de ocultar foi pôr um `return ""` na primeira linha: o resto ficou inalcançável. Ninguém mais chamava a função. |
| `scoreLead` | 3 linhas | Apelido de `scorePrioridadeAtendimento` sem nenhum uso — só criava dúvida sobre qual das duas era a de verdade. |
| Comandos órfãos de tela | 9 linhas | Pintavam elementos que não existem mais: selos do menu de baixo, `#kpiAtivos`, o pill de total do celular e quatro botões de "atualizar" (Agenda, Painel, Arquivados, Carteira). |
| CSS sem dono | 13 seletores | `.lead-acts`, `.ui670-action-card`, `.cp687-notify-item`, `.ui670-quick-dates` — nenhum é produzido por HTML ou JS. |
| `id=` sem uso | 5 | `msgStyleTabs`, `arqArquivados`, `relatorioSemanaCard`, `estadoIACard`, `performanceDiagCard` — não eram procurados pelo código nem usados no CSS. |
| Testes obsoletos | 2 arquivos | `js-tema-module` (testava o módulo apagado) e `v879-atendimentos-tema-claro`, que virou `v879-atendimentos-superficies` — sem a parte do tema, com o que continua valendo. |

## 3. Revisão geral — o que foi conferido e estava certo

- **Nada corrompido.** Nenhum arquivo com acentuação quebrada (mojibake), UTF-8 inválido, BOM ou
  fim de linha do Windows. Chaves do CSS balanceadas (conferido por varredura própria, que ignora
  comentários e textos).
- **Sem código comentado** apodrecendo no meio dos arquivos, e nenhum `TODO/FIXME` pendente.
- **Sem função declarada duas vezes**, sem ponte `window.` duplicada, sem import sem uso.
- **`api/` limpo**: as três funções que pareciam órfãs (`_colunasInexistentesEstado`,
  `_colunasInexistentesResetar`, `_dedupeIndexadoResetar`) são usadas pelos testes de propósito.
- **Nenhum arquivo órfão** no repositório: tudo que está versionado é referenciado por alguém.

### Um erro meu no meio do caminho, e a correção

A primeira versão do limpador de CSS cortava por vírgula sem enxergar comentários — e partiu ao meio
um comentário de seção que tinha vírgula, deixando `Não altera IA{` no arquivo. Peguei na conferência
seguinte, joguei fora e refiz o limpador respeitando comentários e textos entre aspas. O arquivo que
está publicado passou pela varredura de chaves balanceadas e pela suíte.

## 4. Uma melhoria de manutenção

O teste `v1119` (que garante que todo botão do HTML tem a "ponte" correspondente no código) tinha a
lista de módulos escrita à mão — e quebrou quando `js/tema.js` foi apagado. Agora ele **lê a pasta
`js/` inteira**: módulo novo entra sozinho, módulo apagado sai sozinho. Mesma ideia que o executor
da suíte já usa pra descobrir os testes desde a v1092.

## Conferência na tela (obrigatória)

App publicado (`public/`) em Chromium headless, **390×844** e **1440×900**, com a preferência antiga
`direciona_tema=light` gravada no aparelho antes de recarregar:

| | celular | computador |
|---|---|---|
| tema aplicado | `dark` | `dark` |
| fundo | petróleo oficial | petróleo oficial |
| seletor de tema na tela | não existe | não existe |
| cor da barra do navegador | `#052B36` | `#052B36` |
| erros de página | nenhum | nenhum |

## Testes

`tests/v1268-tema-unico-e-faxina.test.mjs` (novo) trava as duas metades: o tema claro não volta por
nenhuma porta (CSS, `prefers-color-scheme`, seletor na tela, módulo, arquivo, variáveis de boot) e o
código morto retirado não volta a se acumular. Inclui a checagem de chaves balanceadas do CSS.

Ajustados por citarem regras que deixaram de existir: `v874`, `v875`, `v879` (reescrito), `v1119`,
`v1146`, `v1165`, `v1197`, `v1214`, `v1234`.

Suíte completa verde: 23 arquivos + 424 testes.
