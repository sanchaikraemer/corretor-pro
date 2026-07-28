import fs from 'node:fs';
import assert from 'node:assert/strict';

const app = fs.readFileSync(new URL('../app.js', import.meta.url), 'utf8');

// v1032 — o dono mandou print do "Registrar observação" com o ditado por voz duplicando tudo em
// cascata: "vamos vamos Vamos Vamos Vamos retomar Vamos retomar Vamos retomar Vamos retomar
// informando Vamos retomar informando...". Causa: em vários Android, o reconhecimento de fala do
// navegador reenvia como "final" um trecho que já tinha mandado como final antes (bug conhecido
// do continuous:true — ev.resultIndex nem sempre pula o que já foi processado). O código antigo
// (v1026/v1028) tratava cada evento somando a string "final" inteira do evento em cima do texto
// já acumulado — então um reenvio duplicava tudo que já estava ali.

{
  // Estrutura precisa guardar cada trecho final PELO ÍNDICE do resultado (não só somar string) —
  // é isso que faz um reenvio substituir em vez de duplicar.
  assert.match(app, /const finaisPorIndice = \[\];/,
    'cp7ObsIniciarDitado precisa guardar os trechos finais num array indexado pela posição do resultado');
  assert.match(app, /finaisPorIndice\[i\] = trecho\.trim\(\);/,
    'cada trecho final precisa ser gravado na SUA posição (sobrescreve se vier de novo, não duplica)');
  assert.doesNotMatch(app, /final \+= trecho/,
    'não pode sobrar o jeito antigo de ir somando string "final" direto (é isso que duplicava)');

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
    return { iniciar: (btn) => cp7ObsToggleDitado(btn), querido: () => _cp7ObsDitadoQuerido, base: () => _cp7ObsRecoTextoBase };
  `)(sandbox.qs, sandbox.escapeHtml, sandbox.window);

  const resultadoFinal = (texto) => Object.assign([{ transcript: texto }], { isFinal: true });
  const resultadoParcial = (texto) => Object.assign([{ transcript: texto }], { isFinal: false });

  const btnFake = elementos['#cp7ObsGravarBtn'] = { textContent: '' };
  fnCorpo.iniciar(btnFake); // liga o ditado
  const reco1 = FakeRecognition.instancias[0];
  assert.ok(reco1.iniciado, 'precisa ligar o reconhecimento');

  // Reenvio típico do bug: resultIndex fica travado em 0 e o array de resultados vai crescendo —
  // cada evento reprocessa os índices já finalizados ANTES, junto com o novo.
  reco1.onresult({ resultIndex: 0, results: [ resultadoFinal('Vamos') ] });
  assert.equal(elementos['#cp7ObsTexto'].value, 'Vamos', '1º trecho final aparece normal');

  reco1.onresult({ resultIndex: 0, results: [ resultadoFinal('Vamos'), resultadoFinal('retomar') ] });
  assert.equal(elementos['#cp7ObsTexto'].value, 'Vamos retomar',
    'reenviar o índice 0 de novo (junto com o novo índice 1) NÃO pode duplicar "Vamos" — era isso que virava "Vamos Vamos retomar"');

  reco1.onresult({ resultIndex: 0, results: [ resultadoFinal('Vamos'), resultadoFinal('retomar'), resultadoFinal('informando') ] });
  assert.equal(elementos['#cp7ObsTexto'].value, 'Vamos retomar informando',
    'mais um reenvio do zero não pode duplicar "Vamos retomar" de novo');

  // resultIndex "se comporta" dessa vez (só manda o novo) — precisa continuar funcionando normal.
  reco1.onresult({ resultIndex: 3, results: [ resultadoFinal('Vamos'), resultadoFinal('retomar'), resultadoFinal('informando'), resultadoFinal('que') ] });
  assert.equal(elementos['#cp7ObsTexto'].value, 'Vamos retomar informando que', 'resultIndex correto soma só o trecho novo');

  // Fala em andamento (parcial) some do texto final acumulado, mas aparece "ao vivo" no fim.
  reco1.onresult({ resultIndex: 4, results: [ resultadoFinal('Vamos'), resultadoFinal('retomar'), resultadoFinal('informando'), resultadoFinal('que'), resultadoParcial('vamos') ] });
  assert.equal(elementos['#cp7ObsTexto'].value, 'Vamos retomar informando que vamos', 'trecho parcial aparece junto, ainda não confirmado');

  // Reconhecimento para sozinho (silêncio) e reinicia automaticamente — o parcial não confirmado
  // ("vamos", do evento acima) fica pra trás (nunca virou final), mas nada do que JÁ era final
  // pode se perder nem duplicar.
  reco1.onend();
  assert.equal(FakeRecognition.instancias.length, 2, 'silêncio reinicia sozinho');
  const reco2 = FakeRecognition.instancias[1];
  assert.equal(fnCorpo.base(), 'Vamos retomar informando que',
    'ao reiniciar sozinho, o texto confirmado (só o que já era final) precisa ficar guardado exatamente uma vez — sem duplicar e sem incorporar o parcial não confirmado');

  // Depois do reinício automático, o novo reconhecimento usa índices do ZERO de novo — mas some
  // ao texto já acumulado, não substitui nem duplica.
  reco2.onresult({ resultIndex: 0, results: [ resultadoFinal('avisar') ] });
  assert.equal(elementos['#cp7ObsTexto'].value, 'Vamos retomar informando que avisar',
    'depois do reinício, a fala nova soma ao texto acumulado sem repetir nada de antes');

  console.log('v1032 (ditado): reenvio de resultado já finalizado (bug do Android) não duplica mais o texto — ok');
}

console.log('v1032-ditado-nao-duplica-resultado-reenviado: ok');
