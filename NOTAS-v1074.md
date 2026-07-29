# NOTAS v1074 — fim das fotos de avatar salvas + Menu sem a porta duplicada "Condução"

## Contexto

Dois pedidos do dono na sequência da revisão noturna (v1073):

1. **"pode deletar fotos salvas até pq não aparecem, já disse que o que não está no layout atual
   deve deletar junto com seus resquícios de código"** — a v1073 tinha removido o fluxo de
   editar/colar foto de avatar (sem botão vivo), mas mantido a EXIBIÇÃO das fotos já salvas.
   O dono confirmou que elas não aparecem no uso real e mandou remover tudo, inclusive perdendo
   as fotos gravadas.
2. **"no menu tem (condução), e isso é a mesma coisa que o painel na home, então quero que delete
   'condução' bem como seus códigos, linhas e resquícios"** — as portas de menu pra tela Condução
   eram redundantes com o painel da Home.

## 1. Foto de avatar: removida por inteiro (front + servidor)

O avatar dos leads agora é SEMPRE o círculo com as iniciais do nome (que é o que já aparecia na
prática). Saiu:

- **app.js**: o ramo que desenhava `<img>` quando existia foto salva (`avatarInicial` perdeu o
  parâmetro de foto; `avatarLead` só passa o nome) e o trecho que espelhava foto recebida em
  patch pros caches locais.
- **styles.css**: as 2 regras da foto dentro do círculo (`.lead-avatar.has-foto` e a do `img`)
  e uma regra órfã da Fila inteligente (`.fila-row .lead-avatar` — a fila nunca desenhou avatar
  desde a v869).
- **api/lead-update.js**: aceitação do campo de foto no criar manual e no editar dados (a
  validação do editar agora diz "Informe nome, telefone ou produto pra editar."), e a
  preservação da foto anterior na atualização com evolução.
- **api/_persistence.js**: a busca da foto de um registro anterior na reimportação
  (varria até 500 registros no banco A CADA importação sem foto — custo puro), a preservação na
  mesclagem de análises, o campo na lista compacta da carteira e a herança de foto na
  deduplicação da listagem (2 estruturas por carga de lista a menos).

**Sem apagão no banco**: nenhum dado é deletado em massa. As fotos antigas simplesmente deixam
de ser lidas/preservadas e somem naturalmente conforme os registros evoluem (autorizado pelo
dono). Bônus real de performance: a importação de conversa nova deixa de fazer uma consulta
pesada só pra procurar foto antiga, e a carga da carteira trafega menos dados.

## 2. Menu sem "Condução" (as 2 portas duplicadas saíram; a da Home fica)

- Saiu o item **"Condução"** da gaveta/menu lateral e o card **"Condução do atendimento"** da
  tela "Mais" (Menu).
- A tela Condução em si **continua existindo e funcionando** — a porta oficial é a da Home:
  painel "Condução da carteira" → botão **"Abrir Condução"** (além dos avisos do sininho e do
  botão "Abrir prioridades de hoje", que já apontavam pra lá).
- Resquícios removidos no código: a função que acendia a porta de menu da Condução conforme a
  aba ativa (`destacarMenuPipeline`, chamada em TODA troca de tela — menos um laço por navegação)
  e o reset de aba que só disparava clicando nas portas removidas. As abas internas da própria
  tela (Oportunidades/Últimos/Todos) continuam.

## Testes

- Novo: `tests/v1074-sem-foto-avatar-e-sem-conducao-no-menu.test.mjs` — trava que nenhum
  resquício de foto de avatar volte (front, CSS e servidor), que as iniciais continuem, que as
  portas de menu da Condução não voltem e que a tela + porta da Home continuem existindo.
- Ajustados: `v866-ui-limpeza` e `v873-menu-mobile` (não exigem mais o card "Condução do
  atendimento" no Menu) e `v905-limpeza-7-itens` (comentário do avatar atualizado — a âncora
  `function avatarLead(` continua valendo, agora como iniciais).

## Verificação

- Suíte inteira (`npm test`) verde.
- `npm run build` limpo.

## Arquivos

`app.js`, `index.html`, `styles.css`, `api/lead-update.js`, `api/_persistence.js`,
`tests/v1074-*.test.mjs` (novo), `tests/v866-ui-limpeza.test.mjs`,
`tests/v873-menu-mobile.test.mjs`, `tests/v905-limpeza-7-itens.test.mjs`,
`package.json`/`package-lock.json` (versão **1073 → 1074**), `NOTAS-v1074.md` (este arquivo).
