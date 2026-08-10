import fs from "node:fs";
import assert from "node:assert/strict";

// v1192 — O APP FICAVA PRESO NUMA TELA DE IMPORTAÇÃO QUE NUNCA TERMINAVA.
//
// Relato do dono, com print: "eu só atualizo a página e vai pra essa merda de tela". Era exato.
// Sequência real (09/08/2026): o WhatsApp compartilhou um ZIP de 0 byte; o service worker gravou
// esse vazio como pendente e redirecionou para "/?source=share-target&shared=1&shareId=...";
// o app entrou no modo importação, esperou 15s por um conteúdo que não existia e mostrou
// "o arquivo ainda não apareceu... toque em Tentar recuperar".
//
// Três defeitos empilhados:
//   1. O endereço continuava com "?shared=1&shareId=..." — e é ele que faz o app entrar no modo
//      importação. Toda atualização de página e toda reabertura do app caíam na MESMA tela
//      travada. Não havia saída pela tela.
//   2. O único botão oferecido era "Tentar recuperar" — que, num arquivo vazio, nunca teria como
//      funcionar. Botão que só pode falhar.
//   3. O texto culpava o armazenamento do app ("ainda não apareceu"), quando o que aconteceu foi
//      o WhatsApp entregar um arquivo vazio. Diagnóstico errado leva o dono pro caminho errado.

const app = fs.readFileSync(new URL("../app.js", import.meta.url), "utf8");
const sw = fs.readFileSync(new URL("../service-worker.js", import.meta.url), "utf8");

// ── 1. O service worker recusa arquivo vazio ANTES de gravar qualquer coisa ───────────────────
{
  const handler = sw.match(/async function handleShare\(request\)[\s\S]*?\n\}/);
  assert.ok(handler, "handleShare não encontrada");
  assert.match(handler[0], /body\.byteLength === 0/, "arquivo de 0 byte precisa ser detectado");
  assert.match(handler[0], /erro=arquivo-vazio/, "e recusado com motivo próprio");
  // A recusa vem ANTES de gravar: sem registro pendente vazio sobrando no aparelho.
  const posVazio = handler[0].indexOf("byteLength === 0");
  const posGrava = handler[0].indexOf("saveSharedZipInIdb");
  assert.ok(posVazio > 0 && posVazio < posGrava,
    "a checagem de vazio precisa vir antes da gravação no IndexedDB");
}

// ── 2. O app limpa o endereço quando o compartilhamento falha (a correção principal) ──────────
{
  const bloco = app.slice(app.indexOf("if(cameFromShare){"), app.indexOf("async function checkShared()"));
  assert.ok(bloco.length > 500, "não achei o tratamento de compartilhamento falho");
  assert.match(bloco, /history\.replaceState\(null,'',location\.pathname\)/,
    "o endereço precisa ser limpo — senão toda atualização de página cai de volta na tela travada");
  assert.match(bloco, /window\.__cpShareImportActive=false/,
    "o app precisa sair do modo importação");
  assert.match(bloco, /state\.pendingSharedRecordId=''/,
    "e não pode continuar apontando pra um compartilhamento que não existe");

  // A limpeza vem ANTES de desenhar o aviso: se o desenho falhar, o endereço já está limpo.
  const posLimpeza = bloco.indexOf("history.replaceState");
  const posDesenho = bloco.indexOf("resultBox");
  assert.ok(posLimpeza > 0 && posLimpeza < posDesenho,
    "limpar o endereço precisa acontecer antes de desenhar a tela de erro");
}

// ── 3. Existe saída pela tela, sempre ─────────────────────────────────────────────────────────
{
  const bloco = app.slice(app.indexOf("if(cameFromShare){"), app.indexOf("async function checkShared()"));
  assert.match(bloco, /id="btnVoltarDoShare"/, "precisa ter um botão de voltar ao app");
  assert.match(bloco, /btnVoltarDoShare'\)\?\.addEventListener\('click'/, "e ele precisa fazer alguma coisa");
  assert.match(bloco, /show\('home'\)/, "voltar ao app leva pra Home");
}

// ── 4. Arquivo vazio tem texto próprio, e NÃO oferece "Tentar recuperar" ─────────────────────
{
  const bloco = app.slice(app.indexOf("if(cameFromShare){"), app.indexOf("async function checkShared()"));
  assert.match(bloco, /registroVazio/, "o caso do arquivo vazio precisa ser reconhecido");
  assert.match(bloco, /O WhatsApp mandou o arquivo vazio \(0 KB\)/,
    "o texto precisa dizer a verdade: quem mandou vazio foi o WhatsApp");
  assert.match(bloco, /Nenhum lead seu foi alterado/,
    "o dono precisa ler, na hora, que a carteira dele não foi mexida");
  assert.match(bloco, /registroVazio\?'':'<button[^']*btnRecuperarShare/,
    "com arquivo vazio, 'Tentar recuperar' não pode nem aparecer — é um botão que só pode falhar");
  assert.match(bloco, /Number\(debug\.chosenFile\.size\) === 0/,
    "o diagnóstico gravado pelo worker também identifica o vazio (aparelho que já tinha o registro)");
}

console.log("v1192-share-falho-nao-prende-o-app: ok");
