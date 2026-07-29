# NOTAS v1073 — revisão noturna completa: app mais leve e mais rápido, bug do Reativar corrigido

## Contexto

Pedido do dono ao fim do dia: revisar o sistema inteiro mais uma vez, conferir se algo ficou pra
trás das rodadas anteriores, limpar código e pastas, e aplicar tudo que desse pra deixar o app
mais rápido — sem quebrar nada. Trabalho feito de madrugada, de forma autônoma, com a suíte de
testes rodada (verde) depois de cada etapa.

## 1. BUG REAL corrigido: o botão "Reativar" (Arquivados) estava quebrado desde a v1069

O "Reativar" ainda mandava pro servidor o valor antigo de funil ("Atendimento") — que a v1069
passou a recusar (só existem "Ativo" e "Geladeira"). Na prática, reativar um lead arquivado
falhava SEMPRE com "Erro ao reativar." desde anteontem. Corrigido pra mandar "Ativo", com teste
de regressão que também confere que nenhum outro botão manda valor de etapa inválido
(`tests/v1073-reativar-manda-etapa-valida.test.mjs`).

## 2. App muito mais leve no celular: ~800KB → ~510KB

Duas frentes somadas:

**a) Compressão na publicação** (`build.js` + esbuild): os arquivos `.js`/`.css` publicados agora
vão sem comentários e sem espaços — SÓ isso (nenhum identificador é renomeado, nenhuma lógica é
reescrita; renomear quebraria os cliques do HTML que chamam funções pelo nome). Se o compressor
faltar ou falhar, o build publica o arquivo como está — compressão nunca derruba uma publicação.
Teste: `tests/v1073-build-comprime-sem-renomear.test.mjs`.

**b) Faxina das últimas gerações mortas** (~1.100 linhas removidas do `app.js`): o arquivo ainda
carregava — e EXECUTAVA em todo boot — cinco "camadas de hotfix" antigas inteiras (cp694/695/696/
697/703), cada uma redefinindo as telas de Atendimentos/Condução que a geração final (cp788, no
fim do arquivo) substitui por completo. Eram renderizações duplicadas a cada troca de tela,
observador de mudanças na Home, timers e CSS injetado — tudo sem efeito visível, só custo.
Auditoria linha a linha antes de cada corte, preservando o que ainda era vivo:

- o spinner "Carregando sua carteira..." da Home (com vigia de 9s) — outra parte do app depende dele;
- o CSS da lista da Condução/Atendimentos (a tela viva usa exatamente essas classes);
- o "+" preso dentro da barra de baixo (sem esse CSS ele voltava a flutuar solto);
- a trava histórica de rolagem (correção de tela travada);
- uma ressincronização interna do `show()` que os blocos mortos faziam "por acaso" — recriada de
  propósito num lugar vivo (sem ela, navegações internas pulariam o polimento de transição/sininho).

Também saíram: o fluxo inteiro de "marcar atendimento pela lista" de uma tela que não existe mais,
o fluxo de editar/colar foto de avatar (sem nenhum botão vivo desde a reforma do Editar lead — a
EXIBIÇÃO das fotos já salvas continua normal), o modal antigo de "Agendar retorno" duplicado (a
tela do lead usa o painel novo), o modal órfão de "Nova oportunidade de parceiro", o relatório
.txt da carteira sem botão, e o botão "voltar ao topo" que ficava permanentemente escondido por
CSS há dezenas de versões (elemento, código e estilos — zero mudança visual).
Teste que trava tudo isso: `tests/v1073-faxina-geracoes-mortas.test.mjs`.

**styles.css** também emagreceu (~194KB → ~181KB na fonte): blocos inteiros sem nenhum uso
(quadro kanban antigo, linhas de fila removidas, gráfico de funil, tabela antiga da carteira,
regras de tema claro pra telas que não existem mais).

## 3. Servidor: exports mortos removidos

`api/_pipeline.js`: 4 funções exportadas sem nenhum chamador em lugar nenhum (resumo de modelos,
stub de compatibilidade de modelo comercial, sanitizador de materiais, atualizador de respostas
do corretor — este substituído há tempos pelo "aprender da carteira"). `api/_iaCusto.js`: 1.
As ações `lembrete-set`/`lembrete-clear`/`analise-comercial-set`/`nova-oportunidade-parceiro` de
`api/lead-update.js` ficaram (pequenas, cobertas por teste), mas estão documentadas em
`ESTADO-ATUAL.md` como sem chamador no app — candidatas a remoção futura, junto com a rota de
compatibilidade `api/analisar.js`.

## 4. Excel e repositório

- A coluna ETAPA do Excel exportado agora fala a mesma língua do app ("Ativo"/"Arquivado"), nunca
  o valor cru antigo do banco.
- Removida a pasta `prototipo-contas-empresas/` (protótipo morto do sistema de contas, superado
  pelas telas reais publicadas na v990).

## O que foi deliberadamente NÃO feito (e por quê)

- **Cache das categorias por lead nos renders** (ganho extra de velocidade em carteiras de 200+):
  os objetos de lead são alterados "no lugar" ao marcar atendimento — um cache ingênuo mostraria
  o lead na lista errada logo depois do clique. Precisa de invalidação bem testada; fica anotado
  pra uma versão futura com calma.
- **Remover a rota `api/analisar.js`**: só vale a pena quando precisar da vaga no teto de 12
  funções da Vercel; remover hoje adiciona risco sem benefício imediato.

## Verificação

- Suíte inteira (`npm test`) verde — incluindo os 3 testes novos desta versão e os ajustes nos
  testes antigos que miravam as gerações mortas removidas.
- `npm run build` limpo, com sintaxe do publicado revalidada (`node --check` em `public/`).

## Arquivos

`app.js`, `styles.css`, `index.html`, `build.js`, `api/_pipeline.js`, `api/_iaCusto.js`,
`ESTADO-ATUAL.md`, `tests/v1073-*.test.mjs` (3 novos), `tests/v1012` (assert atualizado pro
render vivo), `tests/v905` (assert do avatar atualizado), `package.json`/`package-lock.json`
(esbuild adicionado; versão **1072 → 1073**), `NOTAS-v1073.md` (este arquivo), pasta
`prototipo-contas-empresas/` removida.
