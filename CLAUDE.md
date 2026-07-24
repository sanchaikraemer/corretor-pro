# Corretor Pro — instruções para sessões do Claude Code

## Regra obrigatória (não negociável)

**Sempre que alterar `app.js`, qualquer arquivo em `api/`, `index.html`, `styles.css` ou
`service-worker.js`, suba a versão em `package.json` (`version` e `displayVersion`) antes
de finalizar o trabalho.** Não pule essa etapa e não pergunte se deve fazer — é sempre sim.

Convenção de versão a partir de agora (chega de fração `-M`):
- A série antiga `827-N` está encerrada. A próxima atualização começa em **846** e cada
  atualização seguinte incrementa **1 número inteiro** (`846`, `847`, `848`, ...) —
  sem sufixo `-M` nunca mais.
- `displayVersion` é só o número inteiro (ex.: `846`).
- `version` (semver) segue `7.NNN.0` acompanhando o `displayVersion` (ex.: `7.846.0`).
- Depois de mudar `package.json`, rode `npm install --package-lock-only` pra sincronizar
  o `package-lock.json`.
- Crie um `NOTAS-vNNN.md` descrevendo o que mudou e por quê, seguindo o formato dos
  arquivos `NOTAS-v*.md` já existentes no repositório (as notas antigas `NOTAS-v827-N.md`
  continuam valendo como histórico, só não usam mais esse padrão de nome).
- `build.js` lê a versão exibida direto do `package.json` (`displayVersion`, ou calculada
  de `version`) e substitui `__VERSION__` nos arquivos publicados — não crave versão em
  nenhum outro lugar do código.

## Como rodar a suíte antes de finalizar

```
npm test
```

Isso roda `node --check` em todos os arquivos de API + `app.js`/`build.js`/`service-worker.js`
e a suíte inteira de testes em `tests/*.test.mjs`. Qualquer alteração precisa manter isso
verde. Ao corrigir um bug, adicione um teste de regressão em `tests/` e inclua-o na lista
de comandos do script `test` em `package.json` (é uma cadeia de `&&`, não um runner que
descobre arquivos sozinho).

## Convenções já estabelecidas no projeto (ver NOTAS-v827*.md para o histórico completo)

- Nenhuma informação comercial (preço, empreendimento, condição, nome de pessoa) pode ser
  cravada no código. Tudo vem do **Cérebro** (configurado pelo corretor, salvo no Supabase
  na tabela `direciona_config`, chave `direciona-cerebro`) ou da própria conversa
  analisada. Na ausência de informação, a IA deve ficar em "Não identificado" — nunca
  inventar.
- A análise de uma conversa NUNCA pode ser descartada inteira só porque as 3 sugestões de
  mensagem não passaram nas regras do Cérebro na primeira tentativa (ver `api/_pipeline.js`,
  `construirMensagensDeterministicasCerebro` — fallback determinístico adicionado na v827-12
  depois desse exato bug travar a importação de forma intermitente).
- `api/_persistence.js`, `_pipeline.js` e as demais rotas de `/api` só podem existir dentro
  de `api/` — `build.js` bloqueia o build se aparecerem duplicadas na raiz.

## Acesso a produção

Esta sessão normalmente **não tem credenciais do Supabase nem acesso automático aos
projetos do Vercel do usuário** — não assuma que dá pra ler logs de produção ou consultar
o banco diretamente. Se precisar diagnosticar algo que só acontece em produção, peça print
do erro ou peça para o usuário liberar o acesso explicitamente.

## Como falar com o dono — ele é corretor de imóveis, não programador

O dono deste projeto **não é programador**, é corretor de imóveis. Nas respostas pra ele (fora
de comentário de código), nada de jargão técnico — sem nome de função, classe CSS, "commit",
"branch", "regex", "PR", etc. Fale do que muda **na tela**, no dia a dia dele, não de como o
código faz isso por dentro. Se for inevitável citar algo técnico, traduza na mesma frase.

## "Colocar no ar" já autoriza publicar — não pergunte nesse momento

Quando o dono pedir pra corrigir algo, implementar algo, ou disser (em qualquer variação) que
quer "o site no ar", "resolver e pronto", "publicar", "ponto final" — **isso já autoriza abrir o
Pull Request da branch de trabalho pra `main` e mesclar (merge) na hora, sem parar pra perguntar
de novo.** Essa autorização já foi pedida de forma explícita e repetida; não pergunte "quer que
eu abra o PR?" de novo — abra e mescle direto, e só depois avise que está no ar. Isso vale pro
fluxo normal de correção/feature deste projeto (é o que as sessões anteriores já faziam, ver
histórico de merges). Só pare pra confirmar antes de agir se a mudança sair desse fluxo normal —
ex.: apagar dados reais, mudar estrutura do banco, mexer em configuração de pagamento/cobrança.
