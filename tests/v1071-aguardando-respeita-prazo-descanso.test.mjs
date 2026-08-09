import fs from 'node:fs';
import assert from 'node:assert/strict';

// v1071 — o dono notou (pelo número "104 aguardando" de 222 leads ativos) que "Aguardando
// cliente" não tinha coerência: um lead atendido há 2 dias e um atendido há 60 dias, os dois sem
// resposta, contavam igual — pra sempre, sem prazo. Isso contradizia a regra nova do "Fazer
// agora" (v1069): depois que passa o prazo de descanso configurado, o MESMO lead também
// reaparece em "Fazer agora" — as duas telas diziam coisas opostas sobre o mesmo cliente.
//
// Correção: cp786Categoria só classifica como "aguardando" enquanto ainda está DENTRO do prazo
// de descanso (emJanelaDeEspera). Depois que vence, cai no fluxo normal (agora/sem-acao).

const app = fs.readFileSync(new URL('../app.js', import.meta.url), 'utf8');

const catSrc = app.match(/function cp786Categoria\(l,modelo=null,ultimaReal=null\)\{[\s\S]*?\n\}/)[0];
assert.match(catSrc, /if\(cpAguardandoResposta\(l\) && emJanelaDeEspera\(l\)\) return 'aguardando'/,
  'cp786Categoria precisa exigir emJanelaDeEspera(l) além de cpAguardandoResposta(l) pra classificar como aguardando');

// Teste funcional isolado, com stubs simples pros helpers que não são o foco aqui.
// v1188 — a categoria 'respondeu' passou a ser produzida (cp786ClienteRespondeu + guarda de
// "pede resposta"); os dois entram como stubs injetáveis pra cobrir a árvore nova também.
function rodarCategoria({ compromisso, aguardandoResposta, dentroDaJanela, msgsCliente, retomada, clienteRespondeu, pedeResposta = true }) {
  const cp786TemCompromisso = () => !!compromisso;
  const cpAguardandoResposta = () => !!aguardandoResposta;
  const emJanelaDeEspera = () => !!dentroDaJanela;
  const mensagensDoCliente = () => Number(msgsCliente || 0);
  const CP_MIN_MSGS_PRIORIDADE = 3;
  const entraEmRetomada = () => !!retomada;
  const leadEhAtivo = () => true;
  const cp786ClienteRespondeu = () => !!clienteRespondeu;
  const ultimaMsgClientePedeResposta = () => !!pedeResposta;
  const fn = new Function(
    'cp786TemCompromisso', 'cpAguardandoResposta', 'emJanelaDeEspera', 'mensagensDoCliente',
    'CP_MIN_MSGS_PRIORIDADE', 'entraEmRetomada', 'leadEhAtivo', 'cp786ClienteRespondeu', 'ultimaMsgClientePedeResposta',
    `${catSrc}\nreturn cp786Categoria;`
  );
  return fn(cp786TemCompromisso, cpAguardandoResposta, emJanelaDeEspera, mensagensDoCliente,
    CP_MIN_MSGS_PRIORIDADE, entraEmRetomada, leadEhAtivo, cp786ClienteRespondeu, ultimaMsgClientePedeResposta)({});
}

// Atendido, cliente não respondeu, AINDA dentro do prazo → aguardando (comportamento de sempre).
assert.equal(
  rodarCategoria({ aguardandoResposta: true, dentroDaJanela: true, msgsCliente: 5, retomada: true }),
  'aguardando',
  'dentro do prazo de descanso, continua "aguardando" normalmente'
);

// Atendido, cliente não respondeu, mas JÁ PASSOU do prazo → não pode mais ser "aguardando" —
// precisa cair no fluxo normal (aqui, vale retomada → "agora").
assert.equal(
  rodarCategoria({ aguardandoResposta: true, dentroDaJanela: false, msgsCliente: 5, retomada: true }),
  'agora',
  'passado o prazo de descanso, o lead "vence" e sai de aguardando — este é exatamente o bug relatado'
);

// Compromisso marcado sempre vence, independente do prazo de espera.
assert.equal(
  rodarCategoria({ compromisso: true, aguardandoResposta: true, dentroDaJanela: true }),
  'programados',
  'compromisso marcado tem prioridade sobre aguardando'
);

console.log('v1071-aguardando-respeita-prazo-descanso: ok');
