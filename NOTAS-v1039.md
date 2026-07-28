# NOTAS v1039 — Publicações travadas há dias: 12 funções é o limite do plano gratuito da Vercel

## O relato

O dono testou a tela de "Uso de IA por empresa" (v1038) e não conseguiu ver nada, mesmo depois
de recarregar em aba anônima. Pedi print do painel da Vercel e o motivo apareceu na hora: a
publicação mais recente (a da v1038) tinha falhado com o erro:

> **Build Failed** — No more than 12 Serverless Functions can be added to a Deployment on the
> Hobby plan.

E mais grave: a produção estava travada numa versão de **antes até da correção de segurança da
v1037** (commit da v1027, quatro versões atrás). Ou seja, desde a atualização do Atalho do
iPhone (que criou 2 rotas novas e levou o total de 11 pra 13, passando do limite de 12 do plano
gratuito), **nenhuma publicação seguinte foi ao ar** — nem a v1027, nem a v1037 (o vazamento de
dados entre empresas), nem a v1038. O site continuou funcionando com o código antigo, sem erro
visível pro usuário, o que escondeu o problema até agora.

## A causa raiz

Cada arquivo em `api/` com rota própria vira uma "Serverless Function" na Vercel. O plano
gratuito (Hobby) permite no máximo 12 por publicação. O projeto tinha chegado a 14:

`admin-contas, admin-uso-ia (v1038), analisar, atalho-zip-token, cerebro-config,
criar-upload-url, diagnostico, lead-update, leads-recentes, limpar-tudo, processar-storage,
reanalisar-lead, receber-zip-atalho, restaurar-leads`

## A correção

Juntei duas rotas em outras já existentes — sem tirar nenhuma funcionalidade, sem mudar nenhum
endereço que o site ou o Atalho do iPhone já usam:

- **`api/admin-uso-ia.js` → dentro de `api/admin-contas.js`** (`GET ?relatorio=uso-ia`). As duas
  rotas já eram exclusivas do administrador da plataforma — só juntei os dois relatórios num
  arquivo só. `admin-plataforma.html` foi ajustado pra chamar o endereço novo.
- **`api/criar-upload-url.js` → dentro de `api/processar-storage.js`**. O endereço antigo
  (`/api/criar-upload-url`) continua funcionando exatamente igual — o `vercel.json` agora
  redireciona essa chamada pro arquivo novo por baixo dos panos, sem o site precisar saber disso.

Voltamos de 14 pra **12 rotas** — dentro do limite do plano gratuito.

**O que eu considerei e descartei:** também cheguei a juntar `api/atalho-zip-token.js` com
`api/receber-zip-atalho.js` (chegaria a 11 rotas, com folga). Desisti dessa parte: as duas rotas
têm formas de autenticação diferentes (uma pelo login do corretor, outra pela chave do Atalho) e
não achei um jeito 100% confiável de diferenciar automaticamente uma chamada da outra sem
arriscar enfraquecer a proteção da rota que recebe o ZIP do iPhone — segurança não é lugar pra
solução "quase certa". Com 12 rotas já resolvemos a publicação; essa parte fica pra uma próxima
vez, com mais calma.

## Verificação

- Contagem de rotas reais em `api/` (arquivos com `export default async function handler`):
  confirmada em 12 antes de publicar.
- `npm test`: suíte inteira verde. Ajustei 3 testes que liam os arquivos antigos diretamente
  (`v825-storage-pipeline`, `v960-sem-acento-unicode-literal`, o teste da v1038 que importava
  `admin-uso-ia.js`) pra apontar pros arquivos novos — o comportamento continua sendo o mesmo,
  só mudou onde o código mora.
- `npm run build`: build limpo.
- **Ainda não testado no site publicado** — depende do deploy terminar. Assim que a publicação
  ficar "Ready" na Vercel, preciso confirmar: a tela de Uso de IA aparece, o botão "Backup" da
  Carteira, o Atalho do iPhone e o upload de ZIP grande continuam funcionando.

## Uma recomendação pro dono

O limite de 12 funções do plano gratuito da Vercel volta a ser um risco toda vez que uma rota
nova for criada sem consolidar outra. Duas saídas pra não passar por isso de novo:
1. Continuar consolidando rotas relacionadas em um arquivo só (é o que fizemos aqui, e o projeto
   já fazia isso antes — ver comentário em `api/diagnostico.js` sobre a mesma economia).
2. Passar pro plano pago (Pro) da Vercel, que aumenta bastante esse limite — é uma decisão sobre
   custo mensal, então fica pra você decidir, não é algo que eu troque sozinho.

## Arquivos

`api/processar-storage.js` (absorveu `criar-upload-url.js`), `api/admin-contas.js` (absorveu
`admin-uso-ia.js`), `vercel.json` (redirecionamento pro endereço antigo de upload),
`admin-plataforma.html` (endereço novo do relatório de uso de IA),
`tests/v825-storage-pipeline.test.mjs`, `tests/v960-sem-acento-unicode-literal.test.mjs`,
`tests/v1038-telemetria-uso-ia.test.mjs` (ajustados), `package.json`/`package-lock.json`
(versão + lista de `node --check`), `NOTAS-v1039.md`, versão **1038 → 1039**. Removidos:
`api/criar-upload-url.js`, `api/admin-uso-ia.js`.
