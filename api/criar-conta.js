// v1128 — criação da empresa do corretor, agora pelo servidor (antes o navegador criava sozinho).
//
// POR QUE MUDOU: a confirmação de e-mail no cadastro foi descartada por decisão do dono — quem se
// cadastra entra na hora e usa os 7 dias de teste; a venda é fechada por telefone depois. Só que a
// confirmação de e-mail era o que segurava robô criando conta com e-mail inventado, e cada conta em
// teste gasta IA de verdade (crédito pago pelo dono). Esta rota põe uma trava no lugar que não pede
// NADA de quem se cadastra: conta quantas contas nasceram da mesma conexão de internet nas últimas
// 24h e recusa a partir de um limite folgado (ver limiteCadastrosPorConexaoDia).
//
// A trava só é inviolável com a migração 0013 aplicada — é ela que tira do navegador o direito de
// chamar criar_empresa_e_dono direto (a chave "anon" do Supabase é pública).
//
// v1185 — cadastro.html e entrar.html NÃO têm mais caminho de reserva pelo navegador. Ele existia
// pra ninguém ficar sem se cadastrar antes de a 0013 ser aplicada, mas virou o contrário do que
// devia: "se a trava de segurança estiver faltando, volte a usar o caminho sem trava" (apontado
// pelas três auditorias de 08/2026). A 0013 está aplicada; quem quiser conferir de verdade,
// /api/diagnostico?mode=banco pergunta ao banco em vez de acreditar em documentação.
import {
  getSupabaseAdmin,
  requireLoginSemEmpresa,
  impressaoDaConexao,
  limiteCadastrosPorConexaoDia,
  contarCadastrosRecentesDaConexao,
  registrarCadastroDaConexao
} from "./_persistence.js";

function json(res, status, payload) {
  res.status(status).setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  res.end(JSON.stringify(payload));
}

async function lerCorpo(req) {
  if (req.body && typeof req.body === "object") return req.body;
  let bruto = "";
  for await (const pedaco of req) bruto += pedaco;
  if (!bruto) return {};
  try { return JSON.parse(bruto); } catch (_) { return {}; }
}

// O terceiro parâmetro só existe pros testes injetarem um Supabase de mentira (a Vercel chama
// sempre com dois). Mesmo papel do `{ supabase }` que resolveOrganizationId já aceita.
export default async function handler(req, res, { supabase: supabaseInjetado } = {}) {
  if (req.method !== "POST") return json(res, 405, { ok: false, error: "Use POST." });

  // Confirma o login de verdade (nunca aceita id de usuário mandado pelo navegador). Quem chega
  // aqui acabou de se cadastrar, então ainda NÃO tem empresa — por isso não é resolveOrganizationId.
  const login = await requireLoginSemEmpresa(req, res, { supabase: supabaseInjetado });
  if (!login) return;

  const supabase = supabaseInjetado || getSupabaseAdmin();
  if (!supabase) return json(res, 500, { ok: false, error: "Supabase não configurado." });

  const corpo = await lerCorpo(req).catch(() => ({}));
  const meta = login.metadata || {};
  // O nome pode vir do formulário de cadastro OU do que ficou salvo no login (primeiro acesso de
  // quem se cadastrou antes desta versão). Último recurso: a parte antes do @ do e-mail.
  const nome = String(corpo.nome || meta.nome_empresa || "").trim()
    || String((login.email || "").split("@")[0] || "").trim();
  if (!nome) return json(res, 400, { ok: false, error: "Informe o nome da empresa." });

  // Se este login JÁ tem empresa, devolve a que existe e vai embora — sem contar como cadastro
  // novo. É o caso do primeiro login de quem já se cadastrou: passar por aqui não pode gastar
  // nenhuma das tentativas da conexão nem criar nada.
  const { data: vinculo } = await supabase
    .from("memberships").select("organization_id")
    .eq("user_id", login.userId).order("criado_em", { ascending: false }).limit(1).maybeSingle();
  if (vinculo?.organization_id) {
    return json(res, 200, { ok: true, organizationId: vinculo.organization_id, jaExistia: true });
  }

  const conexao = impressaoDaConexao(req);
  const limite = limiteCadastrosPorConexaoDia();
  const recusaPorLimite = () => json(res, 429, {
    ok: false,
    limiteConexao: true,
    error: `Já foram abertas ${limite} contas novas desta conexão de internet hoje. Se você precisa de mais contas, fale com a gente pelo WhatsApp que liberamos na hora.`
  });
  const dadosDaEmpresa = {
    p_nome: nome,
    p_telefone: String(corpo.telefone || meta.telefone || "").trim(),
    p_cidade: String(corpo.cidade || meta.cidade || "").trim(),
    p_estado: String(corpo.estado || meta.estado || "").trim(),
    p_email: String(corpo.email || login.email || "").trim()
  };

  // ── v1186 — CONTAR, DECIDIR, CRIAR E REGISTRAR NUMA TRANSAÇÃO SÓ ──────────────────────────
  //
  // Até aqui isso eram quatro passos separados, e entre o "conta" e o "registra" havia uma janela:
  // cinco pedidos simultâneos da mesma conexão liam "4", os cinco passavam, os cinco criavam.
  // Reproduzido num Postgres 16 de verdade: com limite 5, oito pedidos ao mesmo tempo criaram
  // OITO contas pelo caminho antigo e exatamente CINCO pela função nova (as outras três recusadas).
  // A trava é por conexão, então dois corretores diferentes não esperam um pelo outro.
  const atomico = await supabase.rpc("criar_empresa_com_limite_de_conexao", {
    p_user_id: login.userId,
    p_conexao_hash: conexao || null,
    p_limite: limite,
    ...dadosDaEmpresa
  });

  const semFuncaoAtomica = !!atomico.error && /function .* does not exist|could not find the function|schema cache|PGRST202/i
    .test(`${atomico.error.message || ""} ${atomico.error.code || ""}`);

  if (!atomico.error) {
    limparImpressoesAntigasDeVezEmQuando(supabase);
    return json(res, 200, { ok: true, organizationId: atomico.data || null });
  }
  // Limite estourado: a própria função para com o código CP429.
  if (String(atomico.error.code || "") === "CP429" || /contas novas desta conexão/i.test(atomico.error.message || "")) {
    return recusaPorLimite();
  }
  if (!semFuncaoAtomica) {
    return json(res, 500, { ok: false, error: atomico.error.message || "Não foi possível criar a empresa." });
  }

  // ── Migração 0018 ainda não aplicada ──────────────────────────────────────────────────────
  //
  // v1190 — EM PRODUÇÃO ISTO AGORA PARA AQUI (falha fechada).
  //
  // Até a v1189, quando a função atômica não existia, o cadastro caía calado no caminho de quatro
  // passos da v1128 — aquele com a janela de concorrência que a 0018 veio fechar (oito pedidos
  // simultâneos criaram OITO contas onde o limite era cinco). Código novo rodando sobre banco
  // velho parecia saudável, e ninguém tinha como perceber pela tela.
  //
  // A escolha é entre duas dores: recusar cadastro novo enquanto a migração não roda, ou reabrir
  // em silêncio a porta de cadastro em massa. Fica a primeira — mas com duas saídas: a mensagem
  // diz exatamente o que fazer, e existe um destravamento por variável de ambiente
  // (CORRETOR_PRO_CADASTRO_SEM_0018=sim na Vercel), que libera o caminho antigo na hora, sem
  // publicar nada, se o dono precisar vender antes de aplicar a migração.
  // Fora de produção (desenvolvimento e testes) o caminho antigo continua valendo sozinho.
  const emProducao = process.env.NODE_ENV === "production" || process.env.VERCEL_ENV === "production";
  const destravado = String(process.env.CORRETOR_PRO_CADASTRO_SEM_0018 || "").toLowerCase() === "sim";
  if (emProducao && !destravado) {
    console.error("[criar-conta] BLOQUEADO: a migração 0018 não está aplicada neste banco. O cadastro novo fica recusado até rodar supabase/migrations/0018_cadastro_atomico_e_limpeza.sql (confira em /api/diagnostico?mode=banco). Pra liberar o caminho antigo temporariamente, defina CORRETOR_PRO_CADASTRO_SEM_0018=sim.");
    return json(res, 503, {
      ok: false,
      migracaoPendente: true,
      error: "O cadastro está temporariamente indisponível: o banco de dados precisa de uma atualização (migração 0018) antes de aceitar contas novas. Fale com o suporte pelo WhatsApp — é rápido."
    });
  }
  console.warn("[criar-conta] migração 0018 não aplicada: a trava de cadastro por conexão está no modo antigo (não atômico). Rode supabase/migrations/0018_cadastro_atomico_e_limpeza.sql.");

  const contagem = await contarCadastrosRecentesDaConexao(supabase, conexao);
  if (contagem.disponivel && contagem.total >= limite) return recusaPorLimite();

  const { data: novoId, error } = await supabase.rpc("criar_empresa_e_dono_para", {
    p_user_id: login.userId,
    ...dadosDaEmpresa
  });

  if (error) {
    // Migração 0013 ainda não rodada: a função não existe. v1185 — isso agora é um diagnóstico,
    // não um convite pro navegador criar a empresa por fora: banco incompleto tem que aparecer,
    // não ser contornado em silêncio. O texto vai em português porque quem lê é o corretor.
    const semFuncao = /function .* does not exist|could not find the function|schema cache/i.test(error.message || "");
    return json(res, semFuncao ? 501 : 500, {
      ok: false,
      migracaoPendente: semFuncao || undefined,
      error: semFuncao
        ? "O sistema de contas ainda não foi ligado neste banco. Fale com o suporte: falta rodar a migração 0013 (confira em /api/diagnostico?mode=banco)."
        : (error.message || "Não foi possível criar a empresa.")
    });
  }

  await registrarCadastroDaConexao(supabase, conexao, novoId);
  return json(res, 200, { ok: true, organizationId: novoId || null, travaAtomica: false });
}

// v1186 — a impressão da conexão só serve pras últimas 24h, mas nada nunca apagava o resto: a
// tabela crescia pra sempre. A limpeza roda no máximo uma vez por dia por instância do servidor,
// depois de um cadastro dar certo, e NUNCA atrasa a resposta de quem está se cadastrando (não tem
// await): se falhar, o próximo cadastro tenta de novo.
let _ultimaLimpezaDeImpressoes = 0;
function limparImpressoesAntigasDeVezEmQuando(supabase) {
  const UM_DIA = 24 * 60 * 60 * 1000;
  if (Date.now() - _ultimaLimpezaDeImpressoes < UM_DIA) return;
  _ultimaLimpezaDeImpressoes = Date.now();
  Promise.resolve(supabase.rpc("limpar_cadastros_por_conexao_antigos", { p_dias: 7 })).catch(() => {});
}
