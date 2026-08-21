import fs from "node:fs";
import assert from "node:assert/strict";

// v1352 — "TEM QUE APARECER A TRANSCRIÇÃO COMO SEMPRE FOI" (dono, 21/08/2026).
//
// Ele está certo. Quando o áudio vem dentro da conversa, a transcrição aparece NA MENSAGEM, no
// minuto em que o áudio foi enviado, com o rótulo de sempre. Mandar o arquivo pela tela e ver o
// texto virar "Observação" em outro ponto da linha do tempo não é a mesma coisa: é outro registro,
// com outra cara, em outro lugar.
//
// Agora o arquivo mandado pela linha do histórico é escrito DENTRO daquela mensagem, com os mesmos
// campos que a importação usa. Daí pra frente é indistinguível de um áudio que veio no ZIP.

const rota = fs.readFileSync(new URL("../api/reanalisar-lead.js", import.meta.url), "utf8");
const app = fs.readFileSync(new URL("../app.js", import.meta.url), "utf8");

const bloco = (() => {
  const i = rota.indexOf('if (body?.action === "preencher-arquivo")');
  assert.ok(i > -1, "a ação precisa existir na rota do lead");
  return rota.slice(i, rota.indexOf('if (body?.action === "remover-item")'));
})();

// ── 1. O texto entra com o rótulo de sempre, por tipo ────────────────────────────────────────
// São os MESMOS rótulos que a importação escreve (montarTimelineComTranscricoes) e os mesmos que o
// cache por lead procura pra reaproveitar numa próxima importação. Trocar qualquer um deles quebra
// as duas coisas de uma vez.
assert.match(bloco, /text: `\[Áudio transcrito\] \$\{texto\}`/, "áudio vira '[Áudio transcrito] …'");
assert.match(bloco, /"Documento lido pela IA" : "Imagem lida pela IA"/, "PDF e foto usam os rótulos da importação");
assert.match(bloco, /audioStatus: "transcrito"/, "com o mesmo status de um áudio transcrito na importação");
assert.match(bloco, /source: "audio"/);
assert.match(bloco, /source: "visual", visualStatus: "lido"/);
{
  // Os rótulos precisam bater LETRA POR LETRA com os do pipeline e com os do cache por lead.
  const pipeline = fs.readFileSync(new URL("../api/_pipeline.js", import.meta.url), "utf8");
  const storage = fs.readFileSync(new URL("../api/processar-storage.js", import.meta.url), "utf8");
  assert.match(pipeline, /`\[Áudio transcrito\] \$\{t\.text\}`/, "sanidade: é este o rótulo da importação");
  assert.match(storage, /const AUDIO_TRANSCRITO_PREFIXO = "\[Áudio transcrito\] ";/,
    "e é este que o reaproveitamento por cliente procura");
  assert.match(storage, /const VISUAL_PREFIXOS = \["\[Imagem lida pela IA\] ", "\[Documento lido pela IA\] "\];/);
}

// ── 2. Nunca escreve por cima de conteúdo ────────────────────────────────────────────────────
// A trava é a mesma ideia da v1349: só substitui linha que hoje é APENAS marcador de arquivo não
// lido. Fala de gente e leitura já feita são intocáveis.
assert.match(bloco, /const soMarcador = linhas\.length > 0 && linhas\.every\(l => SO_MARCADOR\.test\(l\)\);/);
assert.match(bloco, /Essa mensagem já tem conteúdo — não dá pra escrever por cima/);
{
  // A regra, rodada: o que passa e o que não passa.
  const SO_MARCADOR = /^(?:\[Arquivo enviado nesta mensagem:[^\]]*\]|\[[ÁA]udio:[^\]]*\])$/i;
  const soMarcador = (t) => {
    const linhas = String(t || "").split(/\r?\n/).map(l => l.trim()).filter(Boolean);
    return linhas.length > 0 && linhas.every(l => SO_MARCADOR.test(l));
  };
  assert.equal(soMarcador("[Arquivo enviado nesta mensagem: arquivo — conteúdo não analisado pela IA]"), true);
  assert.equal(soMarcador("[Áudio: PTT-1.opus — sem_transcricao]"), true);
  assert.equal(soMarcador("Segue a tabela"), false, "fala do corretor não pode ser sobrescrita");
  assert.equal(soMarcador("[Áudio transcrito] já foi transcrito antes"), false, "nem o que já foi lido");
  assert.equal(soMarcador("Segue\n[Arquivo enviado nesta mensagem: imagem — conteúdo não analisado pela IA]"), false,
    "mensagem que tem texto E marcador também é conteúdo");
  assert.equal(soMarcador(""), false, "e mensagem vazia não é alvo de nada");
}

// ── 3. Só mexe na conversa — não inventa análise nem observação ──────────────────────────────
assert.match(bloco, /\.update\(\{ timeline_json: nova, atualizado_em: new Date\(\)\.toISOString\(\) \}\)/,
  "grava só a conversa");
assert.ok(!/resultado_analise/.test(bloco), "não pode encostar na análise salva");
assert.ok(!/observacoesManuais|observacoes:/.test(bloco), "e não vira observação — é esse o ponto do pedido");
assert.match(bloco, /\.eq\("id", id\)\.eq\("organization_id", organizationId\)/, "sempre preso à conta certa");

// ── 4. Na tela: a linha sabe QUAL mensagem está esperando o arquivo ──────────────────────────
assert.match(app, /cp1350EnviarArquivoQueFaltou\(\$\{JSON\.stringify\(String\(lead\?\.id\|\|''\)\)\},\$\{JSON\.stringify\(String\(m\.iso\|\|''\)\)\}\)/,
  "o botão da linha precisa levar o lead e o momento da mensagem");
assert.match(app, /function cp1350EnviarArquivoQueFaltou\(leadId, iso\)\{/);
assert.match(app, /cp1352Alvo = \(leadId && iso\) \? \{ leadId: String\(leadId\), iso: String\(iso\) \} : null;/);
{
  const leitor = app.match(/async function cp1349LerArquivos\(input\)\{[\s\S]*?\n\}/)[0];
  assert.match(leitor, /action:"preencher-arquivo", iso: alvo\.iso, texto, tipo, nome: primeiro\.nome/,
    "o texto lido volta pra dentro da mensagem");
  assert.match(leitor, /await recarregarLeadFoco\(alvo\.leadId\)/, "e a tela recarrega pra mostrar já transcrito");
  assert.match(leitor, /if\(!arquivosEscolhidos\.length\) cp1352Alvo = null;/,
    "cancelar o seletor não pode deixar um alvo guardado pro próximo toque");
  assert.match(leitor, /\/\^audio\\\/\/i\.test\(primeiro\.mime \|\| ""\) \? "audio"/, "o tipo sai do arquivo escolhido");
  // Se a gravação na mensagem falhar, o que foi lido não pode ser perdido: cai no campo de
  // observação, como era antes.
  assert.match(leitor, /Li o arquivo, mas não consegui colocar na mensagem/);
}
// O botão do campo de observação continua indo pra observação — e limpa o alvo do toque anterior.
assert.match(app, /onclick="cp1352LimparAlvo\(\);document\.getElementById\('cp1349ArquivosInput'\)\?\.click\(\)"/);
assert.match(app, /function cp1352LimparAlvo\(\)\{ cp1352Alvo = null; \}/);

console.log("v1352-transcricao-entra-na-mensagem: ok");

// ── 5. v1354 — DAVA CERTO E NÃO APARECIA NA TELA ─────────────────────────────────────────────
// recarregarLeadFoco tem uma proteção antiga: se a cópia local tem MAIS mensagens que a que voltou
// do servidor, ela fica com a LOCAL (a lista devolve só um recorte, e sem isso a barra de interesse
// despencava de 108 pra 4). Com o histórico completo aberto — 16 mensagens contra 4 — essa proteção
// vencia sempre, e o texto recém-gravado era descartado na hora de desenhar. O corretor mandava o
// arquivo, o servidor gravava certo, e a linha vermelha continuava lá.
{
  assert.match(app, /cp1352TrocaNaTimelineLocal\(alvo\.leadId, alvo\.iso, d2\.mensagem\);/,
    "a cópia da tela precisa receber a linha nova ANTES de recarregar");
  const fn = app.match(/function cp1352TrocaNaTimelineLocal\(leadId, iso, mensagem\)\{[\s\S]*?\n\}/)[0];
  assert.match(fn, /String\(state\.lead\.id\) !== String\(leadId\)/, "só mexe no lead que está aberto");
  assert.match(fn, /msgs\[i\] = \{ \.\.\.msgs\[i\], \.\.\.mensagem \};/, "troca a mensagem, sem perder o resto dela");
  assert.match(fn, /renderLeadFoco\(state\.lead\)/, "e redesenha na hora");
  assert.match(bloco, /return json\(res, 200, \{ ok: true, mensagem: nova\[idx\] \}\);/,
    "sanidade: é a rota que devolve a mensagem já gravada");
  // Rodando: a proteção do recarregarLeadFoco continua valendo (ela protege outra coisa), então o
  // conserto TEM que ser o patch local — este teste falha se alguém tirar o patch achando que o
  // recarregamento resolve sozinho.
  const local = [{ iso: "a" }, { iso: "b" }, { iso: "c" }, { iso: "d" }, { iso: "e" }];
  const fresco = [{ iso: "d" }, { iso: "e" }];
  assert.ok(local.length > fresco.length,
    "é este o caso real: histórico completo na tela, recorte curto vindo da lista");
  assert.match(app, /if\(msgsLocal\.length>msgsFresh\.length\)\{/,
    "a proteção do recarregamento continua no código — por isso o patch local é obrigatório");
}
