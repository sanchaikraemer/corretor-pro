# NOTAS v1037 — Vazamento entre empresas: "Backup", "Auditar" e "Apagar tudo" liam/apagavam a base inteira do SaaS

## O relato

O dono trouxe duas análises externas (uma auditoria técnica/comercial completa do sistema e uma
avaliação sobre um app nativo pro iPhone) pra revisão. A auditoria apontou, como risco crítico de
segurança, que rotas administrativas do sistema não filtravam por empresa e podiam vazar dados
entre contas. Conferindo no código de hoje, o achado se confirmou — e é mais grave do que "se a
chave vazar": os botões afetados já ficam à mão de **qualquer corretor logado**, na tela normal
dele, sem precisar de nenhuma chave especial.

## A causa raiz

O app.js anexa a chave compartilhada antiga (`CORRETOR_PRO_API_KEY`) automaticamente em **toda**
chamada à API, pra qualquer corretor logado (é o mecanismo que sustenta compatibilidade com o
login antigo). Três rotas confiavam só nessa chave pra liberar acesso, sem filtrar por
`organization_id`:

- `api/leads-recentes.js?audit=1` (botão **"✓ Auditar"** da Carteira) — lia `whatsapp_processamentos`
  inteira, de todas as empresas.
- `api/leads-recentes.js?export=full` (botão **"🛡 Backup"** da Carteira) — baixava em JSON os leads
  E o Cérebro (`direciona_config`) de **todas** as empresas do sistema, não só a de quem clicou.
- `api/limpar-tudo.js` (botão **"Apagar tudo"** das Configurações) — quando a variável de ambiente
  `DIRECIONA_DANGER_LIMPAR_TUDO=ativo` está ligada no servidor, apagava `whatsapp_processamentos`,
  `leads` e `direciona_leads` de **todas** as empresas de uma vez, além de esvaziar o bucket de
  Storage inteiro (ZIPs e áudios extraídos de todo mundo).

Ou seja: qualquer corretor comum, numa conta comum, clicando num botão comum da própria tela dele,
conseguia baixar (ou apagar) os dados de todos os outros clientes do SaaS.

## A correção

`api/leads-recentes.js`:
- `readTable` passa a aceitar um `organizationId` e filtrar por ele (`.eq("organization_id", ...)`).
- `auditarDados`/`exportarTudo` usam a **mesma identidade já resolvida** por `resolveOrganizationId`
  no início do handler (login real do corretor, ou a empresa principal no caminho antigo da chave
  compartilhada) — nunca mais uma leitura sem filtro.
- `leads`, `direciona_leads` e `corretor_pro_backups` são tabelas legadas de antes do multiempresa,
  sem coluna `organization_id` — só pertencem à empresa original. Agora só entram no backup quando
  quem pediu é a própria empresa principal.

`api/limpar-tudo.js`:
- Mesma identidade (`resolveOrganizationId`) substituindo o `requireApiKey` solto.
- `deleteAllRows`/`tableCount` passam a filtrar por `organization_id` quando aplicável.
- `leads`/`direciona_leads` só são apagadas quando quem pediu é a empresa principal (mesma razão
  acima: tabelas legadas sem coluna de empresa).
- A limpeza do Storage deixa de esvaziar o bucket inteiro e passa a usar os dois mesmos prefixos
  já usados pela exclusão de conta (`api/admin-contas.js`): `whatsapp/organizations/{id}` e
  `organizations/{id}` — nunca toca em arquivo de outra empresa.

Nenhuma das duas rotas ficou mais restrita pra quem sempre as usou (a empresa principal, sem login
novo): elas continuam funcionando exatamente como antes, incluindo as tabelas legadas. A mudança
real é que **qualquer outra empresa** passa a só enxergar/apagar os próprios dados.

## Verificação

- Novo teste `tests/v1037-backup-auditoria-limpartudo-isolam-empresa.test.mjs`: bate nas duas rotas
  de verdade contra um servidor HTTP falso e prova, nos dois sentidos —
  1. uma empresa qualquer só lê/apaga a própria `organization_id`, nunca a base toda, e nunca toca
     nas tabelas legadas nem em arquivo de Storage fora do próprio prefixo;
  2. a empresa principal continua incluindo as tabelas legadas, sem regressão.
- `npm test`: suíte inteira verde (todos os testes anteriores + o novo).
- `npm run build`: build limpo, sem duplicidade nem arquivo fora do lugar.

## O que fica pra depois

A auditoria trouxe outros pontos críticos que não cabem nesta correção pontual (peço prioridade
pro dono decidir a ordem): controle atômico de custo/limite de IA, proteção contra abuso do teste
grátis, `organization_id` obrigatório por restrição do próprio banco (hoje só o código evita
gravar sem empresa), e dividir o `app.js` (14 mil linhas) em módulos menores. Ficam registrados
pra próxima rodada.

## Arquivos

`api/leads-recentes.js`, `api/limpar-tudo.js`, `tests/v1037-backup-auditoria-limpartudo-isolam-empresa.test.mjs`
(novo), `package.json`/`package-lock.json` (script `test` + versão), `NOTAS-v1037.md`, versão
**1036 → 1037**.
