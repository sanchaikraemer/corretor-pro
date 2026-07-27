import { processZipBuffer } from "./_pipeline.js";
import { resolveOrganizationId } from "./_persistence.js";
import { lerZipDaRequisicao } from "./_zipUpload.js";

function json(res, status, payload) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  res.end(JSON.stringify(payload));
}

export default async function handler(req, res) {
  const organizationId = await resolveOrganizationId(req, res);
  if (!organizationId) return;
  if (req.method !== "POST") return json(res, 405, { ok: false, error: "Método não permitido." });

  try {
    const { zipBuffer, audioWindowDays, cerebroConfig } = await lerZipDaRequisicao(req, { maxBytesMultipart: 80 * 1024 * 1024, maxBytesJson: 110 * 1024 * 1024 });

    if (!zipBuffer?.length) {
      return json(res, 400, {
        ok: false,
        error: "Nenhum arquivo ZIP foi recebido.",
        hint: "Atualize o aplicativo e tente importar novamente."
      });
    }

    const result = await processZipBuffer(zipBuffer, { audioWindowDays, cerebroConfig, organizationId });
    const analysis = result?.analysis || null;
    const messages = analysis?.messages || {};
    const complete = [messages.a, messages.b, messages.c].every(v => String(v || "").trim().length >= 10);
    if (!analysis || analysis.mode === "erro_api" || analysis.mode === "sem_api" || analysis.sugestoesPendentes === true || !complete) {
      return json(res, 502, {
        ok: false,
        error: "A conversa foi importada, mas a análise comercial não foi concluída.",
        details: analysis?.error || (analysis?.validacaoSugestoes || []).join("; ") || "A IA não devolveu as três mensagens.",
        recoverable: true
      });
    }

    return json(res, 200, { ok: true, compatibilityRoute: true, autoSaved: false, ...result });
  } catch (error) {
    console.error("[api/analisar]", error);
    return json(res, error?.statusCode || 500, {
      ok: false,
      error: "Falha ao importar e analisar a conversa.",
      details: error?.message || String(error),
      recoverable: true
    });
  }
}
