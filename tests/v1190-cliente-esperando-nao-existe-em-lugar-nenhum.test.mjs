import fs from "node:fs";
import assert from "node:assert/strict";

// v1190 — A TRAVA SISTÊMICA da regra que o dono já deu três vezes (v1158, v1189 e de novo aqui).
//
// A regra: o Corretor Pro NÃO é integrado ao WhatsApp. Ele lê o retrato que o corretor exporta e
// importa. O corretor SEMPRE responde o cliente no WhatsApp, na hora — a mensagem do cliente só
// entra no app na importação, e nesse mesmo momento o app já analisa e gera a resposta. Logo:
// "a última fala importada é do cliente" NUNCA significa "o cliente está esperando resposta".
// Significa só que a conversa ainda não foi reimportada.
//
// A v1189 criou uma trava, mas ela olhava um lugar só (a categoria da Home). A auditoria da v1190
// achou a MESMA inferência viva em outros quatro: o motor de prioridade que desenha os cards
// (nível 1 / clienteAguardandoVoce), a liberação antecipada da espera (entraEmRetomada), o title
// da linha da Home e — a pior — o lembrete diário, que mandava notificação pro celular do
// corretor cobrando conversa já respondida, com nome de cliente na tela bloqueada.
//
// Este teste protege COMPORTAMENTO, não só nome de variável: quem quiser recriar a ideia com
// outro nome vai esbarrar nas execuções de verdade lá embaixo.
//
// v1192 — UMA EXCEÇÃO, decidida pelo dono: entraEmRetomada pode olhar se o cliente fez uma
// PERGUNTA pra deixar um lead entrar na fila do dia antes do prazo — mas só quando NÃO existe
// atendimento marcado nenhum naquele lead (a linha de emJanelaDeEspera logo acima garante isso).
// Ali não há descanso pra furar nem afirmação de pendência na tela; é só "vale um toque hoje?".
// O que continua proibido, e é o que este teste trava, é AFIRMAR que o cliente está esperando e
// FURAR o descanso de quem já foi atendido.

const app = fs.readFileSync(new URL("../app.js", import.meta.url), "utf8");
const sw = fs.readFileSync(new URL("../service-worker.js", import.meta.url), "utf8");

// Comentário é história e pode citar o que morreu; código, não.
const semComentarios = (s) => s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/[^\n]*/g, "");
const appCodigo = semComentarios(app);
const swCodigo = semComentarios(sw);

// ── 1. Símbolos e textos proibidos, em CÓDIGO ─────────────────────────────────────────────────
for (const proibido of [
  /clienteAguardandoVoce/,
  /cpLeadsAguardandoResposta/,
  /cpAtualizarRetratoCobranca/,
  /clientePrecisaResposta|bolaComCorretor|clienteSemResposta|aguardandoCorretor|clienteRespondeu/i,
  /"Cliente aguardando"|'Cliente aguardando'/,
  /Cliente esperando sua resposta/,
  /cliente respondeu e ainda não recebeu sua resposta/
]) {
  assert.doesNotMatch(appCodigo, proibido, `app.js não pode ter em código: ${proibido}`);
}
for (const proibido of [/esperando sua resposta/, /retrato\.nomes/, /nomes:/]) {
  assert.doesNotMatch(swCodigo, proibido, `service-worker.js não pode ter em código: ${proibido}`);
}

// ── 1b. A exceção da v1192 vale SÓ em entraEmRetomada, e em mais lugar nenhum ────────────────
{
  const usos = [...appCodigo.matchAll(/ultimaMsgClientePedeResposta/g)];
  assert.equal(usos.length, 2,
    `ultimaMsgClientePedeResposta só pode existir na definição e no uso de entraEmRetomada (achei ${usos.length})`);
  const retomada = appCodigo.match(/function entraEmRetomada\(l\)\{[\s\S]*?\n\}/)[0];
  assert.match(retomada, /ultimaMsgClientePedeResposta/, 'o uso permitido é o de entraEmRetomada');
  const prioridade = appCodigo.match(/function _prioridadeAtendimentoCalcular\(l\)\{[\s\S]*?\n\}/)[0];
  assert.doesNotMatch(prioridade, /ultimaMsgClientePedeResposta/, 'o motor de prioridade não pode consultar isso');
}

// ── 2. COMPORTAMENTO: a fila de fatos não tem mais nível 1 e não fura o descanso ───────────────
{
  const filaPorFatos = eval("(" + app.match(/function filaPorFatos\(f = \{\}\)\{[\s\S]*?\n\}/)[0] + ")");

  // Cliente falou por último + atendimento dentro do descanso → CONTINUA descansando.
  const descansando = filaPorFatos({ atendidoRecente: true, clienteAguardandoVoce: true });
  assert.equal(descansando.nivel, 0, "atendimento recente não pode ser furado por fala do cliente");
  assert.equal(descansando.grupo, "tratado-hoje");

  // Cliente falou por último + lembrete futuro → continua parkeado.
  assert.equal(filaPorFatos({ lembreteFuturo: true, clienteAguardandoVoce: true }).grupo, "pode-aguardar");

  // Cliente falou por último e mais nada → NÃO cria obrigação nenhuma.
  const semFato = filaPorFatos({ clienteAguardandoVoce: true });
  assert.equal(semFato.nivel, 0, "a fala do cliente sozinha não cria ação do corretor");
  assert.equal(semFato.grupo, "baixa-prioridade");

  // Nenhum nível 1 é alcançável, com qualquer combinação de fatos.
  const chaves = ["atendidoRecente","contatadoHoje","lembreteFuturo","clienteAguardandoVoce","lembreteAtrasado",
    "retornoParaHoje","negociacaoAguardando","compromissoProgramado","clientePediuTempo","emJanela",
    "travaExterna","pendenciaCorretor","retomadaPorTempo"];
  for (let mascara = 0; mascara < (1 << chaves.length); mascara += 7) { // amostra determinística ampla
    const f = {};
    chaves.forEach((k, i) => { if (mascara & (1 << i)) f[k] = true; });
    assert.notEqual(filaPorFatos(f).nivel, 1, `nível 1 reapareceu com ${JSON.stringify(f)}`);
  }

  // Os fatos com data continuam valendo — a fila não virou inútil.
  assert.equal(filaPorFatos({ lembreteAtrasado: true }).grupo, "acao-hoje");
  assert.equal(filaPorFatos({ retornoParaHoje: true }).grupo, "acao-hoje");
  assert.equal(filaPorFatos({ atendidoRecente: true, lembreteAtrasado: true }).nivel, 2,
    "lembrete vencido continua furando o descanso — é fato com data");
}

// ── 3. COMPORTAMENTO: o lembrete diário só conta fato registrado ──────────────────────────────
{
  const fn = app.match(/function cpAcoesFactuaisDeHoje\(items\)\{[\s\S]*?\n\}/)[0];
  const cpAcoesFactuaisDeHoje = new Function(
    "leadEhAtivo", "cp786CompromissoAtrasado", "cpFilaFazerAgora", "cpFazerAgoraDose",
    `${fn}; return cpAcoesFactuaisDeHoje;`
  )((l) => l.etapa !== "Arquivado", (l) => !!l._atrasado, (items) => items.filter(l => l._naFila), () => 10);

  const clienteFalouPorUltimo = {
    etapa: "Ativo", name: "Ana",
    daysSinceClientReply: 2,
    lastInteractionAt: new Date(Date.now() - 40 * 3600e3).toISOString(),
    lastCorretorMsgIso: new Date(Date.now() - 60 * 3600e3).toISOString(),
    recentMessages: [{ author: "Ana", text: "E aí, conseguiu ver?", iso: new Date().toISOString() }]
  };
  assert.equal(cpAcoesFactuaisDeHoje([clienteFalouPorUltimo]).total, 0,
    "cliente que falou por último não vira notificação — o corretor já respondeu no WhatsApp");
  assert.equal(cpAcoesFactuaisDeHoje([{ ...clienteFalouPorUltimo, _atrasado: true }]).total, 1,
    "com compromisso atrasado, aí sim — é fato com data");
  assert.equal(cpAcoesFactuaisDeHoje([{ ...clienteFalouPorUltimo, _naFila: true }]).total, 1,
    "e quem entrou na fila oficial de 'Fazer agora' também conta");
}

// ── 4. PRIVACIDADE: a notificação não leva nome de cliente ────────────────────────────────────
{
  const retrato = app.match(/function cpAtualizarRetratoAcoes\(items\)\{[\s\S]*?\n\}/)[0];
  assert.doesNotMatch(retrato, /nome/i, "o retrato gravado no aparelho não guarda nome de cliente");

  const blocoSync = swCodigo.slice(swCodigo.indexOf("periodicsync"));
  assert.match(blocoSync, /ações comerciais para revisar|ação comercial para revisar/,
    "o texto da notificação é genérico e factual");
  assert.doesNotMatch(blocoSync, /join\(', '\)/, "nada de listar nomes no corpo da notificação");
}

console.log("v1190-cliente-esperando-nao-existe-em-lugar-nenhum: ok");
