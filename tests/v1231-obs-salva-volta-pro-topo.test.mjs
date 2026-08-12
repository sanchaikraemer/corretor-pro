import fs from 'node:fs';
import assert from 'node:assert/strict';

// v1231 — pedido do dono (12/08/2026): "após salvar uma obs, quero que volte a tela para o topo
// do lead também" — mesma regra que o confirmar agendamento ganhou na v1229. A subida tem que
// vir ANTES da remontagem (renderLeadFoco), porque a restauração de rolagem da remontagem
// devolve a página pra posição capturada — se capturar a posição antiga, a tela fica lá embaixo.

const app = fs.readFileSync(new URL('../app.js', import.meta.url), 'utf8');

const ini = app.indexOf('window.cp7ObsSalvar = async function(btn)');
const fim = app.indexOf('window.ui670Reanalisar=', ini);
assert.ok(ini > -1 && fim > ini, 'cp7ObsSalvar não encontrada em app.js');
const bloco = app.slice(ini, fim);

const sobeTopo = bloco.indexOf('scrollTo');
const remonta = bloco.indexOf('renderLeadFoco(lead)');
assert.ok(sobeTopo > -1, 'depois de salvar a observação, a página precisa subir pro topo da tela do lead');
assert.ok(remonta > -1, 'a remontagem (renderLeadFoco) precisa continuar existindo no salvar observação');
assert.ok(sobeTopo < remonta, 'a subida pro topo tem que vir ANTES da remontagem — senão a restauração de rolagem devolve a tela pra onde estava');

console.log('v1231-obs-salva-volta-pro-topo: ok');
