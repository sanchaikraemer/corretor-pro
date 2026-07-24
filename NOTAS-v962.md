# v962 — auditoria de dados subestimava duplicidade + backup completo esquecia o Cérebro

## Contexto

Revisão linha a linha de `api/leads-recentes.js` (189 linhas) — lista de leads recentes (com
cache de 5s) + duas ferramentas de bastidor: `?audit=1` (auditoria de qualidade dos dados) e
`?export=full` (backup completo em JSON). Dois bugs reais.

## 1. Auditoria (`?audit=1`) subestimava duplicidade quando havia muitas

`gerarAuditoriaDados` monta a lista de "possíveis duplicados por telefone/nome" e já cortava os
exemplos em 50 (razoável — é só uma amostra pra mostrar). O problema: o CONTADOR usado no resumo
(`possiveisDuplicadosTelefone`/`possiveisDuplicadosNome`) e na mensagem de `problemas` vinha da
lista JÁ CORTADA — com mais de 50 grupos duplicados de verdade, o relatório dizia "50 possíveis
duplicidades" (o teto), escondendo quantas realmente existiam. Numa ferramenta cujo propósito é
justamente flagar problema de dado, subestimar o problema é o pior tipo de bug possível pra ela.

Fix: o contador agora vem da lista completa (antes do corte); só a lista de EXEMPLOS
(`duplicados.porTelefone`/`porNome`) continua limitada a 50 registros.

## 2. "Backup completo" não incluía o Cérebro

`exportarTudo` (`?export=full`, `type: "corretor-pro-full-backup"`) exportava
`whatsapp_processamentos` + `direciona_leads` + `leads` + `corretor_pro_backups`, mas NUNCA
`direciona_config` — a tabela onde mora o Cérebro (persona, regras, conhecimento configurado
pelo corretor, ver CLAUDE.md). Um restore a partir desse "backup completo" recuperaria todos os
leads, mas a IA voltaria a analisar sem NENHUMA configuração do corretor — o nome da função
("exportar tudo") não cumpria a promessa.

Fix: `direciona_config` entrou na lista de tabelas exportadas. Mudança aditiva — não muda nada
do que já era exportado, só acrescenta uma tabela a mais (e como `readTable` já trata
tabela-com-erro/vazia sem quebrar o resto, não tem risco de regressão se essa tabela não existir
em algum ambiente).

## Verificação

- `npm test` verde, incluindo `v962-leads-recentes-auditoria-e-backup`: simula 60 grupos de
  telefone duplicado e confirma que o resumo conta 60 (não 50); confirma que o placeholder
  "Cliente importado/a" continua fora da contagem de duplicidade (comportamento já correto,
  travado por teste agora); confirma que `direciona_config` está na lista de `exportarTudo`.
- `node --check api/leads-recentes.js` OK.
- `gerarAuditoriaDados` virou export (só pra testar direto, sem mudar nada do handler).

## Achado, não corrigido (mesmo padrão recorrente)

`readTable` pagina de verdade (via `.range()` em loop, não um `.limit()` fixo — mais cuidadoso
que os outros arquivos já revisados), mas ainda tem um teto rígido de 20.000 linhas totais por
tabela. Mais alto que os outros tetos encontrados (5000/3000/10000), mas é a mesma classe de
achado de escala — registrado, não corrigido.

## Arquivos
- `api/leads-recentes.js` (`gerarAuditoriaDados` — contagem + export; `exportarTudo` —
  `direciona_config`), `tests/v962-leads-recentes-auditoria-e-backup.test.mjs` (novo),
  `package.json`/`package-lock.json`, `NOTAS-v962.md`, versão **961 → 962**.
