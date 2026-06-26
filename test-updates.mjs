import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import handler from "./server.js";

const appSource = fs.readFileSync(new URL("./app.js", import.meta.url), "utf8");
const htmlSource = fs.readFileSync(new URL("./index.html", import.meta.url), "utf8");
const dbSource = fs.readFileSync(new URL("./db.js", import.meta.url), "utf8");
const serverSource = fs.readFileSync(new URL("./server.js", import.meta.url), "utf8");
const workerSource = fs.readFileSync(new URL("./service-worker.js", import.meta.url), "utf8");

function makeResponse() {
  return {
    statusCode: 0,
    headers: {},
    body: "",
    setHeader(name, value) { this.headers[name] = value; },
    end(value) { this.body = value || ""; }
  };
}

async function invoke({ method, url, body }) {
  const req = { method, url, body, headers: { host: "localhost" } };
  const res = makeResponse();
  await handler(req, res);
  return { status: res.statusCode, payload: JSON.parse(res.body || "{}") };
}

test("v021 mantém atualização automática e evita mistura de arquivos em cache", () => {
  assert.match(appSource, /const APP_VERSION = "v021"/);
  assert.match(appSource, /const CLOUD_WORKSPACE = "corretor-pro-site"/);
  assert.match(appSource, /AUTO_SYNC_INTERVAL_MS = 15000/);
  assert.match(appSource, /startAutomaticSync\(\)/);
  assert.doesNotMatch(htmlSource, /sync-dialog/);
  assert.doesNotMatch(appSource, /data-sync-open/);
  assert.match(workerSource, /corretor-pro-v021/);
  assert.match(htmlSource, /app\.js\?v=021/);
  assert.match(appSource, /db\.js\?v=021/);
  assert.match(appSource, /whatsapp\.js\?v=021/);
  assert.match(workerSource, /networkFirstPaths/);
  assert.match(appSource, /controllerchange/);
});

test("áudios têm novas tentativas e aviso persistente de informação incompleta", () => {
  assert.match(appSource, /MAX_TRANSCRIPTION_ATTEMPTS = 3/);
  assert.match(appSource, /transcribeAudioWithRetry/);
  assert.match(appSource, /Tentando novamente/);
  assert.match(appSource, /Informação incompleta/);
  assert.match(appSource, /audiosNaoTranscritos/);
});

test("exclusão de lead existe localmente e na API", () => {
  assert.match(appSource, /data-delete-lead/);
  assert.match(appSource, /deleteCurrentLead/);
  assert.match(dbSource, /export async function deleteAtendimento/);
  assert.match(serverSource, /method === "DELETE"/);
  assert.match(serverSource, /deletedAt/);
});

test("API ignora uma cópia antiga para não desfazer exclusões ou atualizações", async () => {
  const oldUrl = process.env.SUPABASE_URL;
  const oldKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const oldFetch = globalThis.fetch;
  process.env.SUPABASE_URL = "https://example.supabase.co";
  process.env.SUPABASE_SERVICE_ROLE_KEY = "service-key";

  let calls = 0;
  globalThis.fetch = async () => {
    calls += 1;
    return {
      ok: true,
      async json() {
        return [{
          id: "existing-id",
          device_id: "corretor-pro-site",
          conversation_key: "lead-1",
          nome_lead: "Lead 1",
          arquivo_origem: null,
          ultima_mensagem_at: "2026-06-26T12:00:00.000Z",
          ultima_mensagem_resumo: "Atual",
          timeline: [],
          metadata: { deletedAt: "2026-06-26T12:00:00.000Z" },
          created_at: "2026-06-25T12:00:00.000Z",
          updated_at: "2026-06-26T12:00:00.000Z"
        }];
      }
    };
  };

  try {
    const result = await invoke({
      method: "POST",
      url: "/api/atendimentos",
      body: {
        id: "old-id",
        deviceId: "corretor-pro-site",
        conversationKey: "lead-1",
        nomeLead: "Lead 1",
        timeline: [],
        metadata: { lastReceivedAt: "2026-06-26T11:00:00.000Z" },
        createdAt: "2026-06-24T12:00:00.000Z",
        updatedAt: "2026-06-26T13:00:00.000Z"
      }
    });
    assert.equal(result.status, 200);
    assert.equal(result.payload.ignoredStale, true);
    assert.equal(calls, 1, "não deve sobrescrever o registro mais novo");
  } finally {
    globalThis.fetch = oldFetch;
    if (oldUrl === undefined) delete process.env.SUPABASE_URL;
    else process.env.SUPABASE_URL = oldUrl;
    if (oldKey === undefined) delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    else process.env.SUPABASE_SERVICE_ROLE_KEY = oldKey;
  }
});

test("DELETE grava marca de exclusão para atualizar os outros aparelhos", async () => {
  const oldUrl = process.env.SUPABASE_URL;
  const oldKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const oldFetch = globalThis.fetch;
  process.env.SUPABASE_URL = "https://example.supabase.co";
  process.env.SUPABASE_SERVICE_ROLE_KEY = "service-key";

  const calls = [];
  globalThis.fetch = async (_url, options = {}) => {
    calls.push(options);
    if (!options.method) {
      return {
        ok: true,
        async json() {
          return [{
            id: "existing-id",
            device_id: "corretor-pro-site",
            conversation_key: "lead-1",
            nome_lead: "Lead 1",
            arquivo_origem: null,
            ultima_mensagem_at: "2026-06-26T12:00:00.000Z",
            ultima_mensagem_resumo: "Mensagem",
            timeline: [{ type: "text", text: "Mensagem" }],
            metadata: {},
            created_at: "2026-06-25T12:00:00.000Z",
            updated_at: "2026-06-26T12:00:00.000Z"
          }];
        }
      };
    }
    return { ok: true, async json() { return []; } };
  };

  try {
    const result = await invoke({
      method: "DELETE",
      url: "/api/atendimentos?device_id=corretor-pro-site&conversation_key=lead-1"
    });
    assert.equal(result.status, 200);
    assert.equal(result.payload.deleted, true);
    assert.equal(calls.length, 2);
    const tombstone = JSON.parse(calls[1].body);
    assert.equal(tombstone.timeline.length, 0);
    assert.ok(tombstone.metadata.deletedAt);
  } finally {
    globalThis.fetch = oldFetch;
    if (oldUrl === undefined) delete process.env.SUPABASE_URL;
    else process.env.SUPABASE_URL = oldUrl;
    if (oldKey === undefined) delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    else process.env.SUPABASE_SERVICE_ROLE_KEY = oldKey;
  }
});
