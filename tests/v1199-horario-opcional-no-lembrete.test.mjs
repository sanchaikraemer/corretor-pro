import http from "node:http";
import fs from "node:fs";
import assert from "node:assert/strict";

const appSrc = fs.readFileSync(new URL("../app.js", import.meta.url), "utf8");

// 0. A tela: campo de hora opcional no painel de reagendar, e os três lugares que mostram a
// data do lembrete na Agenda também mostram a hora quando ela existir.
{
  // v1208 — o painel de reagendar da Agenda passou a ser o MESMO painel do lead
  // (cpAgendarPainelHTML), então o campo de hora mudou de id. A intenção da v1199 continua: tem
  // que existir campo de hora, opcional, no painel de reagendar.
  assert.match(appSrc, /<input type="time" class="cp1208-campo" id="\$\{pref\}Hora"/, 'precisa existir o campo de hora (opcional) no painel de reagendar');
  assert.match(appSrc, /cpAgendarPainelHTML\(id, "reag_"\+id, atual\)/, 'o painel de reagendar da Agenda precisa usar o painel único');
  assert.match(appSrc, /async function reagendarLembrete\(id, dateStr, horaStr\)\{/, 'reagendarLembrete precisa aceitar a hora, opcional');
  assert.match(appSrc, /body: JSON\.stringify\(payloadComCerebro\(\{ id, action:"reagendar-lembrete", data: dateStr, hora: horaValida \? horaStr : undefined \}\)\)/, 'a hora precisa ser enviada pro servidor quando válida');
  // v1233 — a Agenda virou lista por dia (desenho da simulação aprovada): a hora do lembrete
  // aparece na COLUNA DA ESQUERDA de cada cartão do dia (hcolHora), em destaque — melhor que o
  // texto pequeno de antes. A intenção da v1199 segue: hora gravada tem que voltar visível.
  assert.match(appSrc, /const hcolHora = \(hora\) => `<div class="cp-ag-hcol"><b>\$\{hora \? escapeHtml\(hora\) : '—'\}/,
    'a coluna do dia precisa mostrar a hora do item quando ela existir');
  const ocorrencias = (appSrc.match(/\$\{lem\.hora \? ` às \$\{escapeHtml\(lem\.hora\)\}` : ""\}/g) || []).length;
  assert.ok(ocorrencias >= 1, 'o cartão de lembrete vencido de arquivado continua mostrando a hora quando ela existir');
}

// v1199 — pedido do dono, olhando a Agenda: "minha reunião com Mateus amanhã é às 14h, mas tive
// que ir procurar no WhatsApp pra lembrar — queria já ter deixado isso salvo quando agendei o
// dia". A hora é OPCIONAL: sem ela, o comportamento é idêntico ao de sempre (meio-dia UTC só pra
// garantir a mesma data no Brasil, sem significar hora nenhuma). Com ela, a hora digitada é
// gravada de verdade, no fuso de Brasília, e volta pro corretor ver na Agenda.

const registros = [];

const server = http.createServer(async (req, res) => {
  let body = "";
  for await (const chunk of req) body += chunk;
  const url = new URL(req.url, "http://localhost");
  res.setHeader("Content-Type", "application/json");

  if (url.pathname === "/rest/v1/whatsapp_processamentos") {
    if (req.method === "GET") {
      res.statusCode = 200;
      res.end(JSON.stringify({
        timeline_json: [{ iso: "2026-07-01T10:00:00-03:00", author: "Cliente", text: "oi" }],
        resultado_analise: { aprendizado: { eventos: [] }, lembrete: null },
        nome_arquivo: "Conversa do WhatsApp com Mateus.zip",
        etapa: "Novo"
      }));
      return;
    }
    if (req.method === "PATCH") {
      registros.push(JSON.parse(body || "{}"));
      res.statusCode = 204;
      res.end();
      return;
    }
  }
  res.statusCode = 500;
  res.end(JSON.stringify({ error: `rota simulada não atendida: ${req.method} ${url.pathname}`, body }));
});

await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
try {
  const port = server.address().port;
  process.env.NODE_ENV = "test";
  process.env.SUPABASE_URL = `http://127.0.0.1:${port}`;
  process.env.SUPABASE_SERVICE_ROLE_KEY = "fake";
  const { default: handler } = await import(`../api/reanalisar-lead.js?v1199=${Date.now()}`);

  async function chamar(body) {
    let statusCode = 0, response = "";
    const req = { method: "POST", headers: {}, body };
    const res = {
      status(n) { statusCode = n; return this; },
      setHeader() { return this; },
      end(value = "") { response += value; return this; }
    };
    await handler(req, res);
    return { statusCode, payload: response ? JSON.parse(response) : null };
  }

  // As datas abaixo usam o ANO DE HOJE. Cravadas em 2026, viravam bomba-relógio: a rota recusa
  // ano anterior ao atual, então na virada do ano este teste ficaria vermelho sozinho — e, desde a
  // v1338, suíte vermelha PARA A PUBLICAÇÃO. O que se testa aqui é o horário do lembrete, não o
  // calendário.
  // 1. Com hora válida: grava o horário certo (fuso de Brasília) e devolve na resposta.
  {
    const { statusCode, payload } = await chamar({ action: "reagendar-lembrete", id: "lead-1", data: `${new Date().getUTCFullYear()}-08-11`, hora: "14:00" });
    assert.equal(statusCode, 200, `esperava 200, veio ${statusCode}`);
    assert.equal(payload?.hora, "14:00", "a resposta precisa devolver a hora gravada");
    assert.equal(payload.quando, new Date(`${new Date().getUTCFullYear()}-08-11T14:00:00-03:00`).toISOString(), "quando precisa refletir a hora escolhida, no fuso de Brasília");
    const gravado = registros.at(-1);
    assert.equal(gravado.resultado_analise.lembrete.hora, "14:00", "o registro salvo no banco precisa guardar a hora");
  }

  // 2. Sem hora: comportamento idêntico ao de sempre (meio-dia UTC, hora nula).
  {
    const { statusCode, payload } = await chamar({ action: "reagendar-lembrete", id: "lead-1", data: `${new Date().getUTCFullYear()}-08-12` });
    assert.equal(statusCode, 200);
    assert.equal(payload?.hora, null, "sem hora informada, a resposta precisa vir com hora nula");
    assert.equal(payload.quando, new Date(Date.UTC(new Date().getUTCFullYear(), 7, 12, 12, 0, 0)).toISOString(), "sem hora, continua usando meio-dia UTC (mesma data no Brasil)");
    const gravado = registros.at(-1);
    assert.equal(gravado.resultado_analise.lembrete.hora, null, "sem hora, o registro salvo precisa limpar uma hora antiga (não vazar de um agendamento anterior)");
  }

  // 3. Hora em formato inválido é ignorada (nunca quebra o agendamento por causa da hora).
  {
    const { statusCode, payload } = await chamar({ action: "reagendar-lembrete", id: "lead-1", data: `${new Date().getUTCFullYear()}-08-13`, hora: "25:99" });
    assert.equal(statusCode, 200, "hora inválida não pode derrubar o agendamento");
    assert.equal(payload?.hora, null, "hora inválida é tratada como se não tivesse vindo");
  }

  console.log("v1199-horario-opcional-no-lembrete: ok");
} finally {
  await new Promise(resolve => server.close(resolve));
}
