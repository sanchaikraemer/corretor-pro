import fs from "node:fs";
import assert from "node:assert/strict";

// v1196 — O CAMPO "Período padrão dos áudios" SAIU DA TELA DO CÉREBRO, MAS A PROTEÇÃO FICOU.
//
// Contexto (conversa com o dono, 10/08/2026): depois que a v1141 fez a reimportação reaproveitar
// transcrição e análise, o dono propôs apagar o período dos áudios de vez. A resposta combinada
// foi o caminho do meio: o campo some da tela (ninguém ajustava e só gerava dúvida), mas o limite
// de 90 dias continua valendo POR DENTRO na primeira importação — sem ele, importar um cliente
// antigo com anos de conversa transcreveria (e cobraria) todos os áudios velhos de uma vez.
//
// Este teste guarda os dois lados do combinado: sem campo na tela E com a proteção viva no código.

const html = fs.readFileSync(new URL("../index.html", import.meta.url), "utf8");
const app = fs.readFileSync(new URL("../app.js", import.meta.url), "utf8");
const importacao = fs.readFileSync(new URL("../js/importacao.js", import.meta.url), "utf8");
const pipeline = fs.readFileSync(new URL("../api/_pipeline.js", import.meta.url), "utf8");
const cerebroApi = fs.readFileSync(new URL("../api/cerebro-config.js", import.meta.url), "utf8");

// ── 1. O campo não existe mais na tela ─────────────────────────────────────────────────────────
assert.doesNotMatch(html, /id="cerebroDiasImportacao"/, "o campo do período não pode voltar pra tela do Cérebro");
assert.doesNotMatch(html, /Período padrão dos áudios/, "nem o rótulo do campo pode sobrar na tela");
assert.doesNotMatch(app, /#cerebroDiasImportacao/, "app.js não pode ler um campo que não existe");
assert.doesNotMatch(importacao, /#cerebroDiasImportacao/, "a importação não pode ler um campo que não existe");

// ── 2. A proteção de custo continua viva por dentro ────────────────────────────────────────────
// O servidor segue recortando a transcrição de áudio pela janela de dias (padrão 90).
assert.match(pipeline, /function getDiasJanelaConfig\([\s\S]*?return 90;/, "o servidor mantém a janela de áudio com padrão 90");
assert.match(pipeline, /montarPlanoJanelaAudios\(messagesAll, audioFiles, options\.audioWindowDays \?\? await getDiasJanelaConfig/, "a importação continua aplicando a janela aos áudios");
assert.match(cerebroApi, /diasImportacao: 90,/, "o padrão 90 continua nos defaults do Cérebro no servidor");

// O app continua resolvendo o período sozinho (do que está salvo) e mandando pro servidor.
assert.match(importacao, /function janelaAudioPadrao\(\)\{[\s\S]*?diasImportacao/, "o período aplicado vem do que está salvo no Cérebro");
assert.match(importacao, /const audioWindowDays = janelaAudioDaImportacao\(\);/, "a importação segue resolvendo o período sem perguntar");

// ── 3. Salvar ou zerar o Cérebro NÃO rebaixa um valor salvo pra 90 ─────────────────────────────
// Quem tinha um valor próprio (ex.: 180) salvo antes da v1196 continua com ele: o save preserva
// o que está salvo em vez de ler um formulário que não existe mais (ler qs(...) de um campo
// ausente viraria NaN e cravaria 90 por cima do valor da pessoa, silenciosamente).
assert.match(app, /function cpDiasImportacaoSalvo\(\)\{[\s\S]*?diasImportacao[\s\S]*?return 90;/, "existe o leitor do valor salvo com padrão 90");
{
  const salvar = app.match(/async function salvarCerebro\(\)\{[\s\S]*?\n\}/)[0];
  assert.match(salvar, /diasImportacao: cpDiasImportacaoSalvo\(\)/, "salvar o Cérebro preserva o período já salvo");
  const zerar = app.match(/async function zerarCerebroTudo\(\)\{[\s\S]*?\n\}/)[0];
  assert.match(zerar, /diasImportacao: cpDiasImportacaoSalvo\(\)/, "zerar o Cérebro também preserva o período");
}

console.log("v1196-periodo-audios-sem-campo-na-tela: ok");
