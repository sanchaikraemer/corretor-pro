import fs from "node:fs";
import assert from "node:assert/strict";

// v1184 — o piso comercial fixo (INTELIGENCIA_CARTEIRA, que entra em TODA análise de TODA conta,
// com ou sem Cérebro configurado) tinha sido escrito pensando só em venda de lançamento: mandava
// "oferecer café na construtora", falava do cliente que "não viu o decorado" e tratava permuta
// como algo que "a construtora aceita".
//
// O dono trouxe o Cérebro de uma IMOBILIÁRIA que trabalha carteira de imóveis de terceiros
// (revenda, proprietário decide, chave com inquilino). O Cérebro do corretor prevalece sobre o
// piso, então nada quebrava — mas o piso ficava puxando toda análise pro mundo errado: decorado
// não existe em revenda, e café na construtora também não.
//
// Este teste trava as duas pontas: o piso não pode mais PRESCREVER estrutura de construtora, e
// precisa cobrir o caso do imóvel de terceiro (disponibilidade, quem aprova a proposta, chave da
// visita). Lançamento continua atendido — só deixou de ser o único mundo possível.

const pipeline = fs.readFileSync(new URL("../api/_pipeline.js", import.meta.url), "utf8");
const app = fs.readFileSync(new URL("../app.js", import.meta.url), "utf8");

// ---------------------------------------------------------------------------
// 1) Nada de estrutura de construtora cravada no texto fixo.
// ---------------------------------------------------------------------------
assert.doesNotMatch(pipeline, /café na construtora/i, "o piso não pode mais prescrever 'café na construtora'");
assert.doesNotMatch(pipeline, /sem ver o decorado/i, "o piso não pode mais partir do princípio de que existe decorado");
assert.doesNotMatch(pipeline, /\(a construtora aceita\?/i, "permuta não pode assumir que quem decide é a construtora");

// ---------------------------------------------------------------------------
// 2) O caso do imóvel de terceiro / carteira compartilhada precisa existir no piso.
// ---------------------------------------------------------------------------
assert.match(pipeline, /IMÓVEL DE TERCEIRO \/ CARTEIRA COMPARTILHADA/, "o piso precisa cobrir carteira de imóveis de proprietários");
assert.match(pipeline, /quem aprova é o proprietário/i, "o corretor apresenta a proposta; quem aprova é o proprietário");
assert.match(pipeline, /Visita só está agendada depois de confirmada com quem tem a chave/i, "visita só vale depois de confirmada com quem tem a chave");
assert.match(pipeline, /condomínio, IPTU/i, "despesas mensais entram na lista do que não pode ser afirmado sem confirmação");

// ---------------------------------------------------------------------------
// 3) Lançamento NÃO pode ter sido apagado — só deixou de ser o padrão obrigatório.
// ---------------------------------------------------------------------------
assert.match(pipeline, /quando a organização trabalhar com lançamento/i, "decorado/estande continuam previstos para quem vende lançamento");
assert.match(pipeline, /planta\/lançamento quando a organização trabalhar com isso/i, "a alternativa de planta continua prevista, agora condicionada");
assert.match(pipeline, /retome com leveza/, "o ponto de quem ainda não conheceu o imóvel continua existindo (ver v1059)");

// ---------------------------------------------------------------------------
// 4) A próxima ação sugerida não pode depender de estrutura que o Cérebro não confirmou.
// ---------------------------------------------------------------------------
assert.match(
  pipeline,
  /NUNCA proponha uma ação que dependa de estrutura que o Cérebro não confirmou que existe/,
  "a próxima ação precisa respeitar a estrutura real da organização"
);

// ---------------------------------------------------------------------------
// 5) Os textos prontos de material também não podem presumir lançamento (o corretor de
//    revenda não tem decorado pra convidar).
//
// v1194 — a tabela MATERIAL_TEMPLATE inteira saiu do app.js: era código morto (nenhuma tela
// desenhava aquelas frases — só a declaração existia, sem nenhum uso; o mesmo padrão de
// "teste guardando fantasma" descrito nas NOTAS-v1186). O assert positivo que cobrava o
// convite de visita "neutro" cobrava texto que nunca chegava à tela. Os asserts negativos
// continuam: se alguém recriar textos prontos de material, eles não podem nascer presumindo
// lançamento.
// ---------------------------------------------------------------------------
assert.doesNotMatch(app, /visita ao decorado\? Tenho horários/i, "o convite de visita não pode presumir decorado");
assert.doesNotMatch(app, /planta do apartamento, fica mais fácil/i, "a planta é do imóvel, não necessariamente de apartamento");
assert.doesNotMatch(app, /vídeo curto do empreendimento/i, "o vídeo é do imóvel, não necessariamente de um empreendimento");
assert.doesNotMatch(app, /lazer e wellness do empreendimento/i, "área de lazer não pode presumir empreendimento em lançamento");
