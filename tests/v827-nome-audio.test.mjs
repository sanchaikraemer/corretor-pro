import fs from 'node:fs';
import assert from 'node:assert/strict';

const app = fs.readFileSync(new URL('../app.js', import.meta.url), 'utf8');
const pipeline = fs.readFileSync(new URL('../api/_pipeline.js', import.meta.url), 'utf8');
const leadUpdate = fs.readFileSync(new URL('../api/lead-update.js', import.meta.url), 'utf8');
const reanalisar = fs.readFileSync(new URL('../api/reanalisar-lead.js', import.meta.url), 'utf8');

// §7.4 — Nenhum nome fixo do corretor no código ativo.
for (const [nome, src] of [['app.js', app], ['_pipeline.js', pipeline], ['lead-update.js', leadUpdate], ['reanalisar-lead.js', reanalisar]]) {
  assert.doesNotMatch(src, /Sanchai/, `nome fixo não pode aparecer em ${nome}`);
}
// O nome vem da configuração do Cérebro (corretorNome), sem fallback com nome próprio.
assert.match(pipeline, /configCerebro\?\.corretorNome[\s\S]*?\|\| "o corretor"/, 'corretor vem do Cérebro, fallback genérico');

// §7.4 — Chave da janela de áudio ESTÁVEL, sem número de versão.
assert.doesNotMatch(app, /audio_window_days_v__VERSION__/, 'a chave de áudio não pode ter número de versão');
assert.match(app, /localStorage\.getItem\("corretor_pro_audio_window_days"\)/, 'usa a chave estável');
// O padrão persistente vem do Cérebro (diasImportacao).
assert.match(app, /function janelaAudioPadrao\(\)\{[\s\S]*?obterCerebroConfigParaAnalise[\s\S]*?diasImportacao/, 'padrão vem do Cérebro');
// A escolha feita na importação NÃO é persistida como padrão (é exceção da importação):
// o padrão é ajustado só pelo Cérebro, então não há setItem da chave de áudio em lugar nenhum.
assert.doesNotMatch(app, /setItem\("corretor_pro_audio_window_days/, 'escolha na importação não vira padrão persistente');

console.log('v827-nome-audio: ok');
