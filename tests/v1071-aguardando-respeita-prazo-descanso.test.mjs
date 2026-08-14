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
//
// v1266 — a OUTRA metade da condição (cpAguardandoResposta: "o cliente ainda não respondeu depois
// do meu atendimento") foi REMOVIDA por ordem do dono: "não interessa quem está esperando quem, já
// te disse q não tem como saber sem estar integrado com whats". O prazo de descanso — que é o que
// este teste protege — continua valendo exatamente igual.

const app = fs.readFileSync(new URL('../app.js', import.meta.url), 'utf8');

const catSrc = app.match(/function cp786Categoria\(l,modelo=null,ultimaReal=null\)\{[\s\S]*?\n\}/)[0];
assert.match(catSrc, /if\(emJanelaDeEspera\(l\)\) return 'aguardando'/,
  'cp786Categoria precisa exigir emJanelaDeEspera(l) pra classificar como aguardando');
assert.doesNotMatch(catSrc, /cpAguardandoResposta/,
  'v1266: "quem está esperando quem" não pode voltar pra categoria');
assert.doesNotMatch(app, /function cpAguardandoResposta|function ultimaMsgClienteTs/,
  'v1266: as funções que comparavam a fala do cliente com o atendimento foram removidas de vez');

// Teste funcional isolado, com stubs simples pros helpers que não são o foco aqui.
// (v1189 — os stubs de "cliente respondeu" que a v1188 tinha posto aqui saíram junto com a
// categoria: ver tests/v1189-cliente-respondeu-nao-existe.test.mjs.)
function rodarCategoria({ compromisso, dentroDaJanela, msgsCliente, retomada }) {
  const cp786TemCompromisso = () => !!compromisso;
  const emJanelaDeEspera = () => !!dentroDaJanela;
  const mensagensDoCliente = () => Number(msgsCliente || 0);
  const CP_MIN_MSGS_PRIORIDADE = 3;
  const entraEmRetomada = () => !!retomada;
  const leadEhAtivo = () => true;
  const fn = new Function(
    'cp786TemCompromisso', 'emJanelaDeEspera', 'mensagensDoCliente',
    'CP_MIN_MSGS_PRIORIDADE', 'entraEmRetomada', 'leadEhAtivo',
    `${catSrc}\nreturn cp786Categoria;`
  );
  return fn(cp786TemCompromisso, emJanelaDeEspera, mensagensDoCliente,
    CP_MIN_MSGS_PRIORIDADE, entraEmRetomada, leadEhAtivo)({});
}

// Atendido e AINDA dentro do prazo → aguardando (comportamento de sempre).
assert.equal(
  rodarCategoria({ dentroDaJanela: true, msgsCliente: 5, retomada: true }),
  'aguardando',
  'dentro do prazo de descanso, continua "aguardando" normalmente'
);

// Atendido, mas JÁ PASSOU do prazo → não pode mais ser "aguardando" — precisa cair no fluxo
// normal (aqui, vale retomada → "agora").
assert.equal(
  rodarCategoria({ dentroDaJanela: false, msgsCliente: 5, retomada: true }),
  'agora',
  'passado o prazo de descanso, o lead "vence" e sai de aguardando — este é exatamente o bug relatado'
);

// Compromisso marcado sempre vence, independente do prazo de espera.
assert.equal(
  rodarCategoria({ compromisso: true, dentroDaJanela: true }),
  'programados',
  'compromisso marcado tem prioridade sobre aguardando'
);

console.log('v1071-aguardando-respeita-prazo-descanso: ok');
