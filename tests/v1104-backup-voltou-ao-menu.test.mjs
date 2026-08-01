import fs from 'node:fs';
import assert from 'node:assert/strict';

const app = fs.readFileSync(new URL('../app.js', import.meta.url), 'utf8');
const html = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');

// v1104 — o dono perguntou "vc consegue ler o q tem salvo dos 229 leads?". A resposta honesta:
// não daqui (sem acesso ao banco por segurança) — mas o app TEM a exportação de backup completo
// (api/leads-recentes?export=full)… só que o botão dela tinha sumido do Menu numa limpeza
// antiga. A função exportarBackupCompletoV681 ficou órfã: existia, publicada em window, e
// nenhum lugar da tela a chamava. Este teste garante que o caminho inteiro existe e não volta
// a ser desligado em silêncio.

// 1. A função existe e busca a exportação completa de verdade.
{
  const fn = app.match(/async function exportarBackupCompletoV681\(btn\)\{[\s\S]*?\n\}/);
  assert.ok(fn, 'exportarBackupCompletoV681 precisa existir em app.js');
  assert.match(fn[0], /leads-recentes\?export=full/, 'e precisa chamar a exportação completa');
  assert.match(fn[0], /download = `corretor-pro-backup-completo-/, 'e baixar como arquivo nomeado');
  assert.match(app, /window\.exportarBackupCompletoV681 = exportarBackupCompletoV681/,
    'e estar publicada em window (o botão chama por lá)');
}

// 2. O botão está no Menu — era o elo que tinha sumido.
{
  assert.match(html, /onclick="exportarBackupCompletoV681\(\)"/,
    'o Menu precisa ter o botão do backup — a função existia órfã, sem nenhum chamador na tela');
  assert.match(html, /Baixar backup completo/, 'com o título em português de gente');
  // Sem passar "this": a função troca o textContent do botão, o que apagaria o conteúdo do card.
  assert.doesNotMatch(html, /exportarBackupCompletoV681\(this\)/,
    'não pode passar o botão do card — a troca de texto apagaria os elementos internos dele');
}

// 3. A rota da exportação continua existindo no servidor.
{
  const api = fs.readFileSync(new URL('../api/leads-recentes.js', import.meta.url), 'utf8');
  assert.match(api, /export=full|exportFull|export === "full"|export\b/, 'a rota de exportação precisa continuar de pé');
}

console.log('v1104-backup-voltou-ao-menu: ok');
