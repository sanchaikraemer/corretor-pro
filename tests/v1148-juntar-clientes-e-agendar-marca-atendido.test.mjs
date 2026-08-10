import fs from "node:fs";
import assert from "node:assert/strict";

// v1148 — dois pedidos do dono na sequência (05/08/2026):
//
//  1. "sim, mesma pessoa" — ele tinha DOIS cadastros do mesmo cliente (a lista "Sem atender 30d+"
//     mostrava um deles como abandonado enquanto ele acabara de atender o outro). Isso nasce quando
//     o arquivo exportado do WhatsApp vem com nome diferente em cada importação. O app só sabia
//     APAGAR duplicata — e apagar perde a conversa de um dos dois. Agora sabe JUNTAR.
//
//  2. "se for feito agendamento, tem que marcar como atendido também, automaticamente, como se
//     copiasse sugestão de msg" — agendar um retorno é uma ação real dele com aquele cliente, então
//     grava o MESMO evento de atendimento que a cópia de mensagem e o botão "Marcar" gravam.

const leadUpdate = fs.readFileSync(new URL("../api/lead-update.js", import.meta.url), "utf8");
const reanalisar = fs.readFileSync(new URL("../api/reanalisar-lead.js", import.meta.url), "utf8");
const app = fs.readFileSync(new URL("../app.js", import.meta.url), "utf8");

// ── 1. Juntar clientes: a ação existe e usa as mesmas mesclagens da reimportação ───────────────
{
  assert.match(leadUpdate, /case "juntar-clientes": return await acaoJuntarClientes\(id, body\?\.idDuplicado, res, organizationId\)/,
    "a ação está ligada no roteador da rota");
  const ini = leadUpdate.indexOf("async function acaoJuntarClientes(");
  const fim = leadUpdate.indexOf("async function acaoApagar(", ini);
  assert.ok(ini > -1 && fim > ini, "a função existe");
  const fn = leadUpdate.slice(ini, fim);

  assert.match(fn, /_mesclarTimelinesV681\(tlSai, tlFica\)/, "junta as duas conversas com a mesma função da reimportação (sem repetir mensagem)");
  assert.match(fn, /_mesclarAnaliseV681/, "e a mesma mesclagem de análise");
  assert.match(fn, /\.eq\("organization_id", organizationId\)/, "tudo preso à empresa do corretor");
  assert.match(fn, /if \(manter === remover\) return json\(res, 400/, "não deixa juntar um cadastro com ele mesmo");
  assert.match(fn, /if \(!fica \|\| !sai\) return json\(res, 404/, "os dois cadastros precisam existir nesta conta");

  // A ORDEM importa: grava a fusão ANTES de apagar o duplicado. Se apagasse primeiro e a gravação
  // falhasse, a conversa do duplicado estaria perdida.
  const posGravar = fn.indexOf('.eq("id", manter)');
  const posApagar = fn.indexOf('.delete().eq("id", remover)');
  assert.ok(posGravar > -1 && posApagar > posGravar,
    "a fusão é gravada primeiro; o duplicado só sai depois (senão uma falha perderia a conversa)");
  // Falha ao apagar não desfaz nem esconde: a conversa já está junta e o dono é avisado.
  assert.match(fn, /avisoDuplicado/, "se o duplicado não puder ser apagado, o dono é avisado");

  // Decisões do corretor no cadastro que FICA nunca são sobrescritas pelo que sai.
  assert.match(fn, /lembrete: \(anaFica\.lembrete && anaFica\.lembrete\.auto !== true\) \? anaFica\.lembrete : null/,
    "o lembrete do cadastro que fica manda (e lembrete automático não ressuscita)");
  assert.match(fn, /memoria: \{ \.\.\.\(anaSai\.memoria \|\| \{\}\), \.\.\.\(anaFica\.memoria \|\| \{\}\) \}/,
    "a memória escrita à mão no cadastro que fica prevalece");
  assert.match(fn, /confirmedAppointments: \[\]/, "agendamento nunca nasce de gravação (regra da v1023)");
  assert.match(fn, /_clientesJuntados/, "fica registrado no cadastro o que foi juntado, e quando");
}

// ── 2. A tela: botão no cliente, escolha com busca e confirmação antes de juntar ───────────────
{
  // v1187 — o botão morava num painel da tela do cliente que não era desenhado desde a v908; por
  // isso esta fusão nunca esteve ao alcance de ninguém. Ele NÃO volta pra tela do cliente: lá o
  // corretor não tem como saber que existe um cadastro repetido. Quem sabe é o app, e ele já
  // pergunta na importação. Aqui fica só a saída manual, dentro de Editar lead.
  assert.match(app, /id="editLeadJuntar"/, "a fusão manual precisa ter porta de entrada em Editar lead");
  assert.match(app, /editLeadJuntar"\)\?\.addEventListener\("click"[^\n]*cp1148JuntarCliente/,
    "o botão de Editar precisa realmente abrir a escolha do cadastro duplicado");
  const ini = app.indexOf("window.cp1148JuntarCliente = async function(idFica, nomeFica){");
  assert.ok(ini > -1, "a função da tela existe");
  const fn = app.slice(ini, ini + 5200);
  assert.match(fn, /cp903Confirm\(\{ titulo:"Juntar clientes"/, "pede confirmação nomeando os dois cadastros");
  assert.match(fn, /action:"juntar-clientes", id, idDuplicado: idSai/, "manda os dois ids pra rota");
  assert.match(fn, /Não tem como desfazer/, "avisa que não dá pra desfazer");
  assert.match(fn, /String\(l\.id\) !== id/, "não oferece o próprio cliente na lista");
  assert.match(fn, /removerLeadDosCaches\(idSai\)[\s\S]*invalidarLeadsCache\(\)/, "limpa o duplicado da tela na hora");
}

// ── 3. Agendar marca atendimento (o mesmo evento da cópia de mensagem) ────────────────────────
{
  const ini = reanalisar.indexOf('if (body?.action === "reagendar-lembrete")');
  const fim = reanalisar.indexOf('if (body?.action === "remover-lembrete")', ini);
  assert.ok(ini > -1 && fim > ini, "a ação de agendar existe");
  const fn = reanalisar.slice(ini, fim);
  assert.match(fn, /evento: "contato_manual", estilo: null, detalhes: \{ tipo: "Agendamento", de: "agendamento" \}/,
    "grava o MESMO evento de atendimento que a cópia de mensagem e o botão Marcar");
  assert.match(fn, /jaHoje = evs\.findIndex\(e => e\?\.evento === "contato_manual" && e\?\.detalhes\?\.de === "agendamento"/,
    "agendar duas vezes no mesmo dia atualiza o horário em vez de contar dois atendimentos");
  assert.match(fn, /atendimentoRegistrado: true, atendimentoQuando:/,
    "a resposta diz que registrou e quando — a tela usa isso pra marcar na hora");

  // A tela reflete na hora, sem esperar a carteira recarregar (mesma marcação da cópia).
  const iniApp = app.indexOf("async function reagendarLembrete(id, dateStr, horaStr){");
  assert.ok(iniApp > -1, "reagendarLembrete precisa existir (agora com horaStr opcional, v1199)");
  const fnApp = app.slice(iniApp, iniApp + 3200);
  assert.match(fnApp, /if\(d\?\.atendimentoRegistrado\)\{/, "a tela usa a confirmação do servidor");
  assert.match(fnApp, /ui667AplicarAtendidoLocal\(state\.lead, quando, [^)]*detalhes\)/, "marca o cliente aberto");
  assert.match(fnApp, /for\(const lista of \[state\.itemsAtivos, state\.todosLeads, state\.leads\]\)/, "e todas as cópias em memória (fila da Home)");
  assert.match(fnApp, /marcado como atendido hoje/, "o aviso na tela diz o que aconteceu");
}

console.log("v1148-juntar-clientes-e-agendar-marca-atendido: ok");
