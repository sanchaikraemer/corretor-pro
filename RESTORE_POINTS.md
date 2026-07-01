# Pontos de restauração ativos

## Ponto #665 — 2026-07-01 — Importação cria o bucket sozinho quando ele some

- A rota que prepara o envio do ZIP passa a criar o bucket do Storage automaticamente quando ele não existe (foi apagado ou nunca criado), em vez de só tentar ajustá-lo.
- Se a geração da URL de upload falhar por bucket ausente, o servidor força a criação e tenta gerar a URL mais uma vez antes de desistir.
- A mensagem de erro do app passa a incluir o detalhe técnico do servidor, facilitando identificar a causa real quando algo falha.

## Ponto #652 — 2026-06-30 — Navegação sob demanda e fim dos cliques duplicados

- Inicialização deixa de montar Pipeline, Agenda, Carteira, Vendas e relatórios escondidos; somente a Home é processada na abertura.
- Removido listener duplicado que fazia determinados cliques executarem a navegação duas vezes.
- Troca de tela ocorre antes dos cálculos, e telas já renderizadas são reutilizadas enquanto os dados não mudam.
- Pipeline deixa de renderizar duas vezes a mesma base em memória.
- Carteira renderiza 80 leads por lote, sem limitar a quantidade total disponível.
- Abertura do lead mostra skeleton imediatamente e monta o histórico integral em tempo ocioso, sem bloquear a interação.
- API de listagem evita cópias completas da timeline e reduz a análise enviada aos campos usados na navegação.
- Histórico e análise completos continuam disponíveis no detalhe individual; nenhuma conversa é cortada em 40 mensagens.

## Ponto #651 — 2026-06-30 — Histórico completo sem travar a navegação

- Remove a limitação de 40 mensagens por lead: o banco e a tela do lead preservam e carregam o histórico completo.
- A carteira geral envia somente uma prévia das 8 mensagens mais recentes, além da contagem total e sinais derivados; o histórico integral é buscado apenas ao abrir o lead.
- Abertura do lead em duas etapas: conteúdo e diagnóstico aparecem imediatamente com os dados em memória; o histórico completo entra em seguida sem bloquear o clique.
- Renderização progressiva do histórico em blocos de 100 mensagens, com botão para carregar as anteriores, evitando milhares de elementos no DOM de uma vez.
- Pipeline, Agenda, Carteira e Desempenho deixam de forçar nova busca da base inteira a cada entrada.
- Uma única busca alimenta recentes, busca global e dashboard; chamadas simultâneas continuam deduplicadas.
- API de listagem deixa de devolver campos pesados desnecessários, usa prévia de 8 mensagens e cache privado em memória por 30 segundos; mutações podem forçar leitura fresca.
- Copiar histórico, CSV e relatório carregam todas as mensagens sob demanda, sem usar a prévia como se fosse o histórico completo.

## Ponto #650 — 2026-06-25 — Corta o download gigante que travava o app no celular

- Causa raiz do "demorado de não dá pra usar": a API leads-recentes devolvia a
  CONVERSA INTEIRA de cada lead (todas as mensagens, com áudios transcritos).
  Medido: ~31 MB para 800 leads com histórico real. O celular travava ao baixar
  e parsear esse JSON a cada carga (a renderização em si era rápida: ~28ms).
- Servidor passa a enviar só as últimas 40 mensagens por lead (a lista, o
  dashboard e a tela do lead usam só o histórico recente). Redução de ~70% no
  download (31 MB → 9,3 MB no teste). Dedupe continua usando a contagem completa.

## Ponto #649 — 2026-06-25 — Correção do travamento da Hoje (proposta sem JSON.stringify)

- Travamento desde 24/06: a contagem de "propostas sem retorno" na home fazia
  JSON.stringify da análise inteira de CADA lead (conversa grande) a cada render.
  Com a navegação instantânea carregando toda a base na memória, isso rodava
  sobre todos os leads e congelava o celular (medido: ~47ms/render com 2000 leads
  de análise pequena; com conversas reais, vários segundos).
- Trocado por contagem leve pela etapa do lead (Visita/Proposta, Negociação ou
  proposta em recentMessages), igual ao resto do app. Medido 118x mais rápido.
- Restaura o Direciona Corretor no ar (revert do upload acidental do LeveCRM na main).

## Ponto #648 — 2026-06-24 — UX home: instrução visível + botão "O que falar"

- Subtitle "Leads prioritários": explica o workflow ("Toque num lead → diagnóstico + mensagem pronta pra WhatsApp")
- Botão lead row: "Ver diagnóstico" → "O que falar" na home
- saudacaoDesktop adicionado ao HTML — texto de orientação agora aparece no desktop

## Ponto #647 — 2026-06-24 — Saudação correta, skeleton ao abrir lead, sem scrollbar no menu

- Saudação: corrigida desde o primeiro frame (antes dos dados carregarem)
- Abrir lead: skeleton imediato ao clicar — fim da tela em branco sem feedback
- Menu sidebar: scrollbar oculta (desktop e mobile drawer)

## Ponto #646 — 2026-06-24 — Motivo no lead row + cache 5 min + áudio desbloqueado

- Lead rows: linha de motivo adicionada (por que ligar agora) via ui631LeadMotivo
- CSS: .ui-row-motivo estilizado (11px, peso normal, cor suave)
- Cache TTL: aumentado de 60s para 5 min (LEADS_CACHE_TTL)
- Áudio: Permissions-Policy microphone=() → microphone=(self) — bloqueava microfone globalmente

## Ponto #645 — 2026-06-24 — Restauração: layout lista, versão no mobile, gravação de áudio

- Layout leads: grid CSS corrigido (era 5 colunas pro row de 3 itens → nomes cortados)
- Versão: substituída por placeholder __VERSION__ em index.html (sidebar + mobile + configurações)
- Versão no mobile: restaurada no header mobile (sb-ver-top) — removida sem pedido no v643
- Gravação de áudio: "Registrar atendimento" extraído do colapso duplo (ui631-advanced) e inserido diretamente no painel do lead — feature estava acessível mas enterrada 2 níveis abaixo

## Ponto #644 — 2026-06-24 — Correção crítica: dashboard renderizando + thresholds corretos

- Dashboard voltou a funcionar (ReferenceError ativos/quentes/compromisso/reaquecer corrigido)
- KPI "Reaquecer": limiar corrigido de 3 dias → 14 dias
- "Esfriando" (O sistema percebeu): limiar corrigido de 7 dias → 14 dias
- Todos os thresholds agora alinhados com a regra v640 (14+ dias sem contato)

## Ponto #643 — 2026-06-24 — Revisão visual completa: header, KPIs, listas, pipeline

- Header mobile limpo: versão removida, pill de leads removido, subtítulo removido
- h2 dinâmico: horário correto (Bom dia/Boa tarde/Boa noite) com nome do corretor
- Saudação com contexto: quantos leads pra atender hoje
- KPI "Com compromisso" → "Agenda" (não quebra em 2 linhas)
- KPI min-height removido (cards mais compactos)
- Pipeline: threshold quentes alinhado com home (40%/60%/fallbacks)
- Pipeline: reaquecer 14 dias (era 3)
- Pipeline: etapas reais (Novo, Atendimento, Visita/Proposta, Negociação, Standby)
- Pipeline: filtros em scroll horizontal no mobile (não mais grid 2 linhas)
- Lead rows: ação curta e específica (Negociação/Visita/Retomar/Agenda/Quente)
- Lead rows: "Último contato" substituído por contagem de dias simples (ex: "14d")

## Ponto #642 — 2026-06-24 — Navegação instantânea + avatar removido da Carteira

- Carteira, Pipeline, Agenda e Relatório agora usam dados em memória (state.todosLeads) quando disponíveis — sem esperar rede ao trocar de tela.
- Avatar colorido (quadradinhos com iniciais) removido da tabela da Carteira.

## Ponto #641 — 2026-06-24 — Skeleton de carregamento na home

- Enquanto os leads carregam pela primeira vez, exibe blocos animados (KPIs + linhas) em vez de tela em branco.

## Ponto #640 — 2026-06-24 — Reaquecer: threshold 14 dias

- Reaquecer agora exige 14+ dias sem contato (era 7 dias).

## Ponto #639 — 2026-06-24 — Dashboard sem travamento + Quentes corrigido + Reaquecer mais preciso

- Dashboard usa cache em memória para renderizar imediatamente; busca fresca em segundo plano.
- Quentes agora conta leads com probabilidade >= 40%, probabilidade bruta >= 60%, interesse alto, ou em etapa Negociação/Visita.
- Reaquecer agora exige 7+ dias sem contato (era 3 dias — contava quase todos os leads).

## Ponto #638 — 2026-06-24 — Pipeline instantâneo + avatar removido da lista + agenda mostra todos os compromissos

- Pipeline usa dados em memória (state.todosLeads/itemsAtivos) e renderiza imediatamente sem "Carregando...".
- Avatar/quadradinhos coloridos removidos da lista de leads no Pipeline e Home.
- Agenda agora mostra TODOS os compromissos confirmados, agrupados: Hoje / Amanhã / Futuros (não só "hoje" e "amanhã").

## Ponto #637 — 2026-06-24 — Header do lead: badge removido, Voltar inline com produto

- "Atender agora" removido do header do lead.
- "Voltar pra Hoje" saiu do topo isolado e agora fica inline com o produto/subtítulo.
- Melhor aproveitamento de espaço em mobile.

## Ponto #636 — 2026-06-24 — Abertura de lead instantânea (busca em memória antes da rede)

- abrirLead agora busca o lead no state em memória (todosLeads, itemsAtivos, leads) antes de ir à rede.
- Elimina o "Carregando lead..." para leads já carregados na sessão.
- Cache atualiza em segundo plano sem bloquear a abertura.

## Ponto #635 — 2026-06-24 — 5 correções de UX: quentes, avatar, botão verde, contexto e espaço

- KPI "Quentes" agora inclui leads com tipoRetomada=quente-fechar ou temperatura=quente (não zerava mais).
- Avatar/foto removido do card hero da home (sem foto de cliente).
- Botão "Copiar mensagem" no hero card agora é coral (paleta do app), não verde.
- Na tela do lead, "Abrir WhatsApp" e "Copiar mensagem" movidos para dentro da seção de resposta (com contexto visual da mensagem).
- Header do lead compacto: nome + badge na mesma linha, sem desperdício de espaço.

## Ponto #634 — 2026-06-24 — Tela do lead reorganizada: ações em destaque, sem lixo no meio

- Botões "Abrir WhatsApp" e "Copiar mensagem" agora são grandes e destacados logo abaixo do nome do lead.
- Removido o bloco "Importar conversa" que aparecia no meio da tela do lead (lugar errado).
- Removidos os links redundantes "Análise do Cérebro" e "Resposta sugerida" que duplicavam conteúdo já visível.
- Ordem limpa: Nome → Ações → Diagnóstico → Resposta → Timeline → Mais detalhes.

## Ponto #633 — 2026-06-23 — Aceita ZIP até 750 MB no compartilhamento Android

- Limite do service worker aumentado de 100 MB para 750 MB para ZIPs compartilhados via share target.
- O app já enxugava o ZIP (mantém só texto + áudios) antes de enviar ao servidor, então o arquivo enviado é muito menor que o original.

## Ponto #632 — 2026-06-23 — Prioridade real: só entra em "atender hoje" quem tem sinal urgente

- Corrige bug crítico: o grupo padrão era "acao-hoje", fazendo todos os leads aparecerem como prioridade.
- Novo critério: lead só entra em "Atender agora" ou "Atender hoje" se tiver ao menos um sinal urgente real (cliente esperando resposta, promessa do corretor pendente, lembrete vencido, agenda, negociação ativa aguardando retorno ou parceiro com cliente final).
- Sem sinal urgente, o teto é "Retomar com cuidado" ou "Baixa prioridade" dependendo do score.
- Limiares ajustados: "Atender agora" exige urgente + score ≥ 70; "Atender hoje" exige urgente + score ≥ 40; sem urgente + score ≥ 40 vai para "Retomar com cuidado".
- Remove bloco tutorial "Como usar o Direciona hoje" da tela inicial.
- Banner de instalar app: cores atualizadas para coral, exibe ao abrir para usuários não instalados.

## Ponto #631 — 2026-06-23 — Redesenho estrutural das telas e ícone PWA atualizado

- Home/Hoje reconstruída com indicadores, fluxo de uso, status e prioridades.
- Lead/Diagnóstico reconstruído com diagnóstico, respostas e linha do tempo.
- Pipeline reconstruído com funil, métricas, filtros e lista priorizada.
- Menu reconstruído com acesso visual às funções.
- Navegação mobile com quatro abas; sidebar desktop com Carteira e Pipeline separados.
- Ícone PWA (favicon, 192px, 512px) atualizado: fundo azul-petróleo (#0C1D24) arredondado, balão branco-gelo (#E6EEF0) e seta coral (#FF6B5C), conforme Guia de Identidade Visual v1.0.
- Tipografia alinhada à identidade visual: Sora (títulos) e Inter (interface).
- Referências de ícone atualizadas para v=631 com background #0C1D24.

## Ponto #630 — 2026-06-23 — Nova identidade visual e temas claro/escuro

- Aplicada a nova identidade do Direciona Corretor com azul-petróleo, branco-gelo e coral.
- Nova marca vetorial baseada em diálogo + direção, com ícones PWA atualizados.
- Criados dois temas explícitos: Claro e Escuro azul-marinho, sem opção automática.
- Preferência de tema salva no navegador e aplicada antes da primeira pintura para evitar mudança visual ao carregar.
- Desktop, celular, sidebar, menu, cards, botões, formulários, pipeline e tela de diagnóstico receberam o novo sistema visual sem alterar as funções existentes.
- Incluído seletor de tema na lateral e em Configurações.
- Build e cache do Service Worker atualizados para publicar os novos arquivos de identidade.

## Ponto #629 — 2026-06-23 — Diagnóstico Jessica visível e obrigatório

- O diagnóstico comercial completo passa a aparecer aberto na tela do lead, antes da próxima ação e das sugestões; não fica escondido em “Por que o Direciona sugeriu isso?”.
- Leads analisados antes desta versão mostram um aviso visível pedindo reanálise, em vez de parecer que a atualização não mudou nada.
- O motor garante o objeto `analiseComercial` mesmo se o modelo omitir algum campo, sem inventar informações ausentes.
- A mensagem principal exibida e a seção “Mensagem que eu enviaria hoje” passam a usar a mesma resposta validada.
- A probabilidade em nota de 0 a 10 é sincronizada com o percentual final após as regras de coerência do sistema.

## Ponto #628 — 2026-06-23 — Diagnóstico comercial padrão Jessica

- Build passa a publicar Atualização #628 via RESTORE_POINTS.md, não apenas package.json.
- Motor de análise passa a gerar `analiseComercial` com 10 itens fixos: última pessoa a falar, compromisso, informação prometida, produto principal, paralelos, objeção, pendência financeira, próximo passo, etapa e interesse.
- Diagnóstico também inclui leitura da conversa inteira, mensagem ideal para enviar hoje e probabilidade de fechamento.
- Tela de análise renderiza esse novo bloco antes do raio-X antigo, mantendo compatibilidade com leads já salvos.

## Ponto #627 — 2026-06-23 — Revisão de segurança e corretude: 14 bugs corrigidos

- **Crítico — Remove execução de código remoto:** `_pipeline.js` e `_cerebro-orquestrado.js` paravam de usar `new Function(código_do_github)` para carregar o catálogo Senger; substituído por `parseSengerDataJs()`, extrator seguro que nunca executa código externo.
- **Crítico — SSRF bloqueado:** `cerebro-config.js` agora valida URLs em `aprender-link` com `validarUrlSegura()`, rejeitando IPs privados, loopback, link-local e IPv6 privado antes de qualquer `fetch()`.
- **Alto — UnhandledPromiseRejection eliminado:** `chamarGPT4Json` em `_pipeline.js` guarda o handle do segundo `setTimeout` e limpa no `finally`, evitando rejeição não tratada que podia derrubar o processo no Node 16+.
- **Alto — Race condition resolvida:** `reanalisar-lead.js` usa optimistic locking (`SELECT updated_at` + `UPDATE WHERE updated_at = $lido_em`); segunda reanálise simultânea não sobrescreve mais a primeira.
- **Alto — `limpar-tudo` protegida de verdade:** agora exige variável de ambiente `DIRECIONA_DANGER_LIMPAR_TUDO=ativo` **e** confirmação textual exata `"APAGAR TUDO"` no body (antes aceitava `{ confirm: true }`).
- **Médio — Lead órfão eliminado:** `_persistence.js` só tenta upsert do lead se `processingRow` foi criado com sucesso (leadId definido).
- **Médio — Falsy-zero corrigido:** `listRecentProcessings(0)` não retorna mais 12 itens; usa `limit == null ? 12 : Number(limit)`.
- **Médio — Cache de erro corrigido:** `getLeadsData` em `app.js` verifica `res.ok` antes de cachear; resposta HTTP 401/403 não envenena mais o cache por 60 s.
- **Médio — `marcarContatoManualPorId` corrigido:** retorna `resp.ok` em vez de `true` cego independente do status HTTP.
- **Médio — `memoria-set` verifica resposta:** erro HTTP ao salvar observação agora exibe toast e aborta em vez de silenciosamente continuar.
- **Médio — Clipboard corrigido:** `registrarMensagemEnviada` movido para dentro do `.then()` do clipboard; adiciona `.catch()` com toast — contato não é mais registrado se a cópia falhou.
- **Médio — Paste listener limpo:** `clearAnalysis()` remove o handler `_colarAvatarHandler` ao sair do detalhe do lead, evitando que o listener fique ativo na Home.
- **Baixo — Parâmetro `openai` usado:** `extrairInteligenciaObservada` agora usa `openai || getOpenAIRaw()` em vez de ignorar o argumento recebido.
- **Baixo — `safeJson()` nos onclicks:** nomes e produtos com apóstrofo (ex: "D'Arc") não quebram mais os botões de ação nos cards de lead.

## Ponto #626 — 2026-06-22 — Corrige UX de erro OpenAI: próxima ação e sugestões de mensagem

- Quando o OpenAI ficava sem saldo, a mensagem de erro aparecia no card "Próxima ação recomendada" no lugar de uma ação comercial.
- Backend: `nextAction` agora retorna `null` em caso de erro de API (o erro fica apenas no campo `error`).
- Frontend: ignora `nextAction` quando `a.mode === 'erro_api'`, exibindo "Reanalise este lead para gerar a próxima ação." em vez do texto técnico.
- Cards de sugestão de mensagem: quando não há mensagens (erro de API ou lead novo), mostra aviso claro no lugar do grid vazio. Se for erro de saldo, avisa para adicionar crédito em platform.openai.com/billing.

## Ponto #625 — 2026-06-22 — Remove autenticação por chave, materiais sugeridos e exportação completa

## Ponto #621 — 2026-06-22 — Proteção integral, build limpo e migração segura

- **Acesso privado:** todas as APIs agora exigem `DIRECIONA_ACCESS_KEY`; a interface possui tela de desbloqueio e não grava a chave por padrão além da sessão.
- **Banco fechado:** nova migração ativa RLS, revoga acesso de `anon`/`authenticated`, preserva os leads existentes e mantém o backend pela `service_role`.
- **Rota destrutiva bloqueada:** `limpar-tudo` fica desligada, exige variável específica e confirmação textual exata.
- **Código remoto eliminado:** catálogo Senger passou a ser local e versionado; nenhum JavaScript baixado do GitHub é executado no servidor.
- **Proteção de arquivos:** ZIP limitado a 100 MB, número/tamanho descompactado controlados, prevenção de ZIP bomb e lote de transcrição limitado no servidor.
- **Links protegidos:** aprendizado por URL bloqueia redes locais, IPs privados, portas não autorizadas e redirecionamentos perigosos.
- **Build determinístico:** `public/` é apagado e recriado; protótipos antigos não entram no deploy; JSZip é empacotado localmente.
- **Correções funcionais:** lead manual recebe a marca da arquitetura atual; avatar usa as coordenadas reais retornadas pela IA; tabelas legadas deixam de receber cópias duplicadas.
- **Dependências:** versões fixadas e auditoria npm sem vulnerabilidades conhecidas no momento da validação.
- **Escopo honesto:** implantação privada para uma empresa. Multiempresa/SaaS ainda exige autenticação e isolamento por conta.

## Ponto #620 — 2026-06-22 — Remove cards "Reanalisar" redundantes; preserva mensagens antigas se nova análise falhar

- **Cards redundantes removidos:** quando não havia mensagens aprovadas, o app mostrava 3 cards "Reanalisar" que não faziam nada. Agora a lista fica vazia — o botão "Reanalisar" que já existia acima é suficiente.
- **Preservação de mensagens:** se uma reanálise em segundo plano falha em gerar mensagens (timeout, quota), o backend agora mantém as mensagens anteriores válidas em vez de apagá-las. Antes, a reanálise escrevia `sugestoesPendentes: true` e zeras as mensagens mesmo quando já havia boas mensagens salvas.
- **Timeout de geração aumentado:** `gerarMensagensParaLead` passou de 15 s para 20 s, dando mais folga em conversas longas.
- 83/83 testes passando.

## Ponto #619 — 2026-06-22 — Diagnóstico testa a OpenAI do jeito real (Chat Completions)

- O teste de OpenAI em `api/diagnostico.js?mode=openai` chamava a Responses API com `reasoning.effort`, que o `gpt-4.1` NÃO aceita (HTTP 400 `unsupported_parameter`). Resultado: o Diagnóstico dava SEMPRE falso negativo, escondendo o erro de verdade (saldo/limite/rate) quando o corretor ia conferir.
- Agora o teste usa `chat.completions.create` com o `modeloAnalise()` — exatamente o caminho que o pipeline usa pra analisar e gerar mensagens. O Diagnóstico passa a refletir a realidade.
- Causa do "não gerou sugestão" no lead (CONFIRMADO pelo diagnóstico corrigido): conta OpenAI com **quota esgotada** — HTTP 429 `insufficient_quota` ("You exceeded your current quota"). Chave válida (models.list ok), mas sem saldo pra completar a análise/mensagens. Não é bug nem rate-limit momentâneo: só volta a gerar depois de **adicionar crédito em platform.openai.com → Billing**. As análises antigas que têm mensagem foram feitas antes do saldo acabar. Sem mudança no pipeline.
- 83/83 testes passando.

## Ponto #618 — 2026-06-22 — Auditoria: coerência, honestidade documental e robustez das mensagens

- **3 mensagens (a/b/c) de verdade:** removida a geração de 6 mensagens meio-ligada (visita/objeção/urgência iam pro usuário SEM validação). Backend, validador e front agora tratam só a/b/c.
- **Fonte única de regras:** `REGRAS_MSG`/`REGRAS_MSG_PROMPT` em `_pipeline.js` alimentam o prompt de geração, o de revisão e o validador (antes a regra de nº de perguntas estava escrita em 3 lugares com valores diferentes).
- **Robustez (degradar com elegância):** limpeza cosmética determinística (`limparMensagemComercial` — tira emoji e espaços repetidos, sem reescrever palavra) antes de validar; mensagem boa não vira mais tela vazia + "Reanalisar" por causa de um emoji.
- **Honestidade documental:** doc/README/CLAUDE/comentários agora dizem o modelo real (`gpt-4.1`, Chat Completions) em vez de "GPT-5.5". A marca `gpt55-unificado-v2` passa a ser identificador opaco de versão.
- **Limpeza:** removido código morto `chamarGPT55Json` (Responses API não usada); `home-alvo.html`/`home-preview.html` (órfãos) saem do deploy; ícones do Service Worker passam a versionar por `__VERSION__`.
- **Testes:** `teste-arquitetura-gpt55.mjs` e `teste-fallback.mjs` estavam quebrados desde a troca pro gpt-4.1 (testavam Responses API/gpt-5.5) — reescritos pra refletir a arquitetura real, com novo teste da limpeza cosmética.
- Suíte completa verde (teste-noite 83/83 + arquitetura + coerência + comercial + fallback + fluxo + prioridade + 2 validações).

## Ponto #617 — 2026-06-20 — Validação aceita até 2 interrogações por mensagem (era 1)

- Regra de máximo de perguntas afrouxada de 1 para 2, evitando reprovar mensagens boas.
- 83/83 testes passando.

## Ponto #616 — 2026-06-20 — Fix validação: prompt agora exige máx 1 interrogação, sem emoji e rótulos criativos

- Adicionado ao prompt de gerarMensagensParaLead: máx 1 sinal de ? por mensagem, proibido emoji, min 35 / máx 520 chars, rótulos não podem ser "direta"/"consultiva"/"retomada".
- Console.warn adicionado pra capturar issues exatos se validação ainda falhar.
- 83/83 testes passando.

## Ponto #615 — 2026-06-20 — GPT gera 6 mensagens distintas (Direta/Consultiva/Retomada/Visita/Objeção/Urgência)

- gerarMensagensParaLead agora pede as 6 variantes ao GPT-4.1.
- mensagensDaAnalise no front lê visita/objecao/urgencia do JSON (com fallback).
- 83/83 testes passando.

## Ponto #614 — 2026-06-20 — Troca para GPT-4.1 (Chat Completions, 5-10s, alta qualidade)

- Modelo trocado de gpt-5.5 (Responses API, lento) para gpt-4.1 (Chat Completions, rápido).
- Diagnóstico: 4096 tokens, timeout 25s. Mensagens: 1500 tokens, timeout 15s. Total ~10-20s.
- Promise.race mantido como garantia extra de timeout.
- 83/83 testes passando.

## Ponto #613 — 2026-06-20 — effort "low" + Promise.race para garantir timeout dentro de 60s

- effort mudou de "medium" → "low" em todas as chamadas GPT-5.5 (diagnóstico 25s, mensagens 12s, revisão 10s).
- Promise.race adicionado como timeout garantido (SDK do OpenAI às vezes não aborta a conexão).
- Fallback padrão do effort alterado de "high" → "low" (mais seguro).
- 83/83 testes passando.

## Ponto #612 — 2026-06-20 — Split em 2 chamadas GPT-5.5 (diagnóstico + mensagens) para resolver timeout

- Diagnóstico: maxOutputTokens 6000, timeout 28s. Mensagens: nova função `gerarMensagensParaLead`, maxOutputTokens 3200, timeout 15s.
- Total ~35-43s, bem dentro do limite de 60s da Vercel.
- O GPT-5.5 ainda escreve todas as mensagens; JavaScript não cria nem substitui conteúdo comercial.
- 83/83 testes passando.

## Ponto #611 — 2026-06-20 — effort medium + max_tokens 12000 para resolver timeout definitivo

- effort: "high" → "medium" e maxOutputTokens: 18000 → 12000 na análise principal.
- GPT-5.5 medium ainda é muito superior ao GPT-4o anterior; agora cabe nos 60s do servidor.
- Afeta nova análise e reanálise (ambas usam analyzeWithBrain no mesmo pipeline).
- 83/83 testes passando.

## Ponto #610 — 2026-06-20 — Paralelização do carregamento antes do GPT-5.5 (fix timeout)

- Carregamento de cerebroConfig, catálogo, conhecimento e memória do lead agora roda em paralelo (Promise.all) em vez de sequencial.
- Economiza 5-8 segundos de setup, evitando timeout na etapa "Analisando atendimento".
- Timeout da chamada GPT-5.5 aumentado de 42s para 50s aproveitando o tempo ganho.
- 83/83 testes passando.

## Ponto #609 — 2026-06-19 — Fonte única e remoção definitiva das camadas contraditórias

- Base: versão 608.
- Arquitetura comercial oficial: `gpt55-unificado-v2`.
- GPT-5.5 gera diagnóstico, próxima ação e três mensagens na mesma execução.
- Backend valida sem escrever frases; uma reprovação pode gerar uma única revisão pelo mesmo GPT-5.5.
- Front-end não valida, reescreve, encurta, completa ou substitui mensagem comercial.
- Análises antigas sem a marca da arquitetura atual exigem reanálise e não são exibidas como sugestões válidas.
- Escrita automática de conhecimento e estilo só ocorre quando habilitada explicitamente por variável de ambiente.
- Documentação operacional antiga foi removida do texto ativo e preservada compactada em `_arquivo/historico/documentacao_legada_ate_608.zip`.
- `docs/ARQUITETURA_ATUAL.md` é a fonte única sobre o fluxo de mensagens.

## Ponto #608 — 2026-06-19 — GPT-5.5 unificado

- Primeira unificação da análise e das mensagens no GPT-5.5.
- Histórico completo por padrão.
- Claude/Anthropic removido do caminho comercial.
- Este ponto foi consolidado e corrigido pelo #609.


## Ponto #656 — Reconstrução estrutural Corretor Pro / Opção A
- Home substituída por dashboard próprio, desktop e mobile.
- app.js renderiza métricas, listas, gráficos e funil com dados reais.
- identidade Corretor Pro e novo cache/versionamento.
## Ponto #657 — reconstrução visual fiel à Opção A

- Home desktop e mobile reconstruída com a mesma composição das referências aprovadas.
- Temas claro e escuro com sidebar azul-marinho, cards claros/escuros e destaque coral.
- `app.js`, `index.html`, `styles.css`, `service-worker.js` e `build.js` atualizados em conjunto.
- Navegação mobile compacta, sem textos cortados, e dashboard com dados reais.
- Histórico completo preservado; listagens continuam leves e o detalhe carrega sob demanda.
- Cache estático isolado em `corretor-pro-static-v657`.


## Ponto #658 — Reconstrução fiel Opção A
- Dashboard desktop e mobile refeitos nas proporções das referências aprovadas.
- Estrutura, tipografia, cards, gráficos, navegação e identidade Corretor Pro revisados.
- Avatares visuais locais, sem dependências externas.
- Histórico completo preservado e carregamento leve mantido.
- Cache PWA isolado na versão 658.

## Ponto #659 — versão visível no topo

- Número da atualização exibido abaixo da marca no desktop e no mobile.
- Removido o estado oculto do identificador de versão.
- Cache PWA atualizado para a versão 659.


## Ponto #660 — restauração automática dos leads antigos

- O aplicativo confere automaticamente as tabelas antigas `leads` e `direciona_leads` no Supabase.
- Leads ausentes são restaurados em `whatsapp_processamentos`, preservando nome, telefone, empreendimento, etapa, observações, próximo contato e motivo de perda.
- A restauração é idempotente: não duplica registros já presentes por ID, telefone ou nome.
- Foi adicionada uma ação manual em Configurações para repetir a conferência.
- Se as tabelas antigas já tiverem sido apagadas, o importador de CSV continua disponível como alternativa.
- Atualização #660 permanece visível no topo.


## Ponto #661 — trava fantasma ao finalizar a importação

- `renderProcessedResult` (finaliza a tela depois de importar o ZIP) é chamada em dois lugares sem `await` nem `.catch()`; um erro no meio dela sumia em silêncio e deixava a tela travada em "Conversa processada".
- Função protegida com try/catch: se der erro, aparece uma caixa vermelha explicando o problema com botão "Recarregar", em vez de travar sem aviso.
- Nenhuma linha de lógica foi alterada — só o envelope try/catch entrou.
- Cache PWA atualizado para a versão 661.


## Ponto #662 — importação de leads mais simples e sem duplicar

- O importador de leads (CSV) passou a aceitar um arquivo enxuto: só a coluna `Nome` é obrigatória. `Telefone` e `Interesse` são opcionais.
- A coluna `id` deixou de ser exigida — quando não vem no arquivo, o sistema gera um código estável a partir do nome+telefone, então reimportar não duplica.
- O interesse do lead pode vir como `Interesse` ou `Empreendimento` (aceita os dois nomes de coluna); o cabeçalho não diferencia maiúsculas.
- Corrigida uma falha de deduplicação: o marcador gravado era `[CSV …]` mas a checagem procurava só `[CRM …]`, então reimportar podia duplicar leads sem telefone. Agora reconhece os dois.
- Cache PWA atualizado para a versão 662.


## Ponto #663 — importação mostra o erro real quando não salva

- Quando a importação de leads não conseguia gravar nenhum lead, a tela dizia genericamente "a refazer" e escondia o motivo do servidor.
- Agora, se nada for salvo, o importador mostra em vermelho o erro exato devolvido pelo servidor (ex.: recusa de gravação/coluna/permissão), pra identificar a causa de imediato.
- Cache PWA atualizado para a versão 663.

## Ponto #664 — Home operacional do Direciona dentro do Corretor Pro

- Base técnica mantida integralmente na versão 663: histórico completo, recuperação de leads, importação flexível, cache e tratamento de erros.
- A tela principal voltou a ser a fila comercial “Hoje”, com prioridades, motivo da prioridade, diagnóstico e mensagens prontas.
- O dashboard foi preservado e movido para “Desempenho”, sem ocupar a tela de trabalho.
- Menus duplicados foram removidos; “Imóveis” voltou a se chamar “Propostas” enquanto não existe gestão real de imóveis.
- Indicadores estimados de ligações, e-mails e tarefas foram substituídos por dados registrados: atendidos hoje, sem resposta, lembretes e compromissos.
- Avatares deixaram de depender de quatro imagens ausentes no pacote.
- Identidade visual e marca Corretor Pro preservadas.
- Cache PWA atualizado para a versão 664.
