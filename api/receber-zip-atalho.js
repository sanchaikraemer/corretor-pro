// Recebe o ZIP exportado do WhatsApp mandado direto pelo Atalho (Shortcuts) do iPhone — o
// caminho que resolve, sem App Store nem conta de desenvolvedor Apple, o "compartilhar direto
// pro ícone do app" que no Android já existe pelo share_target do manifest.json (ver
// NOTAS-v1035.md). Autenticado pela chave pessoal do corretor (resolveOrganizationIdByAtalhoToken),
// não pela sessão do app nem pela chave compartilhada — o Atalho não sabe renovar login.
//
// Como não há ninguém olhando a tela esperando (o corretor só toca em "Corretor Pro" no
// Compartilhar do WhatsApp e segue a vida), esta rota processa E JÁ SALVA o lead sozinha, ao
// contrário do fluxo manual (importar → conferir → "Salvar lead"). Mesma lógica de
// persistProcessingResult que api/lead-update.js (ação "salvar-novo") já usa.
import { resolveOrganizationIdByAtalhoToken, persistProcessingResult } from "./_persistence.js";
import { processZipBuffer, marcarAprendizadoPendente, analiseSemMensagemValida } from "./_pipeline.js";
import { lerZipDaRequisicao } from "./_zipUpload.js";

function json(res, status, payload) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  res.end(JSON.stringify(payload));
}

export default async function handler(req, res) {
  const organizationId = await resolveOrganizationIdByAtalhoToken(req, res);
  if (!organizationId) return;
  if (req.method !== "POST") return json(res, 405, { ok: false, error: "Método não permitido." });

  try {
    const { zipBuffer, audioWindowDays } = await lerZipDaRequisicao(req, { maxBytesMultipart: 80 * 1024 * 1024, maxBytesJson: 110 * 1024 * 1024 });

    if (!zipBuffer?.length) {
      return json(res, 400, {
        ok: false,
        error: "Nenhum arquivo ZIP foi recebido.",
        hint: "Confira se o Atalho está mandando o arquivo exportado do WhatsApp no corpo do pedido."
      });
    }

    const result = await processZipBuffer(zipBuffer, { audioWindowDays, organizationId });
    const analysis = result?.analysis || null;
    const principalOk = String(analysis?.messages?.a || "").trim().length >= 10;
    const semMensagemAgoraOk = analiseSemMensagemValida(analysis);
    if (!analysis || analysis.mode === "erro_api" || analysis.mode === "sem_api" || analysis.sugestoesPendentes === true || (!principalOk && !semMensagemAgoraOk)) {
      return json(res, 502, {
        ok: false,
        error: "A conversa foi importada, mas a análise comercial não foi concluída. Abra o Corretor Pro e importe esse ZIP por lá pra tentar de novo.",
        details: analysis?.error || (analysis?.validacaoSugestoes || []).join("; ") || "A IA não devolveu uma condução comercial válida.",
        recoverable: true
      });
    }

    const persistence = await persistProcessingResult({
      result, source: "atalho-ios", fileName: result?.txtFile || null, fileSize: zipBuffer.length,
      forceNew: false, organizationId
    });
    const salvoId = persistence?.processing?.id;
    if (!salvoId) {
      return json(res, 502, { ok: false, error: "A conversa foi analisada, mas não consegui salvar o lead agora. Abra o Corretor Pro e importe esse ZIP por lá.", recoverable: true });
    }
    if (Array.isArray(result?.timeline) && result.timeline.length) {
      await marcarAprendizadoPendente({ leadId: String(salvoId), motivo: "atalho-ios", organizationId }).catch(() => {});
    }

    return json(res, 200, { ok: true, leadId: salvoId });
  } catch (error) {
    console.error("[api/receber-zip-atalho]", error);
    return json(res, error?.statusCode || 500, {
      ok: false,
      error: "Falha ao importar e analisar a conversa recebida pelo Atalho.",
      details: error?.message || String(error),
      recoverable: true
    });
  }
}
