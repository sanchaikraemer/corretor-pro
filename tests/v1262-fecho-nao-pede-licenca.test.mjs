import fs from 'node:fs';
import assert from 'node:assert/strict';

// v1262 — QUARTA REANÁLISE DA LEAD MARINA, com a v1261 no ar (subiu 9 minutos antes).
//
// A v1261 funcionou nas duas coisas grandes: as três passaram a ABRIR pelo que o corretor faz
// ("já posso montar uma lista", "posso ir antecipando", "já consigo avaliar"), e a jogada mais
// forte — oferecer a avaliação do imóvel — subiu da nº 3 para a nº 1.
//
// Sobraram três defeitos, e o primeiro tinha causa dentro do próprio prompt:
//
//   a) "pode ser assim?" / "Pode ser dessa forma?" fechavam duas das três, e "Se preferir" abria a
//      oferta — exatamente os hedges que a v1261 tinha proibido. A proibição não pegou porque
//      BRIGAVA com uma regra mais antiga e mais forte: "termine curto ('o que acha?', 'consigo
//      separar?')". A IA obedecia o "termine curto" e "pode ser assim?" tem o formato certo — é
//      curto e é pergunta. Duas regras em lugares diferentes do prompt, uma anulando a outra.
//      Por isso a correção foi feita DENTRO da regra do fecho curto, não em outro canto.
//
//   b) "Fico no aguardo desse dado pra seguir" (na nº 1) — a construção-refém da v1260 voltou numa
//      forma que eu não tinha listado: em vez de condicionar ("assim que você tiver"), ela DECLARA
//      a espera. O efeito é o mesmo: o corretor para até o cliente agir.
//
//   c) A nº 3 fechou com uma escolha falsa: "Prefere me passar agora por mensagem ou pode me
//      enviar depois por aqui?" — as duas opções são o mesmo caminho em dois tempos, e o cliente
//      escolhe "depois", que quer dizer nunca.

const src = fs.readFileSync(new URL('../api/_pipeline.js', import.meta.url), 'utf8');

// ── 1. A correção mora DENTRO da regra que causava o problema ────────────────────────────────
const iniFechoCurto = src.indexOf('E fecho longo e explicativo é marca de IA');
const iniLicenca = src.indexOf('O FECHO CURTO NÃO PODE SER PEDIDO DE LICENÇA');
assert.ok(iniFechoCurto > -1, 'a regra do fecho curto precisa continuar existindo');
assert.ok(iniLicenca > iniFechoCurto && iniLicenca - iniFechoCurto < 400,
  'a proibição do pedido de licença precisa vir COLADA na regra do fecho curto — foi a separação entre as duas que fez a v1261 não pegar');

const licenca = src.slice(iniLicenca, iniLicenca + 1600).replace(/\s+/g, ' ');

// Os fechos que a reanálise real produziu.
for (const frase of ['pode ser assim?', 'pode ser dessa forma?', 'posso seguir?']) {
  assert.ok(licenca.includes(`"${frase}"`), `o fecho "${frase}" precisa estar proibido`);
}
// E as aberturas hedge que sobreviveram à v1261.
for (const frase of ['se quiser', 'se preferir', 'se te ajudar']) {
  assert.ok(licenca.includes(`"${frase}"`), `a abertura "${frase}" precisa estar proibida junto`);
}
assert.match(licenca, /Ninguém responde "não pode" a essas\s*perguntas/,
  'a regra precisa explicar por que o pedido de licença não decide nada');

// Não basta proibir: precisa dizer o que ENTRA no lugar, senão a IA fica sem fecho.
assert.match(licenca, /FECHOS QUE VALEM/, 'precisa listar os fechos que valem, não só os proibidos');
// v1287 — o exemplo era "prefere quinta ou sábado?", ou seja, a própria IA cravando os dias.
assert.match(licenca, /qual dia da semana costuma ser\s*melhor pra você\?/,
  'o fecho de dia passa a ser pergunta ao cliente, não dia cravado pela IA');
assert.match(licenca, /aqui por mensagem ou eu passo aí\?/, 'escolha entre duas coisas de verdade');
assert.match(licenca, /qual chega mais perto do que\s*vocês querem\?/, 'pergunta que puxa informação útil');
assert.match(licenca, /te mando ainda hoje\?/, 'confirmação de um passo já em andamento');

// ── 2. Escolha falsa: as duas opções têm que ser diferentes de verdade ───────────────────────
assert.match(licenca, /DUAS OPÇÕES de uma escolha precisam ser realmente diferentes/,
  'precisa existir a regra contra a escolha falsa');
assert.match(licenca, /agora por mensagem ou me enviar depois por aqui/,
  'a escolha falsa real da reanálise precisa estar citada como exemplo');
assert.match(licenca, /o cliente escolhe "depois", que quer dizer nunca/,
  'a regra precisa dizer o que acontece na prática');

// ── 3. A construção-refém que DECLARA a espera ───────────────────────────────────────────────
const iniRefem = src.indexOf('CONSTRUÇÃO PROIBIDA — "ASSIM QUE VOCÊ TIVER X, EU TE MANDO Y"');
assert.ok(iniRefem > -1, 'a regra da v1260 precisa continuar existindo');
const refem = src.slice(iniRefem, iniRefem + 1800).replace(/\s+/g, ' ');
for (const frase of [
  'fico no aguardo desse dado pra seguir',
  'aguardo seu retorno pra avançar',
  'fico esperando pra dar sequência',
]) {
  assert.ok(refem.includes(`"${frase}"`),
    `"${frase}" declara a espera e tem o mesmo efeito — precisa estar na mesma proibição`);
}
assert.match(refem, /as formas que declaram a espera/,
  'precisa ficar claro que declarar a espera é a mesma coisa que condicionar');

// ── 4. Onde cada regra mora, e nada de dado comercial ────────────────────────────────────────
// A do fecho é regra de LINGUAGEM: fica no prompt de sistema, junto das outras.
const fimSistema = src.indexOf('Responda somente com JSON válido no formato solicitado.');
assert.ok(iniLicenca < fimSistema,
  'a regra do fecho precisa estar no prompt de sistema, junto das outras regras de linguagem');
// A da espera é regra de CONDUÇÃO: fica no prompt que recebe o Cérebro (regra da v1247).
assert.ok(iniRefem > src.indexOf('Execute a análise usando o Cérebro Comercial'),
  'a regra da espera precisa estar no prompt que usa o Cérebro Comercial — nunca só no modo prévia');

for (const txt of [licenca, refem]) {
  assert.doesNotMatch(txt, /R\$|Personalité|Marina|430\.000|1\.450\.000/,
    'nenhuma regra pode carregar valor, empreendimento ou nome de cliente');
}

console.log('v1262-fecho-nao-pede-licenca: ok');
