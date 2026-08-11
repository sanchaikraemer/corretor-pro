# v1210 — Reativar dentro do lead, e a busca/importação param de esconder o que existe

Três coisas relatadas pelo dono na mesma noite (11/08/2026), todas com print. A primeira é o pedido
direto; as outras duas são o que os prints seguintes mostraram.

## 1. O botão "Reativar" agora existe dentro do lead

Pedido dele: *"coloca o botão Reativar dentro do lead também"*.

Até aqui, reativar um cliente arquivado só era possível pela lista da tela **Arquivados**. Quem
achasse o cliente pela busca da tela Hoje (que mostra os arquivados com a tarja desde a v1093) e
abrisse o lead ficava sem saída: a barra de cima oferecia **Arquivar** — o que ele já era — e nada
mais.

Agora **o mesmo lugar da barra troca de papel**: mostra **Arquivar** quando o lead está ativo e
**Reativar** (com o ícone da caixa e a seta pra cima) quando ele já está arquivado. Ao reativar dali,
o app pergunta a confirmação de sempre, devolve o cliente aos atendimentos ativos e redesenha o lead
na hora — o botão volta a ser "Arquivar", sem precisar sair e entrar de novo.

## 2. A busca da tela Hoje não diz mais que um cliente "não existe" sem ter certeza

Relatos: *"fiz a busca e só apareceu um Tales"*, *"tb só tem um joel"*.

A busca varre a carteira completa, mas ela chega em segundo plano depois que o app abre. Antes disso,
a busca varria **apenas os leads que a Home já tinha na mão** — e o resultado curto passava a
impressão de que o cliente não existia. Pior: quando a carteira completa terminava de chegar, a lista
na tela **não era refeita**; era preciso apagar e digitar tudo de novo pra ver o resto.

Agora: a busca é **refeita sozinha** assim que a carteira completa chega (se o que está digitado ainda
for o mesmo), e enquanto ela não chegou o resultado avisa, em letra pequena: *"Ainda carregando o
restante da sua carteira — a lista pode crescer em instantes."*

## 3. Na importação, dá pra saber QUEM é o "cliente que já existe"

Relato: *"agora tudo tá parecido com outro q não aparece na busca nem ativo nem arquivado"*.

Quando o nome importado é parecido (mas não idêntico) com um cadastro que já existe, o app pergunta se
é o mesmo cliente. Só que a caixa mostrava **um nome e mais nada** — sem jeito de conferir sem sair da
importação. E tem um detalhe que confundia de vez: o cadastro antigo costuma ter o nome **curto**
(ex.: "Gabriel Chaves"), enquanto a importação traz o nome **com o empreendimento no fim** ("Gabriel
Chaves Renaissance"). Procurar pelo nome longo não acha o curto — e parece que o app inventou um
cliente.

A caixa agora mostra:

- **o que é aquele cadastro**: ativo ou arquivado, o empreendimento e há quantos dias está parado;
- **o efeito do "Sim"**: a conversa entra naquele cadastro e ele **passa a se chamar como esta
  importação** — que é exatamente o motivo de o nome antigo sumir da busca depois de juntar.

Nada mudou na regra de juntar ou separar: nome só parecido nunca funde sozinho, continua sendo
pergunta (v1176).

## Arquivos alterados

- `app.js` — botão da barra do lead montado por estado (`cp704BotaoEtapa`), `reativarLeadArquivado`
  preparado pra botão com ícone (não apaga mais o desenho ao mudar o texto) e redesenho do lead
  aberto, busca da Home refeita quando a carteira completa chega + aviso de lista incompleta,
  `normalizarEtapa` exportada.
- `js/importacao.js` — a caixa do cadastro parecido mostra situação, empreendimento, tempo parado e o
  aviso da renomeação.
- `tests/v1210-reativar-dentro-do-lead.test.mjs` — guarda das três mudanças (o botão é executado de
  verdade nos dois estados do lead).
- `tests/v904-somente-arquivar.test.mjs` e `tests/v908-acoes-topo-e-atendimentos-dia.test.mjs` —
  atualizados: o botão daquela posição agora é montado por `cp704BotaoEtapa`, e as regras que eles
  guardam (um só desfecho, ícone com rótulo na barra) continuam conferidas dentro dele.
- `package.json` / `package-lock.json` — versão 1210.
