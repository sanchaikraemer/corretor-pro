// ============================================================================================
// v1165 — o que fica guardado NO APARELHO pertence a UMA conta, e precisa ir embora com ela
// ============================================================================================
//
// A auditoria de 07/08/2026 (itens 6, 8 e 9) apontou: sair da conta só encerrava a sessão e
// redirecionava. Tudo o que o app guarda no aparelho continuava lá — inclusive o Cérebro
// Comercial, que fica numa chave global (`direciona-cerebro-config`, sem dono). Consequências
// reais, e nenhuma delas hipotética num piloto onde o dono entra na conta dos parceiros pra
// ajudar:
//
//   • se o servidor não responder, o app cai na cópia local do Cérebro — e a conta que acabou de
//     entrar veria o método, as regras e os diferenciais do corretor anterior;
//   • pior, ao salvar, essa cópia herdada seria gravada POR CIMA do Cérebro da conta nova;
//   • o ZIP da última conversa compartilhada continua no aparelho (IndexedDB), com a conversa
//     inteira de um cliente que não é do novo corretor;
//   • o retrato do lembrete diário guarda até 3 NOMES de clientes, e o aviso do celular sairia
//     com o nome dos clientes do corretor anterior.
//
// A regra deste arquivo: nada aqui apaga preferência neutra do aparelho (tema, por exemplo) —
// isso é do aparelho, não da conta. O que some é dado da conta, em duas faixas:
//
//   COMERCIAIS — dado de cliente/negócio. Vai embora ao SAIR da conta e ao trocar de dono.
//   DE USO     — contadores do próprio corretor (atividade, tempo no app), que ficam só neste
//                aparelho e nunca sobem pro servidor. Só somem quando o dono MUDA: sair e voltar
//                na mesma conta não pode apagar o histórico de Desempenho de quem já usava.
//
// Quem chama:
//   • entrar.html / cadastro.html — logo depois de o login/cadastro confirmar quem entrou, ANTES
//     de mandar pro app. É a passagem em que a troca de pessoa realmente acontece.
//   • app.js — ao sair da conta (limpa os comerciais) e na abertura, como rede de segurança pra
//     uma sessão que tenha trocado sem passar pelas telas de entrada.

export const DONO_KEY = "cp-dono-dos-dados-locais";

// Dado comercial: some ao sair da conta e ao trocar de dono.
export const CHAVES_COMERCIAIS = [
  "direciona-cerebro-config",              // Cérebro Comercial (método, regras, diferenciais)
  "cpImportPendente",                      // importação que ficou pela metade
  "corretor_pro_aprendizado_v2_offset",    // fila do aprendizado contínuo
  "corretor_pro_aprendizado_v2_pendentes",
  "corretor_pro_aprendizado_v2_lock",
  "compromissosDispensados",               // agenda: compromissos que o corretor dispensou
  "cp-lembrete-diario",                    // lembrete diário ligado/desligado
  "corretor_pro_restauracao_legado_v660",  // marca da restauração de leads antigos
  "corretor_pro_audio_window_days",        // período dos áudios (config do Cérebro)
  "corretor_pro_api_key_v679"              // chave antiga compartilhada: abre a conta original
];

// Uso do próprio corretor neste aparelho: só some quando o dono muda.
export const CHAVES_DE_USO = [
  "cpTempoAppPorDia",
  "corretor_pro_import_cleanup_at",
  "direciona_onboarding_visto"
];
export const PREFIXOS_DE_USO = [
  "cpAtividade_",                          // contagem de atividade por dia (tela Desempenho)
  "corretor_pro_tutorial_envio_visto"      // tutorial de envio já visto (com e sem sufixo de conta)
];

// Bancos locais (IndexedDB) e caches que guardam conteúdo de cliente.
const BANCOS_LOCAIS = [
  { nome: "direciona-share", lojas: ["zips"] },        // o ZIP compartilhado pelo WhatsApp
  { nome: "corretor-pro-notif", lojas: ["kv"] }        // retrato do lembrete (até 3 nomes de clientes)
];
const ehCacheDeCompartilhamento = (nome) =>
  nome === "direciona-sharetarget-stable" || String(nome).startsWith("direciona-sharetarget-");

function removerChaves(chaves) {
  for (const chave of chaves) {
    try { localStorage.removeItem(chave); } catch (_) {}
  }
}

function removerPorPrefixo(prefixos) {
  if (!prefixos.length) return;
  let todas = [];
  try { todas = Object.keys(localStorage); } catch (_) { return; }
  removerChaves(todas.filter(k => prefixos.some(p => String(k).startsWith(p))));
}

// Esvaziar as "gavetas" é o que garante a privacidade; apagar o banco inteiro é só arremate e
// pode ficar bloqueado se o service worker estiver com ele aberto — por isso, nesta ordem, e
// nenhuma das duas etapas pode derrubar a limpeza do resto.
function limparBancoLocal({ nome, lojas }) {
  return new Promise(resolve => {
    if (typeof indexedDB === "undefined") { resolve(); return; }
    let pronto = false;
    const encerrar = () => { if (!pronto) { pronto = true; resolve(); } };
    setTimeout(encerrar, 2000); // nunca trava a saída da conta por causa do IndexedDB
    let req;
    try { req = indexedDB.open(nome); } catch (_) { encerrar(); return; }
    req.onerror = encerrar;
    req.onsuccess = () => {
      const db = req.result;
      try {
        const existentes = lojas.filter(l => db.objectStoreNames.contains(l));
        if (!existentes.length) { try { db.close(); } catch (_) {} apagarBanco(nome, encerrar); return; }
        const tx = db.transaction(existentes, "readwrite");
        for (const loja of existentes) tx.objectStore(loja).clear();
        const fim = () => { try { db.close(); } catch (_) {} apagarBanco(nome, encerrar); };
        tx.oncomplete = fim; tx.onerror = fim; tx.onabort = fim;
      } catch (_) { try { db.close(); } catch (_) {} encerrar(); }
    };
  });
}

function apagarBanco(nome, pronto) {
  try {
    const del = indexedDB.deleteDatabase(nome);
    del.onsuccess = pronto; del.onerror = pronto; del.onblocked = pronto;
  } catch (_) { pronto(); }
}

async function limparCachesDeCompartilhamento() {
  if (typeof caches === "undefined") return;
  try {
    const nomes = await caches.keys();
    await Promise.all(nomes.filter(ehCacheDeCompartilhamento).map(n => caches.delete(n).catch(() => {})));
  } catch (_) {}
}

// Apaga o dado comercial guardado neste aparelho. Usada ao SAIR da conta.
export async function limparDadosComerciaisLocais() {
  removerChaves(CHAVES_COMERCIAIS);
  await Promise.all([
    ...BANCOS_LOCAIS.map(limparBancoLocal),
    limparCachesDeCompartilhamento()
  ]);
}

// Apaga tudo que pertence à conta anterior — comercial E contadores de uso. Usada quando o
// aparelho troca de dono.
export async function limparTudoDaContaAnterior() {
  removerChaves([...CHAVES_COMERCIAIS, ...CHAVES_DE_USO]);
  removerPorPrefixo(PREFIXOS_DE_USO);
  await Promise.all([
    ...BANCOS_LOCAIS.map(limparBancoLocal),
    limparCachesDeCompartilhamento()
  ]);
}

// Carimba de quem é o dado deste aparelho e, se o dono mudou, apaga o que era da conta anterior
// ANTES de o app ler qualquer coisa. Devolve { limpou } pra quem quiser avisar na tela.
//
// Sem carimbo nenhum (primeira vez depois desta atualização), NÃO limpa: o dado que está aí é do
// próprio corretor que já usava o aparelho, e apagar tomaria dele o histórico de Desempenho e uma
// importação em andamento sem motivo. Só adota o dono atual.
export async function garantirDonoDosDadosLocais(donoAtual) {
  const dono = String(donoAtual || "").trim();
  if (!dono) return { limpou: false, motivo: "sem-sessao" };

  let anterior = null;
  try { anterior = localStorage.getItem(DONO_KEY); } catch (_) { return { limpou: false, motivo: "sem-localstorage" }; }

  if (anterior === dono) return { limpou: false, motivo: "mesmo-dono" };

  const trocou = !!anterior && anterior !== dono;
  if (trocou) await limparTudoDaContaAnterior();

  try { localStorage.setItem(DONO_KEY, dono); } catch (_) {}
  return { limpou: trocou, motivo: trocou ? "dono-mudou" : "primeiro-carimbo" };
}

// Ao sair da conta: o dado comercial vai embora, mas O CARIMBO FICA.
//
// v1185 — aqui estava um bug que a auditoria de 08/2026 pegou fazendo a simulação na mão. O carimbo
// era apagado junto ao sair. Consequência, na ordem em que acontece num celular emprestado:
//
//   1. corretor A usa o app — fica com 600 minutos de uso e a atividade dos dias dele;
//   2. A sai da conta → o comercial some (certo), mas o carimbo some junto e os contadores de uso
//      ficam, porque sair e voltar NA MESMA conta não pode zerar o Desempenho de quem já usava;
//   3. corretor B entra → sem carimbo, o módulo conclui "primeiro carimbo, este aparelho é seu" e
//      não limpa nada;
//   4. B abre a tela Desempenho e vê o tempo de app e a atividade DO CORRETOR A como se fossem
//      dele. Nada de conversa, Cérebro, ZIP ou nome de cliente vaza (isso já era apagado no passo
//      2) — mas os números que ele usa pra se avaliar estão errados.
//
// Guardar o carimbo depois da saída resolve os dois casos de uma vez, sem escolher entre eles:
// mesma conta volta → "mesmo-dono", o Desempenho continua; outra conta entra → "dono-mudou", os
// contadores da anterior são apagados antes de qualquer tela ler.
export async function aoSairDaConta() {
  await limparDadosComerciaisLocais();
}
