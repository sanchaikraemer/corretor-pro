import fs from 'node:fs';
import assert from 'node:assert/strict';

// v920 — pedido do dono: remover também "Aprender de vídeo / link" (o último dos 4 recursos de
// "ensinar o Cérebro" que ainda restava depois da v919). Motivo confirmado na conversa: o dono
// testou com um vídeo do YouTube que TEM legenda (conferiu clicando no CC) e mesmo assim o app
// devolveu "Não consegui extrair texto suficiente desse vídeo" — a extração é uma raspagem não
// oficial da página do YouTube (não usa a API do Google), frágil por natureza. Decisão: em vez
// de manter/consertar, tirar o recurso. Pra aprender de vídeo agora, o dono cola o link no
// ChatGPT, pede um resumo, e cola o resumo direto no bloco de Regras comerciais.

const html = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const app = fs.readFileSync(new URL('../app.js', import.meta.url), 'utf8');
const cerebroApi = fs.readFileSync(new URL('../api/cerebro-config.js', import.meta.url), 'utf8');

// 1. O bloco de UI saiu do Cérebro.
assert.doesNotMatch(html, /Aprender de vídeo \/ link/, '"Aprender de vídeo / link" precisa ter saído do index.html');
for(const id of ['cerebroLinkInput', 'cerebroLinkBtn', 'cerebroLinkStatus', 'cerebroLinkSugestoes']){
  assert.doesNotMatch(html, new RegExp(`id="${id}"`), `#${id} não pode sobrar no index.html`);
}

// 2. O handler específico e as funções que só ele usava saíram de app.js.
for(const nome of ['cerebroLinkBtn', 'cerebroLinkInput', 'cerebroLinkStatus', 'cerebroLinkSugestoes']){
  assert.doesNotMatch(app, new RegExp(nome), `resquício de ${nome} não pode sobrar em app.js`);
}
assert.doesNotMatch(app, /function mostrarSugestoesCerebro/, 'mostrarSugestoesCerebro ficou órfã (só usada por print/link, ambos removidos) e deve sair');
assert.doesNotMatch(app, /function acrescentarRegraAoBloco/, 'acrescentarRegraAoBloco ficou órfã (só usada pelas sugestões de áudio/print/link) e deve sair');

// 3. Backend: a ação "aprender-link" e as funções exclusivas dela saíram.
assert.doesNotMatch(cerebroApi, /action === "aprender-link"/, 'ação aprender-link deve sair do backend');
for(const fn of ['function youtubeId', 'function youtubeTranscript', 'function paginaTexto', 'function extrairTextoDeUrl', 'function extrairLicoesComIA', 'function validarUrlSegura']){
  assert.doesNotMatch(cerebroApi, new RegExp(fn.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')), `${fn} era exclusiva de aprender-link e deve sair`);
}
assert.doesNotMatch(cerebroApi, /modeloTarefasSimples/, 'modeloTarefasSimples só era usado por extrairLicoesComIA (removida) — import órfão deve sair');

// 4. O que continua: transcrever-audio (nota de voz por lead) e aprender-carteira (aprendizado
// automático contínuo) são recursos DIFERENTES e não podem ser afetados por esta remoção.
assert.match(cerebroApi, /action === "transcrever-audio"/, 'transcrever-audio continua — usado pela nota de voz por lead (cp7Obs)');
assert.match(cerebroApi, /action === "aprender-carteira"/, 'aprender-carteira continua — usado pelo aprendizado automático contínuo');
assert.match(app, /function cp7ObsTranscreverBlob/, 'a nota de voz por lead não pode ser afetada');
assert.match(app, /function iniciarAprendizadoContinuoAutomatico/, 'o aprendizado automático contínuo não pode ser afetado');

// 5. O bloco de Regras comerciais em si (texto livre) continua — só perdeu os quatro sub-blocos
// de "ensinar automaticamente" (áudio, print, vídeo/link, reprocessar carteira).
assert.match(html, /id="cerebroRegrasTexto"/, 'a caixa de Regras comerciais continua existindo');

console.log('v920-remove-aprender-video-link: ok');
