# v1196 — o "Período padrão dos áudios" sai da tela do Cérebro (a proteção fica por dentro)

Conversa com o dono (10/08/2026), na sequência da v1141: depois que a reimportação passou a
reaproveitar transcrição e análise já pagas, ele propôs apagar de vez o período dos áudios
("creio que seja melhor até deletarmos isso, e também limpar as linhas no código dessa função").

A resposta foi um caminho do meio, e ele topou ("vamos seguir conforme sua orientação, ou seja,
mantenha mas omita da tela"):

- **Apagar de vez sairia caro.** O período nunca fez diferença na reimportação (o que já foi
  transcrito volta de graça desde a v1141), mas na PRIMEIRA importação ele é a única proteção de
  custo: um cliente antigo com anos de conversa e centenas de áudios seria transcrito inteiro —
  e cada transcrição é paga. Importar uma carteira inteira sem esse recorte multiplicaria o custo
  de entrada sem ninguém pedir.
- **Mas ninguém precisava ver esse número.** O campo no Cérebro só gerava dúvida ("Dias de
  conversa considerados na importação: 90 — como assim?") e, na prática, ninguém ajustava.

## O que mudou

1. **O campo "Período padrão dos áudios" saiu da tela do Cérebro** (`index.html`). A seção
   "Configurações técnicas" agora começa em "Atendimentos por dia".
2. **A proteção continua idêntica por dentro**: toda importação segue transcrevendo só os áudios
   dos últimos 90 dias da conversa (mensagens escritas entram completas sempre), e o servidor
   segue com o mesmo recorte de sempre (`api/_pipeline.js`, intocado).
3. **Salvar ou zerar o Cérebro não rebaixa valor de ninguém.** Este era o risco escondido da
   remoção: `salvarCerebro`/`zerarCerebroTudo` liam o campo do formulário — com o campo ausente,
   a leitura viraria vazio e o save gravaria 90 por cima de quem tinha um valor próprio (ex.: 180),
   silenciosamente. Agora os dois usam `cpDiasImportacaoSalvo()`, que preserva o que já está salvo
   no aparelho (padrão 90 se não houver nada válido).
4. **O resultado da importação continua dizendo qual período foi aplicado** — honestidade mantida —
   mas sem o atalho "ajustar padrão", que levaria a um campo que não existe mais
   (`js/importacao.js`).

## Validação

| Verificação | Resultado |
|---|---|
| Suíte completa | 365 testes verdes |
| Teste de comportamento novo | `v1196-periodo-audios-sem-campo-na-tela` (campo ausente da tela; janela de 90 dias viva no servidor e no app; salvar/zerar preserva o valor salvo em vez de cravar 90) |
| Testes ajustados | `v1060-cerebro-regras-objecoes-em-acordeao` (campo saiu da lista de IDs), `v1141-importacao-sem-pergunta-de-periodo` (o bloco que guardava o campo agora guarda a ausência dele) |
| `npm run build` | ok, versão 1196 |
| Navegador de verdade | app publicado aberto em Chromium headless (390×844 e desktop): tela do Cérebro sem o campo, sem erro de JavaScript, seção "Configurações técnicas" íntegra começando em "Atendimentos por dia" |

## Arquivos alterados

**Código:** `index.html`, `app.js`, `js/importacao.js`

**Documentação:** `NOTAS-v1196.md` (novo)

**Versão:** `package.json`, `package-lock.json`

**Testes:** `tests/v1196-periodo-audios-sem-campo-na-tela.test.mjs` (novo),
`tests/v1060-cerebro-regras-objecoes-em-acordeao.test.mjs`,
`tests/v1141-importacao-sem-pergunta-de-periodo.test.mjs`
