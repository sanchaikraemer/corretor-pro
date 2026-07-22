import fs from 'node:fs';
import assert from 'node:assert/strict';

// v919 — pedido do dono: remover do Cérebro os blocos "Ensinar por áudio", "Aprender de um
// print" e "Reprocessamento manual da carteira" (botão "Reprocessar toda a carteira"), com
// os resquícios de código ligados especificamente a eles.

const html = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const app = fs.readFileSync(new URL('../app.js', import.meta.url), 'utf8');
const cerebroApi = fs.readFileSync(new URL('../api/cerebro-config.js', import.meta.url), 'utf8');

// 1. Os 3 blocos de UI saíram do Cérebro.
for(const texto of ['Ensinar por áudio', 'Aprender de um print', 'Reprocessamento manual da carteira', 'Enviar áudio pra transcrever', 'Enviar print pra ler', 'Reprocessar toda a carteira']){
  assert.doesNotMatch(html, new RegExp(texto.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')), `"${texto}" precisa ter saído do index.html`);
}

// 2. "Aprender de vídeo / link" NÃO foi pedido pra sair — continua intacto.
assert.match(html, /Aprender de vídeo \/ link/, 'Aprender de vídeo/link não deve ser removido (não foi pedido)');
assert.match(html, /id="cerebroLinkBtn"/, 'botão de aprender por link continua no HTML');

// 3. Os handlers/IDs específicos dos 3 recursos removidos não sobraram em app.js.
for(const id of ['cerebroAudioBtn', 'cerebroAudioInput', 'cerebroImgBtn', 'cerebroImgInput', 'cerebroCarteiraBtn']){
  assert.doesNotMatch(app, new RegExp(id), `resquício de #${id} não pode sobrar em app.js`);
}

// 4. O handler de link (mantido) continua funcionando — prova que a remoção foi cirúrgica.
assert.match(app, /qs\("#cerebroLinkBtn"\)/, 'handler de "Aprender de vídeo/link" precisa continuar');

// 5. Backend: a ação "aprender-imagem" (usada só pelo "Aprender de um print") e a função que
// ela chamava saíram; "transcrever-audio" e "aprender-carteira" continuam — são compartilhadas
// com recursos que NÃO foram removidos (nota de voz por lead; aprendizado automático contínuo).
assert.doesNotMatch(cerebroApi, /action === "aprender-imagem"/, 'ação aprender-imagem deve sair do backend');
assert.doesNotMatch(cerebroApi, /function extrairLicoesDeImagem/, 'função extrairLicoesDeImagem (só usada por aprender-imagem) deve sair');
assert.match(cerebroApi, /action === "transcrever-audio"/, 'transcrever-audio continua — é usado pela nota de voz por lead (cp7Obs)');
assert.match(cerebroApi, /action === "aprender-carteira"/, 'aprender-carteira continua — é usado pelo aprendizado automático contínuo');

// 6. app.js: o botão manual de reprocessar a carteira sumiu, mas a chamada automática (que roda
// em segundo plano sem esse botão) continua chamando a mesma action.
assert.doesNotMatch(app, /qs\("#cerebroCarteiraBtn"\)/, 'o botão manual "Reprocessar toda a carteira" não pode mais existir');
assert.match(app, /function iniciarAprendizadoContinuoAutomatico/, 'aprendizado automático contínuo continua existindo');
assert.match(app, /action:"aprender-carteira", offset, limite:1, forcar/, 'o fluxo automático continua chamando aprender-carteira');

// 7. A nota de voz de observação por lead (recurso diferente, não pedido pra sair) continua.
assert.match(app, /function cp7ObsTranscreverBlob/, 'a transcrição de nota de voz do lead (cp7Obs) não pode ser afetada');

console.log('v919-remove-ensinar-audio-print-carteira: ok');
