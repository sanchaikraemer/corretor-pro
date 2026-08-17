// v1284 — OS PLANOS PRECISAM DAR LUCRO, E O CLIENTE NOVO NÃO PODE SER BARRADO NA CARGA INICIAL.
//
// Decisão do dono (17/08/2026), depois de medir o custo real no painel da OpenAI: o preço fica
// igual e o volume desce. Os limites antigos davam MARGEM NEGATIVA — uma análise custa de R$ 0,20
// a R$ 0,40 (79% da conta de IA é a entrada do modelo de análise), então 150 análises custavam até
// R$ 60 num plano de R$ 49,90.
//
// Este teste é a trava econômica: se alguém subir o volume de um plano sem subir o preço, ele
// falha de propósito, mostrando a conta.

import assert from "node:assert/strict";
import { planoComercial, precoPlano, pacoteExtra, bonusEntradaDisponivel } from "../api/_pipeline.js";

const CUSTO_MAXIMO_POR_ANALISE = 0.40; // medido no painel da OpenAI em 17/08/2026
const MARGEM_MINIMA = 0.45;            // no PIOR caso (pacote inteiro, conversas longas)

// ── 1. Cada plano precisa se pagar no pior caso ──────────────────────────────
for (const tipo of ["pro", "pro-master"]) {
  const plano = planoComercial(tipo);
  const preco = precoPlano(tipo);
  const custoNoLimite = plano.mes * CUSTO_MAXIMO_POR_ANALISE;
  const margem = (preco - custoNoLimite) / preco;
  assert.ok(margem >= MARGEM_MINIMA,
    `plano ${tipo}: R$ ${preco.toFixed(2)} com ${plano.mes} análises custa até R$ ${custoNoLimite.toFixed(2)} de IA — margem de ${(margem * 100).toFixed(0)}%, abaixo do mínimo de ${MARGEM_MINIMA * 100}%. Se o volume subiu, o preço precisa subir junto.`);
}

// Os números combinados com o dono, cravados aqui de propósito: mudar um deles é decisão
// comercial, não ajuste técnico — e tem que passar por este arquivo.
assert.equal(planoComercial("pro").mes, 50, "o plano Pro foi combinado em 50 análises/mês");
assert.equal(planoComercial("pro-master").mes, 120, "o Pro Master foi combinado em 120 análises/mês");
assert.equal(precoPlano("pro"), 49.9, "o preço do Pro segue R$ 49,90");
assert.equal(precoPlano("pro-master"), 99.9, "o preço do Pro Master segue R$ 99,90");

// ── 2. O teto diário deixou de ser régua comercial ───────────────────────────
// "independente de limite diário" (dono). O que sobrou é fusível técnico: alto o bastante pra o
// corretor nunca encostar, baixo o bastante pra um erro em laço não queimar o mês numa hora.
for (const tipo of ["pro", "pro-master"]) {
  const plano = planoComercial(tipo);
  assert.ok(plano.dia >= 40,
    `plano ${tipo}: o teto diário (${plano.dia}) voltou a ser pequeno o bastante pra atrapalhar quem quer pôr a carteira em dia num sábado`);
  assert.ok(plano.dia < plano.mes || tipo === "pro",
    `plano ${tipo}: o fusível diário não pode ser maior que o pacote do mês`);
}
// No Pro o fusível (40) é MENOR que o mês (50) de propósito: mesmo esvaziando o pacote de uma vez,
// sobra um resto pro dia seguinte em vez de acabar tudo numa tarde por engano.
assert.ok(planoComercial("pro").dia < planoComercial("pro").mes,
  "no Pro o fusível diário precisa ficar abaixo do pacote mensal");

// ── 3. Bônus de carga inicial ────────────────────────────────────────────────
const agora = Date.now();
const diasAtras = d => new Date(agora - d * 86400000).toISOString();

assert.equal(bonusEntradaDisponivel(diasAtras(0)), 200, "conta criada hoje precisa do bônus de carga inicial");
assert.equal(bonusEntradaDisponivel(diasAtras(30)), 200, "aos 30 dias a conta ainda está na janela do bônus");
assert.equal(bonusEntradaDisponivel(diasAtras(44)), 200, "aos 44 dias ainda vale");
assert.equal(bonusEntradaDisponivel(diasAtras(46)), 0, "passados 45 dias o bônus acaba");
assert.equal(bonusEntradaDisponivel(diasAtras(400)), 0, "conta antiga não tem bônus");
assert.equal(bonusEntradaDisponivel(null), 0, "sem data de criação, não há bônus");
assert.equal(bonusEntradaDisponivel("data inválida"), 0, "data ilegível não pode virar bônus");

// O bônus precisa cobrir a primeira importação de uma carteira de verdade.
const carteiraTipica = 150;
assert.ok(200 + planoComercial("pro").mes >= carteiraTipica,
  `o bônus (200) + o pacote do Pro (${planoComercial("pro").mes}) precisa cobrir a primeira importação de uma carteira de ${carteiraTipica} conversas — é o momento em que o cliente novo decide se fica`);

// ── 4. Pacote extra: quem estoura o mês compra mais, não bate numa parede ────
const pac = pacoteExtra();
assert.ok(pac.analises > 0 && pac.preco > 0, "o pacote extra precisa existir");
const margemPacote = (pac.preco - pac.analises * CUSTO_MAXIMO_POR_ANALISE) / pac.preco;
assert.ok(margemPacote >= MARGEM_MINIMA,
  `o pacote extra (${pac.analises} por R$ ${pac.preco}) custa até R$ ${(pac.analises * CUSTO_MAXIMO_POR_ANALISE).toFixed(2)} — margem de ${(margemPacote * 100).toFixed(0)}%`);
assert.ok(pac.preco / pac.analises >= precoPlano("pro") / planoComercial("pro").mes,
  "a análise avulsa não pode sair mais barata que a análise de dentro do plano — senão ninguém assina");

console.log(`v1284-planos-novos-margem-e-bonus: ok (Pro 50/R$49,90 · Pro Master 120/R$99,90 · fusível ${planoComercial("pro").dia}/dia · bônus 200 por 45 dias · extra ${pac.analises} por R$ ${pac.preco})`);
