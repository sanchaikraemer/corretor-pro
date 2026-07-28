import fs from 'node:fs';
import assert from 'node:assert/strict';

const app = fs.readFileSync(new URL('../app.js', import.meta.url), 'utf8');

// v1065 — o dono mandou print do "Registrar observação" com o ditado por voz repetindo a frase
// em cascata: "ofereci ofereci o ofereci o ofereci o ofereci o gabro ofereci o gabro ofereci o
// gabro mas...". Causa diferente da do v1032: dessa vez o Android manda cada trecho final numa
// posição NOVA do array de resultados (não repete a mesma posição), mas o trecho não é só a
// palavra nova — é a FRASE INTEIRA dita até ali, crescendo. Juntar cada posição vira uma cascata
// de repetição. A correção precisa perceber que um trecho novo que já começa com o trecho
// anterior inteiro é a MESMA frase crescendo, e substituir em vez de somar.

{
  assert.match(app, /function cp7ObsMesclarFinais\(lista\)\{/,
    'precisa existir a função que mescla trechos finais crescentes sem duplicar');
  assert.match(app, /cp7ObsMesclarFinais\(finaisPorIndice\.filter\(Boolean\)\)/,
    'onresult e onend precisam usar a mesclagem em vez de só juntar os trechos crus');

  const iniciarMatch = app.match(/function cp7ObsIniciarDitado\(btn\)\{[\s\S]*?\n\}/);
  assert.ok(iniciarMatch, 'cp7ObsIniciarDitado não encontrada por inteiro');
  const toggleMatch = app.match(/function cp7ObsToggleDitado\(btn\)\{[\s\S]*?\n\}/);
  assert.ok(toggleMatch, 'cp7ObsToggleDitado não encontrada por inteiro');
  const mesclarMatch = app.match(/function cp7ObsMesclarFinais\(lista\)\{[\s\S]*?\n\}/);
  assert.ok(mesclarMatch, 'cp7ObsMesclarFinais não encontrada por inteiro');

  class FakeRecognition {
    constructor(){ FakeRecognition.instancias.push(this); }
    start(){ this.iniciado = true; }
    stop(){ if(typeof this.onend === 'function') this.onend(); }
  }
  FakeRecognition.instancias = [];
  const elementos = {};
  const sandbox = {
    qs: (sel) => elementos[sel] || (elementos[sel] = { value: '', innerHTML: '', textContent: '' }),
    escapeHtml: (v) => String(v),
    window: { SpeechRecognition: FakeRecognition }
  };
  const fnCorpo = new Function('qs', 'escapeHtml', 'window', `
    let _cp7ObsReco = null, _cp7ObsRecoTextoBase = "", _cp7ObsDitadoQuerido = false;
    ${mesclarMatch[0]}
    ${iniciarMatch[0]}
    ${toggleMatch[0]}
    return { iniciar: (btn) => cp7ObsToggleDitado(btn) };
  `)(sandbox.qs, sandbox.escapeHtml, sandbox.window);

  const resultadoFinal = (texto) => Object.assign([{ transcript: texto }], { isFinal: true });

  const btnFake = elementos['#cp7ObsGravarBtn'] = { textContent: '' };
  fnCorpo.iniciar(btnFake);
  const reco = FakeRecognition.instancias[0];
  assert.ok(reco.iniciado, 'precisa ligar o reconhecimento');

  // Cada evento manda a frase inteira dita até ali, numa posição NOVA (0, 1, 2, 3...) — exatamente
  // o padrão do print real ("ofereci" -> "ofereci o" -> "ofereci o gabro" -> ...).
  reco.onresult({ resultIndex: 0, results: [ resultadoFinal('ofereci') ] });
  assert.equal(elementos['#cp7ObsTexto'].value, 'ofereci');

  reco.onresult({ resultIndex: 1, results: [ resultadoFinal('ofereci'), resultadoFinal('ofereci o') ] });
  assert.equal(elementos['#cp7ObsTexto'].value, 'ofereci o',
    'o trecho novo já é a frase inteira crescendo — não pode virar "ofereci ofereci o"');

  reco.onresult({ resultIndex: 2, results: [ resultadoFinal('ofereci'), resultadoFinal('ofereci o'), resultadoFinal('ofereci o gabro') ] });
  assert.equal(elementos['#cp7ObsTexto'].value, 'ofereci o gabro');

  reco.onresult({ resultIndex: 3, results: [
    resultadoFinal('ofereci'), resultadoFinal('ofereci o'), resultadoFinal('ofereci o gabro'),
    resultadoFinal('ofereci o gabro mas eles não confirmaram')
  ] });
  assert.equal(elementos['#cp7ObsTexto'].value, 'ofereci o gabro mas eles não confirmaram',
    'texto final precisa ser só a frase completa, sem nenhum pedaço repetido antes dela');

  console.log('v1065 (ditado): frase crescendo em posições novas não duplica mais o texto — ok');
}

console.log('v1065-ditado-nao-repete-frase-crescendo: ok');
