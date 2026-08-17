import fs from 'node:fs';
import assert from 'node:assert/strict';
import { corrigirSaudacaoAbertura, saudacaoAgora, saudacaoParaHora } from '../js/saudacao.js';

// v1218 — print do dono às 17h37: a sugestão de mensagem abria com *"Boa noite Luane, tudo
// certo?"*. Pergunta dele: "qual a regra q deve ser seguida?".
//
// A régua do português do Brasil (a mesma que a saudação da Home já usava):
//   bom dia até 11h59 · boa tarde das 12h00 às 17h59 · boa noite das 18h00 em diante.
//
// A hora certa já ia no prompt da análise; a RÉGUA não ia — e a IA chutava a faixa do dia.

// ── 1. A régua, hora a hora (inclusive as viradas, que é onde erro aparece) ───────────────────
{
  const esperado = {
    0:'Bom dia', 6:'Bom dia', 11:'Bom dia',
    12:'Boa tarde', 15:'Boa tarde', 17:'Boa tarde',
    18:'Boa noite', 21:'Boa noite', 23:'Boa noite'
  };
  for(const [hora, saud] of Object.entries(esperado)){
    assert.equal(saudacaoParaHora(Number(hora)), saud, `${hora}h precisa ser "${saud}"`);
  }
  assert.equal(saudacaoParaHora(11), 'Bom dia', '11h59 ainda é de manhã');
  assert.equal(saudacaoParaHora(12), 'Boa tarde', 'meio-dia já é tarde');
  assert.equal(saudacaoParaHora(17), 'Boa tarde', '17h37 (o horário do print) é TARDE');
  assert.equal(saudacaoParaHora(18), 'Boa noite', '18h em ponto já é noite');
}

// ── 2. A hora é a do corretor (Brasil), não a do servidor ────────────────────────────────────
{
  // 11/08/2026 20h37 UTC = 17h37 em São Paulo — exatamente o caso do print. Sem fixar o fuso, a
  // análise (que roda em servidor UTC) diria "Boa noite".
  const momentoDoPrint = new Date('2026-08-11T20:37:00Z');
  assert.equal(saudacaoAgora(momentoDoPrint), 'Boa tarde', 'às 17h37 no Brasil a saudação é "Boa tarde"');
  assert.equal(saudacaoAgora(new Date('2026-08-11T21:05:00Z')), 'Boa noite', '18h05 no Brasil já é noite');
  assert.equal(saudacaoAgora(new Date('2026-08-11T12:30:00Z')), 'Bom dia', '9h30 no Brasil é de manhã');
}

// ── 3. A correção troca SÓ a saudação de abertura ────────────────────────────────────────────
{
  const tarde = new Date('2026-08-11T20:37:00Z'); // 17h37 no Brasil
  assert.equal(
    corrigirSaudacaoAbertura('Boa noite Luane, tudo certo? Conseguiu conversar com seus clientes?', tarde),
    'Boa tarde Luane, tudo certo? Conseguiu conversar com seus clientes?',
    'a mensagem do print precisa sair com "Boa tarde"'
  );
  assert.equal(corrigirSaudacaoAbertura('Oi, boa noite! Tudo bem?', tarde), 'Oi, boa tarde! Tudo bem?',
    'saudação depois de um "oi" também é abertura');
  assert.equal(corrigirSaudacaoAbertura('BOA NOITE, Luane!', tarde), 'BOA TARDE, Luane!',
    'mantém o jeito que foi escrito (tudo em maiúsculas continua)');
  assert.equal(corrigirSaudacaoAbertura('Boa tarde Luane, tudo certo?', tarde), 'Boa tarde Luane, tudo certo?',
    'quando já está certa, não mexe em nada');

  // O que NÃO pode ser tocado: o código não reescreve conteúdo comercial, só a saudação inicial.
  const semSaudacao = 'Luane, consegui a simulação do Evolutti. Quer que eu mande agora?';
  assert.equal(corrigirSaudacaoAbertura(semSaudacao, tarde), semSaudacao, 'mensagem sem saudação fica intacta');
  const noMeio = 'Luane, passei aqui pra desejar boa noite depois da visita. Confirmo amanhã?';
  assert.equal(corrigirSaudacaoAbertura(noMeio, tarde), noMeio, 'saudação no meio do texto não é abertura');
  assert.equal(corrigirSaudacaoAbertura('', tarde), '', 'texto vazio continua vazio');
}

// ── 4. A régua vale nos dois lugares: na tela e no pedido que vai pra IA ──────────────────────
{
  const app = fs.readFileSync(new URL('../app.js', import.meta.url), 'utf8');
  assert.match(app, /import \{ corrigirSaudacaoAbertura, saudacaoAgora \} from '\.\/js\/saudacao\.js/,
    'o app precisa usar a régua única');
  assert.match(app, /return corrigirSaudacaoAbertura\(texto\);/,
    'a correção precisa estar no funil por onde TODA sugestão passa (mensagensDaAnalise)');
  assert.ok(!/if\(h < 12\) saud = "Bom dia";/.test(app),
    'a régua não pode continuar duplicada na saudação da Home');

  const pipeline = fs.readFileSync(new URL('../api/_pipeline.js', import.meta.url), 'utf8');
  // v1291 — o dono reescreveu o pedido: a saudação continua indo pronta ("Saudação correspondente
  // ao horário neste instante: Boa tarde"), mas a régua escrita por extenso (bom dia até 11h59...)
  // saiu. Ir pronta é o que resolve o print das 17h37 — a IA não precisa calcular a faixa, ela
  // recebe a palavra certa já decidida pelo sistema.
  assert.match(pipeline, /Saudação correspondente ao horário neste instante/, 'o pedido à IA precisa levar a saudação pronta');
  assert.match(pipeline, /timeZone: fusoAnalise, hour: "2-digit", hour12: false/,
    'a hora da saudação precisa ser a do Brasil, não a do servidor');
  const cortes = pipeline.match(/horaAnalise < 12 \? "Bom dia" : horaAnalise < 18 \? "Boa tarde" : "Boa noite"/);
  assert.ok(cortes, 'os cortes do prompt precisam ser os mesmos de js/saudacao.js (12h e 18h)');

  const build = fs.readFileSync(new URL('../build.js', import.meta.url), 'utf8');
  assert.equal((build.match(/js\/saudacao\.js/g) || []).length, 2, 'o arquivo novo precisa ser publicado');
}

console.log('v1218-saudacao-certa-para-o-horario: ok');
