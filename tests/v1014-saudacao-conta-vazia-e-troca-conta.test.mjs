import fs from 'node:fs';
import assert from 'node:assert/strict';

// v1014 — dois achados reais depois de publicar a v1013, testados ao vivo pelo dono numa conta
// de teste nova (sem nenhum lead importado):
//
// 1) A conta de teste ("Teste1") apareceu, num primeiro carregamento, mostrando os 227 leads da
// conta principal ("Empresa 1") — nome certo na saudação, dados errados na lista. Depois de
// fechar o navegador por completo e entrar de novo, sumiu — indicando que o navegador tinha
// restaurado uma página "congelada" da memória (bfcache, ex.: botão voltar/avançar ou trocar de
// aba) com estado de outra conta, sem recarregar o script. Corrigido: force um recarregamento
// completo sempre que a página for restaurada do bfcache (evento pageshow com persisted=true) —
// garante que a tela nunca mistura dado de duas contas no mesmo aparelho.
//
// 2) Com o bfcache corrigido, a conta de teste passou a aparecer corretamente VAZIA (sem leads) —
// mas a saudação ficou presa em "Bom dia, corretor!" genérico, mesmo com a conta certa (Teste1)
// identificada em todo o resto da tela (barra lateral). Causa: renderSaudacao(items) só atualizava
// #homePageTitle DENTRO do bloco que exige items.length > 0 — uma conta nova, ainda sem nenhum
// lead importado (todo trial começa exatamente assim), nunca tinha o nome de verdade aplicado.
// Corrigido: o nome agora é aplicado ANTES da checagem de items vazios.
//
// 3) 🔴 O achado mais sério: voltando pra CONTA REAL (administrador da plataforma), a saudação e a
// barra lateral mostraram "Teste1" — só a ETIQUETA errada, os 227 leads mostrados continuaram
// sendo os reais (a API de leads sempre filtrou certo, nunca houve vazamento de dado de fato).
// Causa: cpCarregarContaLogada() buscava o nome da conta com
// `.from("memberships").select("organizations(nome)").order("criado_em",{ascending:false}).limit(1)`
// SEM `.eq("user_id", ...)` — contando só com a RLS pra restringir ao próprio vínculo. Isso
// funciona pra um corretor comum, mas quem também é administrador da plataforma tem uma política
// de RLS extra (membership_select_admin, migração 0003) que libera ver TODOS os vínculos do
// sistema — sem o filtro explícito, a consulta pegava o vínculo mais recente CRIADO POR QUALQUER
// CONTA (a de teste, criada um dia depois), não o do próprio administrador. Corrigido: filtro
// `.eq("user_id", data.session.user.id)` adicionado — mesmo padrão já usado em entrar.html e em
// resolveOrganizationId (api/_persistence.js), que nunca tiveram esse problema.

const app = fs.readFileSync(new URL('../app.js', import.meta.url), 'utf8');

// 1. Guarda de bfcache: existe um listener de pageshow que recarrega quando persisted=true.
assert.match(app, /addEventListener\(["']pageshow["'],\s*\(ev\)\s*=>\s*\{\s*if\s*\(ev\.persisted\)\s*location\.reload\(\);\s*\}\)/,
  'precisa existir um listener de pageshow que recarrega a página quando restaurada do bfcache (ev.persisted)');

// 2. renderSaudacao aplica o título (nome do corretor/conta) ANTES do "return" por items vazios —
// não só dentro do bloco que precisa de items.length.
const iniSaud = app.indexOf('function renderSaudacao(items){');
const fimSaud = app.indexOf('\nfunction ', iniSaud + 1);
const saud = app.slice(iniSaud, fimSaud);
assert.ok(iniSaud > -1 && fimSaud > iniSaud, 'achei a função renderSaudacao inteira');

const idxTitle = saud.indexOf('if(title) title.textContent = head;');
const idxEmptyReturn = saud.indexOf('if(!items?.length){ setAll("none", ""); return; }');
assert.ok(idxTitle > -1, 'renderSaudacao precisa aplicar o título (nome do corretor/conta)');
assert.ok(idxEmptyReturn > -1, 'renderSaudacao precisa continuar tratando items vazio (esconde o resumo do dia)');
assert.ok(idxTitle < idxEmptyReturn,
  'o título tem que ser aplicado ANTES do return por items vazio — conta nova (0 leads) precisa mostrar o nome certo, não só "corretor" genérico');

// 3. O texto que popula o título usa a mesma prioridade de sempre: Cérebro > nome da conta > genérico.
// v1183 — a prioridade é a mesma; o que mudou é DE ONDE sai o nome do Cérebro. Era
// state.cerebroCfg, campo que nunca é preenchido em lugar nenhum do app, então a primeira opção
// nunca valia e o corretor era cumprimentado pelo nome da empresa mesmo com "Seu nome" salvo.
assert.match(saud, /const corretorNome = \(cpNomeCorretorCerebro\(\) \|\| window\.__cpContaNome \|\| ""\)\.trim\(\)\.split\(\/\\s\+\/\)\[0\] \|\| "";/,
  'a prioridade do nome (Cérebro > conta logada > genérico) não pode mudar');

// 4. 🔴 cpCarregarContaLogada precisa filtrar pelo PRÓPRIO user_id ao buscar o nome da conta —
// sem isso, um administrador da plataforma (RLS libera ver todos os vínculos) via o nome de
// QUALQUER conta do sistema, não a própria.
const iniConta = app.indexOf('function cpCarregarContaLogada(){');
const fimConta = app.indexOf('})();', iniConta);
const conta = app.slice(iniConta, fimConta);
assert.ok(iniConta > -1 && fimConta > iniConta, 'achei a IIFE cpCarregarContaLogada inteira');
assert.match(conta, /\.from\("memberships"\)\.select\("organizations\(nome\)"\)\.eq\("user_id", data\.session\.user\.id\)/,
  'a busca do nome da conta logada precisa filtrar explicitamente pelo próprio user_id, não confiar só na RLS');

console.log('v1014-saudacao-conta-vazia-e-troca-conta: ok');
