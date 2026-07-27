# NOTAS v1035 — Atalho do iPhone: mandar o ZIP do WhatsApp direto pro Corretor Pro

## O problema

No Android, quem instala o Corretor Pro na tela inicial consegue, no WhatsApp, tocar em
Compartilhar → escolher o ícone do Corretor Pro → pronto, a conversa já chega processada. No
iPhone isso **nunca funcionou e nunca vai funcionar assim** — a Apple só deixa um app aparecer
no botão Compartilhar de outro app quando é um aplicativo de verdade da App Store (o que exigiria
contratar a conta de desenvolvedor da Apple e manter um app separado — o dono já tinha pesquisado
isso e decidiu que não quer seguir esse caminho agora).

## A solução (sem custo de loja de aplicativo)

Usamos o app **Atalhos** (Shortcuts), que já vem de fábrica em todo iPhone. Um Atalho criado
pelo próprio corretor **aparece no botão Compartilhar igual um ícone de app apareceria** — então
dá pra chegar bem perto da experiência do Android: WhatsApp → Compartilhar → toca no atalho
"Corretor Pro" → a conversa já é processada e o lead já é salvo, sem precisar abrir o app nem
escolher arquivo manualmente.

## O que foi construído

**No Menu do Corretor Pro** (só aparece pra quem acessa pelo iPhone/iPad) — cartão novo
"Compartilhar direto do WhatsApp (iPhone)":
- Botão **"Gerar minha chave"**: cria uma chave pessoal daquela conta.
- Botão **"Copiar chave"**: copia a chave pra colar dentro do Atalho.
- Passo a passo completo de como montar o Atalho no app Atalhos (URL certa, cabeçalho com a
  chave, corpo da requisição, como ativar "Mostrar no Menu Compartilhar").
- Gerar uma chave nova invalida a anterior automaticamente (é assim que se "revoga" — sem botão
  de revogar separado).

**Por trás** (`api/`):
- `api/atalho-zip-token.js`: gera/mostra a chave pessoal (chamado de dentro do app, autenticado
  pelo login normal do corretor).
- `api/receber-zip-atalho.js`: recebe o ZIP mandado pelo Atalho, autenticado só pela chave
  pessoal (nunca pelo login do app — o Atalho não sabe renovar sessão sozinho). Processa a
  conversa e **já salva o lead sozinho** (diferente da importação manual, aqui não tem ninguém
  olhando a tela pra clicar em "Salvar").
- A chave é assinada (HMAC) e nunca fica guardada em texto puro em lugar nenhum — só a data em
  que foi gerada, reaproveitando a mesma tabela de configuração do Cérebro (`direciona_config`),
  sem precisar mudar a estrutura do banco.
- `api/_zipUpload.js` (novo): o parser de ZIP enviado direto no corpo do pedido, que já existia
  só dentro de `api/analisar.js`, foi separado pra ser reaproveitado pelas duas rotas sem duplicar
  código.

## ⚠️ Passo obrigatório antes de funcionar em produção

Esta sessão **não tem acesso às variáveis de ambiente da Vercel** — só o dono consegue configurar
isso. Sem esse passo, a rota do Atalho responde com erro "não configurado" (nada quebra pro resto
do app, só essa função nova fica indisponível até ser configurada):

1. No painel da Vercel → o projeto do Corretor Pro → **Settings → Environment Variables**.
2. Adicione uma variável chamada **`ATALHO_ZIP_TOKEN_SECRET`** com um valor secreto e comprido
   (ex.: gere uma sequência aleatória qualquer de 40+ caracteres — não precisa ser memorizável).
3. Salve e faça um novo deploy (ou aguarde o próximo).

Depois disso, o botão "Gerar minha chave" no Menu passa a funcionar.

## Verificação

- Novo teste `tests/v1035-atalho-ios-zip-token.test.mjs`: a rota bloqueia ANTES de ler o ZIP
  quando falta a chave, a chave é inválida, ou o servidor não está configurado; a lógica de
  assinatura resolve a organização certa com chave boa, rejeita chave revogada (trocada por
  outra) e rejeita conta bloqueada/teste vencido mesmo com chave válida.
- Novo teste `tests/v1035-atalho-ios-menu-ui.test.mjs`: o cartão existe no Menu, só é revelado
  pra iOS, busca/gera a chave nas rotas certas, monta a URL do endpoint dinamicamente (nunca
  cravada) e usa a Clipboard API pra copiar.
- `npm test`: suíte inteira verde (incluindo o guarda de autenticação `v963`, que passou a aceitar
  também `resolveOrganizationIdByAtalhoToken` como checagem válida).
- `npm run build`: build limpo, versão 1035.
- Não testado num iPhone real dentro desta sessão (sem acesso a um aparelho Apple) — o passo a
  passo do Atalho foi escrito com bastante detalhe pra reduzir risco, mas vale o dono confirmar
  com o primeiro corretor que testar e avisar se algum passo do app Atalhos estiver diferente do
  descrito (a Apple muda a interface do Atalhos de vez em quando entre versões do iOS).

## Arquivos

`api/_persistence.js` (`resolveOrganizationIdByAtalhoToken`, `montarAtalhoZipToken`), 
`api/atalho-zip-token.js` (novo), `api/receber-zip-atalho.js` (novo), `api/_zipUpload.js` (novo,
extraído de `api/analisar.js`), `api/analisar.js` (passa a reaproveitar `_zipUpload.js`),
`index.html` (cartão no Menu), `js/pwa-install.js` (lógica do cartão), `vercel.json`
(`maxDuration` da rota nova), `tests/v963-todas-rotas-exigem-api-key.test.mjs` (passa a aceitar
o novo mecanismo de autenticação), `tests/js-pwa-install-module.test.mjs` (ajustado pro import
novo de `escapeHtml`), `tests/v1035-atalho-ios-zip-token.test.mjs` (novo),
`tests/v1035-atalho-ios-menu-ui.test.mjs` (novo), `package.json`/`package-lock.json`,
`NOTAS-v1035.md`, versão **1034 → 1035**.
