// api/_config.js — v1325
//
// A CONFIGURAÇÃO DO SERVIDOR CONFERIDA NUM LUGAR SÓ, ANTES DE ALGUÉM TROPEÇAR NELA.
//
// A auditoria de 20/08/2026: "há 55 variáveis de ambiente referenciadas no projeto. Isso já pede
// validação centralizada de configuração ao iniciar/deployar, em vez de descobrir uma variável
// errada quando um corretor usa determinada função."
//
// O problema é real e tem duas caras neste projeto:
//   1. o nome ERRADO não faz nada e não avisa. Quem digitar `DIRECIONA_LIMITE_LEITURA_VISUAL`
//      (sem o `_DIA`) na Vercel vai jurar que configurou o teto — e o app segue com o padrão;
//   2. o valor no FORMATO errado também não avisa. Quase todas as chaves de liga/desliga daqui só
//      ligam com o valor exato `1` (ou `sim`, em duas delas). Escrever `true` deixa a chave
//      desligada e nada na tela contradiz quem escreveu.
//
// Este arquivo é o catálogo de TODAS as variáveis que o código lê, com o que cada uma faz, o
// formato esperado e o padrão de fábrica. `conferirConfiguracao()` compara o catálogo com o
// ambiente que está no ar e devolve os problemas em português. Quem mostra isso é o painel
// administrativo (Saúde da configuração), pela rota /api/diagnostico?mode=config.
//
// O catálogo não pode envelhecer sozinho: `tests/v1325-configuracao-catalogada.test.mjs` varre o
// código atrás de `process.env.X` e falha se aparecer uma variável que não está aqui — ou se aqui
// sobrar uma que o código não lê mais.

// tipo:
//   "texto"    — qualquer coisa (chave, nome, URL de serviço)
//   "segredo"  — chave/segredo: nunca é mostrado, só o tamanho
//   "numero"   — precisa virar número maior que zero
//   "liga1"    — só liga com "1"
//   "ligaSim"  — só liga com "sim"
//   "url"      — precisa começar com https://
//   "plataforma" — quem põe é a Vercel/o Node, não o dono
export const CATALOGO_ENV = [
  // ── O que o app não roda sem ────────────────────────────────────────────────────────────────
  { nome: "SUPABASE_URL", tipo: "url", obrigatoria: true, grupo: "Essenciais",
    oQueFaz: "Endereço do banco de dados (Supabase). Sem ele o app não abre nem salva nada." },
  { nome: "SUPABASE_SERVICE_ROLE_KEY", tipo: "segredo", obrigatoria: true, grupo: "Essenciais",
    oQueFaz: "Chave de administrador do banco, usada só pelo servidor. Nunca vai pro navegador." },
  { nome: "OPENAI_API_KEY", tipo: "segredo", obrigatoria: true, grupo: "Essenciais",
    oQueFaz: "Chave da OpenAI. Sem ela nenhuma análise, transcrição ou leitura de imagem acontece." },
  { nome: "SUPABASE_ANON_KEY", tipo: "segredo", obrigatoria: false, grupo: "Essenciais",
    oQueFaz: "Chave pública do banco, usada pela tela de login. Aceita também o nome NEXT_PUBLIC_SUPABASE_ANON_KEY." },
  { nome: "NEXT_PUBLIC_SUPABASE_ANON_KEY", tipo: "segredo", obrigatoria: false, grupo: "Essenciais",
    oQueFaz: "O mesmo que SUPABASE_ANON_KEY, com o nome que a Vercel sugere." },
  { nome: "NEXT_PUBLIC_SUPABASE_URL", tipo: "url", obrigatoria: false, grupo: "Essenciais",
    oQueFaz: "O mesmo que SUPABASE_URL, com o nome que a Vercel sugere." },

  // ── Segurança ───────────────────────────────────────────────────────────────────────────────
  { nome: "ALLOW_UNPROTECTED_API", tipo: "liga1", obrigatoria: false, grupo: "Segurança",
    oQueFaz: "Só serve pra desenvolvimento: deixa a API responder sem login. Em produção NÃO tem efeito nenhum, de propósito." },
  { nome: "CORRETOR_PRO_API_KEY", tipo: "segredo", obrigatoria: false, grupo: "Segurança",
    oQueFaz: "Chave compartilhada do jeito antigo de acessar a API. Desligada por padrão em produção desde a v1190." },
  { nome: "API_SECRET", tipo: "segredo", obrigatoria: false, grupo: "Segurança",
    oQueFaz: "Nome alternativo da chave antiga acima (compatibilidade)." },
  { nome: "CP_API_SECRET", tipo: "segredo", obrigatoria: false, grupo: "Segurança",
    oQueFaz: "Outro nome alternativo da chave antiga acima (compatibilidade)." },
  { nome: "CORRETOR_PRO_LEGADO_ATIVO", tipo: "ligaSim", obrigatoria: false, grupo: "Segurança",
    oQueFaz: "Religa o acesso antigo por chave compartilhada em produção. Só ligue com motivo — e desligue depois." },
  { nome: "CORRETOR_PRO_LEGADO_DESLIGADO", tipo: "ligaSim", obrigatoria: false, grupo: "Segurança",
    oQueFaz: "Desliga o acesso antigo mesmo fora de produção (útil pra testar como está no ar)." },
  { nome: "CORRETOR_PRO_CADASTRO_SEM_0018", tipo: "ligaSim", obrigatoria: false, grupo: "Segurança",
    oQueFaz: "Deixa criar conta nova num banco sem a migração 0018. Saída de emergência: cria conta sem a trava contra robô." },
  { nome: "ATALHO_ZIP_TOKEN_SECRET", tipo: "segredo", obrigatoria: false, grupo: "Segurança",
    oQueFaz: "Segredo que assina o token do Atalho do iPhone. Sem ele o envio pelo Atalho não funciona." },

  // ── Tetos de uso e custo ────────────────────────────────────────────────────────────────────
  { nome: "CORRETOR_PRO_LIMITE_ANALISES_DIA", tipo: "numero", obrigatoria: false, grupo: "Tetos de uso",
    oQueFaz: "Quantas análises uma conta paga pode fazer por dia." },
  { nome: "CORRETOR_PRO_LIMITE_ANALISES_DIA_TESTE", tipo: "numero", obrigatoria: false, grupo: "Tetos de uso",
    oQueFaz: "O mesmo teto, para contas em período de teste." },
  { nome: "CORRETOR_PRO_LIMITE_TRANSCRICAO_VOZ_DIA", tipo: "numero", obrigatoria: false, grupo: "Tetos de uso",
    oQueFaz: "Quantos áudios gravados na tela viram texto por dia, numa conta paga." },
  { nome: "CORRETOR_PRO_LIMITE_TRANSCRICAO_VOZ_DIA_TESTE", tipo: "numero", obrigatoria: false, grupo: "Tetos de uso",
    oQueFaz: "O mesmo, para contas em teste." },
  { nome: "CORRETOR_PRO_LIMITE_LEITURA_PRINT_DIA", tipo: "numero", obrigatoria: false, grupo: "Tetos de uso",
    oQueFaz: "Quantos prints o app lê por dia numa conta paga." },
  { nome: "CORRETOR_PRO_LIMITE_LEITURA_PRINT_DIA_TESTE", tipo: "numero", obrigatoria: false, grupo: "Tetos de uso",
    oQueFaz: "O mesmo, para contas em teste." },
  { nome: "DIRECIONA_LIMITE_LEITURA_VISUAL_DIA", tipo: "numero", obrigatoria: false, grupo: "Tetos de uso",
    oQueFaz: "Quantas imagens/PDFs da conversa a IA lê por dia numa conta paga (padrão 120)." },
  { nome: "DIRECIONA_LIMITE_LEITURA_VISUAL_DIA_TESTE", tipo: "numero", obrigatoria: false, grupo: "Tetos de uso",
    oQueFaz: "O mesmo, para contas em teste (padrão 8)." },
  { nome: "CORRETOR_PRO_LIMITE_TRANSCRICAO_IMPORT_DIA", tipo: "numero", obrigatoria: false, grupo: "Tetos de uso",
    oQueFaz: "Quantos áudios de conversa importada viram texto por dia numa conta paga (padrão 600)." },
  { nome: "CORRETOR_PRO_LIMITE_TRANSCRICAO_IMPORT_DIA_TESTE", tipo: "numero", obrigatoria: false, grupo: "Tetos de uso",
    oQueFaz: "O mesmo, para contas em teste (padrão 80)." },
  { nome: "CORRETOR_PRO_LIMITE_CADASTROS_CONEXAO_DIA", tipo: "numero", obrigatoria: false, grupo: "Tetos de uso",
    oQueFaz: "Quantas contas podem ser criadas por dia a partir da mesma conexão de internet (trava contra robô)." },
  { nome: "CORRETOR_PRO_BONUS_ENTRADA", tipo: "numero", obrigatoria: false, grupo: "Tetos de uso",
    oQueFaz: "Análises extras que uma conta nova ganha ao entrar." },
  { nome: "CORRETOR_PRO_PACOTE_EXTRA_ANALISES", tipo: "numero", obrigatoria: false, grupo: "Tetos de uso",
    oQueFaz: "Quantas análises vêm no pacote avulso oferecido quando o teto do dia acaba." },
  { nome: "CORRETOR_PRO_PACOTE_EXTRA_PRECO", tipo: "texto", obrigatoria: false, grupo: "Tetos de uso",
    oQueFaz: "Preço do pacote avulso, escrito como aparece na tela." },
  { nome: "CORRETOR_PRO_COTACAO_USD_BRL", tipo: "numero", obrigatoria: false, grupo: "Tetos de uso",
    oQueFaz: "Cotação do dólar usada para mostrar o custo de IA em reais no painel." },
  { nome: "CORRETOR_PRO_LIMITE_DIA_PRO", tipo: "numero", obrigatoria: false, grupo: "Tetos de uso",
    oQueFaz: "Teto de análises por dia do plano Pro." },
  { nome: "CORRETOR_PRO_LIMITE_MES_PRO", tipo: "numero", obrigatoria: false, grupo: "Tetos de uso",
    oQueFaz: "Teto de análises por mês do plano Pro (padrão 50)." },
  { nome: "CORRETOR_PRO_LIMITE_DIA_PROMASTER", tipo: "numero", obrigatoria: false, grupo: "Tetos de uso",
    oQueFaz: "Teto de análises por dia do plano Pro Master." },
  { nome: "CORRETOR_PRO_LIMITE_MES_PROMASTER", tipo: "numero", obrigatoria: false, grupo: "Tetos de uso",
    oQueFaz: "Teto de análises por mês do plano Pro Master (padrão 120)." },
  { nome: "CORRETOR_PRO_PRECO_PRO", tipo: "texto", obrigatoria: false, grupo: "Tetos de uso",
    oQueFaz: "Preço do plano Pro, como aparece na tela." },
  { nome: "CORRETOR_PRO_PRECO_PROMASTER", tipo: "texto", obrigatoria: false, grupo: "Tetos de uso",
    oQueFaz: "Preço do plano Pro Master, como aparece na tela." },

  // ── Modelos de IA ───────────────────────────────────────────────────────────────────────────
  { nome: "DIRECIONA_MAIN_MODEL", tipo: "texto", obrigatoria: false, grupo: "Modelos de IA",
    oQueFaz: "Modelo principal (análise e mensagens). Trocável sem publicar código." },
  { nome: "OPENAI_ANALYSIS_MODEL", tipo: "texto", obrigatoria: false, grupo: "Modelos de IA",
    oQueFaz: "Modelo só da análise, quando você quer separar da linha principal." },
  { nome: "OPENAI_MESSAGES_MODEL", tipo: "texto", obrigatoria: false, grupo: "Modelos de IA",
    oQueFaz: "Modelo só das três mensagens." },
  { nome: "OPENAI_VISION_MODEL", tipo: "texto", obrigatoria: false, grupo: "Modelos de IA",
    oQueFaz: "Modelo que lê imagem e PDF." },
  { nome: "OPENAI_SIMPLE_MODEL", tipo: "texto", obrigatoria: false, grupo: "Modelos de IA",
    oQueFaz: "Modelo das tarefas simples (leitura de link, apoio)." },
  { nome: "OPENAI_ORQUESTRADOR_MODEL", tipo: "texto", obrigatoria: false, grupo: "Modelos de IA",
    oQueFaz: "Modelo do orquestrador, a etapa que organiza o pedido antes da análise." },
  { nome: "OPENAI_MODEL", tipo: "texto", obrigatoria: false, grupo: "Modelos de IA",
    oQueFaz: "Nome antigo do modelo das tarefas simples (compatibilidade)." },
  { nome: "DIRECIONA_IMPORT_MODEL", tipo: "texto", obrigatoria: false, grupo: "Modelos de IA",
    oQueFaz: "Modelo usado nas tarefas da importação." },
  { nome: "DIRECIONA_FAST_MODEL", tipo: "texto", obrigatoria: false, grupo: "Modelos de IA",
    oQueFaz: "Modelo rápido usado como reserva da importação." },
  { nome: "DIRECIONA_MODELO_ANTERIOR", tipo: "texto", obrigatoria: false, grupo: "Modelos de IA",
    oQueFaz: "Modelo de recuo quando o modelo novo não está liberado na conta da OpenAI." },
  { nome: "OPENAI_TRANSCRIPTION_MODEL", tipo: "texto", obrigatoria: false, grupo: "Modelos de IA",
    oQueFaz: "Modelo que transcreve áudio (padrão whisper-1)." },
  { nome: "OPENAI_REASONING_EFFORT", tipo: "texto", obrigatoria: false, grupo: "Modelos de IA",
    oQueFaz: "Quanto o modelo 'pensa' antes de responder (padrão high)." },
  { nome: "OPENAI_BASE_URL", tipo: "url", obrigatoria: false, grupo: "Modelos de IA",
    oQueFaz: "Endereço da API da OpenAI. Só mude se estiver usando um intermediário." },
  { nome: "OPENAI_API_BASE", tipo: "url", obrigatoria: false, grupo: "Modelos de IA",
    oQueFaz: "Nome alternativo do endereço acima (compatibilidade)." },
  { nome: "OPENAI_ORGANIZATION", tipo: "texto", obrigatoria: false, grupo: "Modelos de IA",
    oQueFaz: "Organização da conta OpenAI, quando a conta tem mais de uma." },
  { nome: "OPENAI_ORG_ID", tipo: "texto", obrigatoria: false, grupo: "Modelos de IA",
    oQueFaz: "Nome alternativo da organização acima." },
  { nome: "OPENAI_PROJECT", tipo: "texto", obrigatoria: false, grupo: "Modelos de IA",
    oQueFaz: "Projeto da conta OpenAI, quando a chave é de projeto." },
  { nome: "OPENAI_PROJECT_ID", tipo: "texto", obrigatoria: false, grupo: "Modelos de IA",
    oQueFaz: "Nome alternativo do projeto acima." },

  // ── Ajuste fino da análise ──────────────────────────────────────────────────────────────────
  { nome: "DIRECIONA_ANALYSIS_BUDGET_MS", tipo: "numero", obrigatoria: false, grupo: "Ajuste fino",
    oQueFaz: "Quanto tempo a análise tem para responder, em milésimos de segundo (padrão 240000 = 4min)." },
  { nome: "DIRECIONA_ANALYSIS_TIMEOUT_MS", tipo: "numero", obrigatoria: false, grupo: "Ajuste fino",
    oQueFaz: "Tempo máximo de UMA chamada à IA antes de desistir." },
  { nome: "DIRECIONA_ANALYSIS_MAX_TOKENS", tipo: "numero", obrigatoria: false, grupo: "Ajuste fino",
    oQueFaz: "Tamanho máximo da resposta da IA." },
  { nome: "EVALS_MODELO_JUIZ", tipo: "texto", obrigatoria: false, grupo: "Ajuste fino",
    oQueFaz: "Modelo que confere as respostas na medição de qualidade da análise (padrão: o modelo de tarefas simples)." },
  // v1331 — a análise em DUAS ETAPAS (ler primeiro, escrever depois) entrou desligada: só liga
  // quando a medição da bateria mostrar que ela é melhor que o pedido único.
  { nome: "DIRECIONA_ANALISE_ETAPAS", tipo: "texto", obrigatoria: false, grupo: "Ajuste fino",
    oQueFaz: "2 liga a análise em duas etapas (a IA entende primeiro, escreve as três mensagens depois). Vazio ou 1 mantém o pedido único de sempre." },
  { nome: "DIRECIONA_MENSAGENS_TIMEOUT_MS", tipo: "numero", obrigatoria: false, grupo: "Ajuste fino",
    oQueFaz: "Tempo máximo da etapa que escreve as três mensagens (padrão 60000 = 1min)." },
  { nome: "DIRECIONA_MENSAGENS_MAX_TOKENS", tipo: "numero", obrigatoria: false, grupo: "Ajuste fino",
    oQueFaz: "Tamanho máximo da resposta da etapa que escreve as três mensagens (padrão 2000)." },
  { nome: "DIRECIONA_CAUDA_MENSAGENS_CHARS", tipo: "numero", obrigatoria: false, grupo: "Ajuste fino",
    oQueFaz: "Quanto do fim da conversa vai junto na etapa que escreve, para pegar o fio e o tom (padrão 14000 caracteres)." },
  { nome: "DIRECIONA_MAX_CONTEXT_CHARS", tipo: "numero", obrigatoria: false, grupo: "Ajuste fino",
    oQueFaz: "Quanto texto de conversa cabe num pedido (padrão 120000 caracteres)." },
  { nome: "DIRECIONA_MAX_VISUAIS_IMPORT", tipo: "numero", obrigatoria: false, grupo: "Ajuste fino",
    oQueFaz: "Quantas imagens/PDFs a IA lê por importação (padrão 6, sempre os mais recentes)." },
  { nome: "DIRECIONA_INCREMENTAL_MIN_CHARS", tipo: "numero", obrigatoria: false, grupo: "Ajuste fino",
    oQueFaz: "A partir de que tamanho a reanálise usa resumo + novidade em vez da conversa inteira." },
  { nome: "DIRECIONA_INCREMENTAL_CAUDA_CHARS", tipo: "numero", obrigatoria: false, grupo: "Ajuste fino",
    oQueFaz: "Quanto do fim da conversa vai inteiro nesse modo." },
  { nome: "DIRECIONA_LIMITAR_HISTORICO", tipo: "liga1", obrigatoria: false, grupo: "Ajuste fino",
    oQueFaz: "Volta a cortar o histórico por período. Desligado, a IA lê a conversa inteira (que é o padrão de hoje)." },
  { nome: "CORRETOR_PRO_ANALISE_JUNTA_MAX_MENSAGENS", tipo: "numero", obrigatoria: false, grupo: "Ajuste fino",
    oQueFaz: "Até quantas mensagens a análise junta num pedido só." },
  { nome: "CORRETOR_PRO_TRANSCRICAO_CONCORRENCIA", tipo: "numero", obrigatoria: false, grupo: "Ajuste fino",
    oQueFaz: "Quantos áudios são transcritos ao mesmo tempo." },
  { nome: "CORRETOR_PRO_STATS_TIMELINES_POR_CARGA", tipo: "numero", obrigatoria: false, grupo: "Ajuste fino",
    oQueFaz: "Quantas conversas com cache frio são recalculadas por carga da carteira." },
  { nome: "DIRECIONA_USAR_APRENDIZADO_AUTO", tipo: "liga1", obrigatoria: false, grupo: "Ajuste fino",
    oQueFaz: "Liga o aprendizado automático do jeito de escrever do corretor." },
  { nome: "DIRECIONA_USAR_CONHECIMENTO_AUTO", tipo: "liga1", obrigatoria: false, grupo: "Ajuste fino",
    oQueFaz: "Liga o aprendizado automático de fatos comerciais." },
  { nome: "DIRECIONA_USAR_ESTILO_AUTO", tipo: "liga1", obrigatoria: false, grupo: "Ajuste fino",
    oQueFaz: "Liga o aprendizado automático de estilo." },

  // ── Arquivos e contato ──────────────────────────────────────────────────────────────────────
  { nome: "SUPABASE_ZIP_BUCKET", tipo: "texto", obrigatoria: false, grupo: "Arquivos",
    oQueFaz: "Nome da pasta no Supabase onde os ZIPs ficam durante a importação (padrão whatsapp-zips)." },
  { nome: "SUPABASE_ZIP_MAX_BYTES", tipo: "numero", obrigatoria: false, grupo: "Arquivos",
    oQueFaz: "Tamanho máximo do ZIP aceito, em bytes." },
  { nome: "CORRETOR_PRO_WHATS_COMERCIAL", tipo: "texto", obrigatoria: false, grupo: "Arquivos",
    oQueFaz: "Número de WhatsApp que aparece pro corretor falar com você (só números)." },

  // ── Postas pela plataforma, não por você ────────────────────────────────────────────────────
  { nome: "NODE_ENV", tipo: "plataforma", obrigatoria: false, grupo: "Plataforma",
    oQueFaz: "Quem põe é o servidor: diz se está rodando em produção, teste ou desenvolvimento." },
  { nome: "VERCEL_ENV", tipo: "plataforma", obrigatoria: false, grupo: "Plataforma",
    oQueFaz: "Quem põe é a Vercel: production, preview ou development." },
  { nome: "VERCEL_GIT_COMMIT_SHA", tipo: "plataforma", obrigatoria: false, grupo: "Plataforma",
    oQueFaz: "Quem põe é a Vercel: identifica a publicação que está no ar." },
  { nome: "GIT_COMMIT_SHA", tipo: "plataforma", obrigatoria: false, grupo: "Plataforma",
    oQueFaz: "O mesmo, para quando o app é publicado fora da Vercel." }
];

const POR_NOME = new Map(CATALOGO_ENV.map(v => [v.nome, v]));

// Nome parecido: acha o item do catálogo mais próximo de um nome escrito errado, pra dizer "você
// quis dizer X?" em vez de só "não conheço isso". Distância de edição simples, sem biblioteca.
function distancia(a, b) {
  const s = String(a), t = String(b);
  const linha = Array.from({ length: t.length + 1 }, (_, i) => i);
  for (let i = 1; i <= s.length; i++) {
    let anterior = linha[0];
    linha[0] = i;
    for (let j = 1; j <= t.length; j++) {
      const guardado = linha[j];
      linha[j] = Math.min(linha[j] + 1, linha[j - 1] + 1, anterior + (s[i - 1] === t[j - 1] ? 0 : 1));
      anterior = guardado;
    }
  }
  return linha[t.length];
}

export function nomeParecidoNoCatalogo(nome) {
  let melhor = null;
  let menor = Infinity;
  for (const item of CATALOGO_ENV) {
    const d = distancia(String(nome || "").toUpperCase(), item.nome);
    if (d < menor) { menor = d; melhor = item.nome; }
  }
  // Só sugere quando é MESMO parecido (um deslize de digitação, não outra variável qualquer).
  return menor <= Math.max(3, Math.round(String(nome || "").length * 0.25)) ? melhor : null;
}

const PREFIXOS_DO_PROJETO = ["CORRETOR_PRO_", "DIRECIONA_", "SUPABASE_", "OPENAI_", "ATALHO_"];

// A conferência. Nunca lança e nunca mostra o conteúdo de segredo nenhum.
export function conferirConfiguracao(env = process.env) {
  const ambiente = env && typeof env === "object" ? env : {};
  const problemas = [];
  const conferidas = [];

  const temValor = (nome) => String(ambiente[nome] ?? "").trim() !== "";

  for (const item of CATALOGO_ENV) {
    const bruto = String(ambiente[item.nome] ?? "").trim();
    const definida = bruto !== "";
    conferidas.push({ nome: item.nome, grupo: item.grupo, definida, oQueFaz: item.oQueFaz });

    if (!definida) {
      if (item.obrigatoria) {
        // As duas duplas de nome alternativo valem uma pela outra.
        const alternativa = item.nome === "SUPABASE_URL" ? "NEXT_PUBLIC_SUPABASE_URL" : "";
        if (!(alternativa && temValor(alternativa))) {
          problemas.push({ nome: item.nome, nivel: "erro", grupo: item.grupo,
            mensagem: `Falta configurar ${item.nome}. ${item.oQueFaz}` });
        }
      }
      continue;
    }

    if (item.tipo === "numero" && !(Number(bruto) > 0)) {
      problemas.push({ nome: item.nome, nivel: "erro", grupo: item.grupo,
        mensagem: `${item.nome} precisa ser um número maior que zero, e está escrito "${bruto}". Enquanto estiver assim, o app usa o valor de fábrica.` });
    }
    if (item.tipo === "liga1" && bruto !== "1" && bruto !== "0") {
      problemas.push({ nome: item.nome, nivel: "aviso", grupo: item.grupo,
        mensagem: `${item.nome} só liga com o valor 1 (e desliga com 0). Está escrito "${bruto}", então continua DESLIGADA.` });
    }
    if (item.tipo === "ligaSim" && !/^(sim|nao|não)$/i.test(bruto)) {
      problemas.push({ nome: item.nome, nivel: "aviso", grupo: item.grupo,
        mensagem: `${item.nome} só liga com a palavra sim. Está escrito "${bruto}", então continua DESLIGADA.` });
    }
    if (item.tipo === "url" && !/^https:\/\//i.test(bruto)) {
      problemas.push({ nome: item.nome, nivel: "erro", grupo: item.grupo,
        mensagem: `${item.nome} precisa começar com https:// e está começando com "${bruto.slice(0, 12)}…".` });
    }
    if (item.tipo === "segredo" && bruto.length < 20) {
      problemas.push({ nome: item.nome, nivel: "aviso", grupo: item.grupo,
        mensagem: `${item.nome} está com um valor curto demais (${bruto.length} caracteres) para uma chave. Confira se não foi colada pela metade.` });
    }
  }

  // Variável com a cara deste projeto que NINGUÉM lê: quase sempre é nome digitado errado.
  for (const nome of Object.keys(ambiente)) {
    if (POR_NOME.has(nome)) continue;
    if (!PREFIXOS_DO_PROJETO.some(p => nome.startsWith(p))) continue;
    const parecida = nomeParecidoNoCatalogo(nome);
    problemas.push({ nome, nivel: "aviso", grupo: "Nome desconhecido",
      mensagem: parecida
        ? `${nome} não é lida por nada no código. Você quis dizer ${parecida}?`
        : `${nome} não é lida por nada no código — se foi criada esperando algum efeito, ele não acontece.` });
  }

  const erros = problemas.filter(p => p.nivel === "erro");
  return {
    ok: erros.length === 0,
    total: CATALOGO_ENV.length,
    definidas: conferidas.filter(c => c.definida).length,
    problemas,
    erros: erros.length,
    avisos: problemas.length - erros.length,
    conferidas
  };
}

// Um aviso no registro do servidor, uma vez por processo, quando a configuração tem ERRO. Não
// derruba nada: derrubar por conta própria tiraria do ar corretor que está trabalhando (mesma
// regra da conferência de migrações).
let jaAvisou = false;
export function avisarConfiguracaoNoLog(env = process.env) {
  if (jaAvisou) return null;
  jaAvisou = true;
  // v1328 — try/catch obrigatório: esta função roda no momento em que o servidor acorda, ANTES de
  // qualquer rota responder. Se ela lançasse por qualquer motivo (uma variável com formato
  // esquisito, por exemplo), derrubaria a API inteira em vez de avisar sobre configuração — o
  // oposto do que ela existe pra fazer. Aviso nunca pode ser mais perigoso que o problema avisado.
  try {
    const r = conferirConfiguracao(env);
    for (const p of r.problemas.filter(x => x.nivel === "erro")) {
      console.error(`[configuração] ${p.mensagem}`);
    }
    return r;
  } catch (erro) {
    console.warn("[configuração] não deu pra conferir a configuração ao iniciar:", erro?.message || erro);
    return null;
  }
}
