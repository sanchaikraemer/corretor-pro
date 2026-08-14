import fs from 'node:fs';
import assert from 'node:assert/strict';

const app = fs.readFileSync(new URL('../app.js', import.meta.url), 'utf8');
const css = fs.readFileSync(new URL('../styles.css', import.meta.url), 'utf8');

// v1276 — "quero ver o histórico do mes todo e nao da semana nessa parte... todos q atendi a cada
// dia desde dia 1" (dono, 14/08/2026, com print da tela Atendimentos).
//
// A tela mostrava só os ÚLTIMOS 7 DIAS. O resto do mês estava registrado no banco e não tinha
// onde ser visto: no dia 14, ele enxergava do dia 8 pra cá e mais nada.

const ini = app.indexOf('function cp788RenderAtendimentos(');
assert.ok(ini > -1, 'não localizei o desenho da tela Atendimentos');
const rend = app.slice(ini, ini + 4200);

// ── 1. O período é o mês corrente, do dia 1 até hoje ─────────────────────────────────────────
assert.match(rend, /const diasDoMesAteHoje=Math\.max\(1, hoje0\.getDate\(\)\)/,
  'o número de dias desenhados é o dia do mês de hoje — dia 14 desenha 14 dias');
assert.match(rend, /for\(let i=0;i<diasDoMesAteHoje;i\+\+\)/, 'a tela percorre o mês inteiro');
assert.match(rend, /if\(d!=null && d>=0 && d<diasDoMesAteHoje\) perDay\[d\]\.itens\.push\(x\)/,
  'os atendimentos são distribuídos no mês inteiro, não só nos 7 dias');
assert.ok(!/Últimos 7 dias/.test(app), 'o texto "Últimos 7 dias" não pode sobrar em lugar nenhum');
assert.match(rend, /do dia 1 até hoje/, 'o cabeçalho precisa dizer qual é o período mostrado');
assert.match(rend, /\$\{totalMes\} atendimento/, 'o total do cabeçalho passa a ser o do mês');

// ── 2. Fim de semana segue a régua da v1273 ─────────────────────────────────────────────────
// Sábado/domingo VAZIO sai da lista (senão o mês vira um serrote e parece queda de produção);
// fim de semana em que ele TRABALHOU continua aparecendo — apagá-lo esconderia trabalho feito.
assert.match(rend, /const diasVisiveis=perDay\.filter\(p=>p\.itens\.length>0\|\|!p\.fds\)/,
  'fim de semana vazio sai; fim de semana trabalhado fica');
assert.match(rend, /fds:\(d\.getDay\(\)===0\|\|d\.getDay\(\)===6\)/, 'sábado e domingo são marcados na montagem do dia');
assert.match(rend, /\$\{diasVisiveis\.map\(/, 'a lista desenhada é a filtrada, não a bruta');

// ── 3. O layout aguenta 31 dias ─────────────────────────────────────────────────────────────
// A grade de 7 colunas do computador viraria 5 fileiras de colunas estreitas com o mês inteiro.
// A faixa por dia (que o celular já usava) virou o formato único.
assert.match(css, /\.cp788-days\{display:flex;flex-direction:column/, 'um dia embaixo do outro, sempre');
assert.ok(!/grid-template-columns:repeat\(7,minmax\(0,1fr\)\)/.test(css),
  'a grade fixa de 7 colunas não pode voltar — o mês tem até 31 dias');
assert.ok(!/@media\(max-width:720px\)\{\s*\.cp788-days/.test(css),
  'não existe mais um layout de colunas pra desfazer no celular');

// ── 4. O que a tela já fazia continua igual ─────────────────────────────────────────────────
assert.match(rend, /cp788PredioSVG\(n, CP788_META_DIA\)/, 'cada dia continua com o prédio da meta');
assert.match(rend, /class="cp788-day-name"/, 'os clientes do dia continuam clicáveis pelo nome');
assert.match(rend, /i===0\?'Hoje':i===1\?'Ontem'/, 'Hoje e Ontem continuam nomeados');

console.log('v1276-atendimentos-mes-inteiro: ok');
