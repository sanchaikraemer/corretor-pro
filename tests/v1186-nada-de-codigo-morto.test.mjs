import fs from 'node:fs';
import assert from 'node:assert/strict';
import { parse } from 'acorn';

// v1186 — GUARDA CONTRA CÓDIGO MORTO.
//
// A auditoria de 09/08/2026 varreu o projeto com analisador de sintaxe e achou 51 funções
// declaradas que NINGUÉM chamava — nem no próprio arquivo, nem no HTML, nem nos módulos. Não era
// só peso morto: três telas tinham deixado de aparecer sem ninguém notar, e os testes que as
// guardavam continuavam verdes porque conferiam o TEXTO do arquivo, não a tela. O caso mais caro:
// o botão "Juntar cliente duplicado" (v1148) foi escrito dentro de um painel que a v908 tinha
// parado de desenhar — o recurso que o dono pediu nunca apareceu no app.
//
// Este teste é o alarme pra isso não voltar. Ele NÃO julga estilo: só cobra que toda função
// declarada no topo dos arquivos principais seja chamada de algum lugar.
//
// COMO LER UMA FALHA AQUI: se uma função sua aparecer na lista, uma de duas coisas é verdade —
// (a) você esqueceu de ligar a função na tela/rota (o bug que este teste existe pra pegar), ou
// (b) ela é mesmo desnecessária e deve ser apagada. Não existe terceira opção "deixa quieto":
// função que ninguém chama é feature que ninguém usa.

const raiz = new URL('../', import.meta.url);
const ler = (arq) => fs.readFileSync(new URL(arq, raiz), 'utf8');

// Onde uma função pode ser "usada": outros arquivos do app, o HTML (onclick=) e os testes.
const acompanhantes = ['index.html','share.html','admin-plataforma.html','cadastro.html','entrar.html',
  'js/proposta.js','js/pwa-install.js','js/dados-locais.js','js/state.js','js/dom.js','js/tema.js',
  'js/commercial-schema.js','service-worker.js','build.js']
  .map(f => { try { return ler(f); } catch { return ''; } }).join('\n');

const arquivosApi = fs.readdirSync(new URL('api/', raiz)).filter(f => f.endsWith('.js'));
const todaApi = arquivosApi.map(f => ler('api/' + f)).join('\n');

function declaracoesDeTopo(src) {
  const ast = parse(src, { ecmaVersion: 'latest', sourceType: 'module' });
  const nomes = [];
  for (const no of ast.body) {
    const decl = no.type === 'ExportNamedDeclaration' ? no.declaration : no;
    if (decl?.type === 'FunctionDeclaration' && decl.id) nomes.push(decl.id.name);
    if (decl?.type === 'VariableDeclaration') {
      for (const d of decl.declarations) {
        if (d.id?.type === 'Identifier' && d.init && /Function|Arrow/.test(d.init.type)) nomes.push(d.id.name);
      }
    }
  }
  return nomes;
}

// Conta ocorrências no TEXTO (não só no AST): as telas montam HTML com onclick="minhaFuncao(...)"
// dentro de string, e isso é uso de verdade — foi justamente o que a primeira varredura da
// auditoria não enxergou, gerando 225 falsos positivos antes de ser corrigida.
const vezes = (texto, nome) => (texto.match(new RegExp('\\b' + nome.replace(/\$/g, '\\$') + '\\b', 'g')) || []).length;

const mortas = [];

// ── app.js ────────────────────────────────────────────────────────────────────────────────────
{
  const src = ler('app.js');
  for (const nome of declaracoesDeTopo(src)) {
    const dentro = vezes(src, nome);
    const temPonte = new RegExp('window\\.' + nome + '\\s*=').test(src);
    const foraDoApp = new RegExp('\\b' + nome + '\\b').test(acompanhantes);
    // 1 = só a declaração. Com ponte window, 2 = declaração + ponte, e ninguém usa de fato.
    if (!foraDoApp && dentro <= (temPonte ? 2 : 1)) mortas.push(`app.js: ${nome}`);
  }
}

// ── api/ ──────────────────────────────────────────────────────────────────────────────────────
// Funções exportadas são consumidas por outras rotas e pelos testes; a busca é no conjunto todo.
for (const arq of arquivosApi) {
  const src = ler('api/' + arq);
  const exportadas = new Set([...src.matchAll(/export\s+(?:async\s+)?function\s+([A-Za-z0-9_]+)/g)].map(m => m[1])
    .concat([...src.matchAll(/export\s*\{([^}]*)\}/g)].flatMap(m => m[1].split(',').map(s => s.trim().split(/\s+as\s+/)[0]))));
  for (const nome of declaracoesDeTopo(src)) {
    if (exportadas.has(nome)) continue;         // export é uso: quem consome está fora do arquivo
    if (vezes(src, nome) <= 1) mortas.push(`api/${arq}: ${nome}`);
  }
}

assert.deepEqual(mortas, [],
  'Estas funções não são chamadas de lugar nenhum. Ou falta ligar na tela/rota (foi assim que o ' +
  '"Juntar cliente duplicado" ficou invisível por um mês), ou devem ser apagadas:\n  - ' +
  mortas.join('\n  - '));

// ── v1187: o que cuida de cadastro repetido precisa continuar ligado ─────────────────────────
//
// A v1186 encontrou código órfão e concluiu, errado, que dois recursos tinham se perdido —
// devolveu um painel com "Juntar cliente duplicado" e "Excluir definitivamente" na tela do
// cliente. O dono derrubou: um botão de juntar dentro de UM cadastro cobra dele saber que existe
// um repetido e qual é, que é justamente o que o app tem que dizer; e excluir já existe em Editar.
//
// E o app JÁ resolve cadastro repetido, em três camadas — é isso que precisa continuar de pé.
{
  const app = ler('app.js');
  const persistencia = ler('api/_persistence.js');

  // 1) o servidor reconhece o mesmo cliente na importação (telefone, arquivo, nome)
  assert.match(persistencia, /export async function _buscarProcessamentoExistenteV681/,
    'o servidor precisa continuar reconhecendo o cliente que já existe na importação');
  // 2) nome só parecido: a importação PERGUNTA, com os dois nomes na tela
  assert.match(app, /async function acharLeadExistente/,
    'a importação precisa continuar procurando o cadastro que já existe');
  assert.match(app, /Pode ser o mesmo cliente que já existe/,
    'a pergunta "é o mesmo cliente?" da importação precisa continuar — é ela que mostra os dois nomes');
  assert.match(app, /É o mesmo cliente\?/, 'a pergunta precisa continuar sendo sim/não pro corretor');
  // 3) a lista agrupa cópias num card só
  assert.match(persistencia, /clean\.dupeIds = dupeIds/, 'a lista precisa continuar agrupando cópias num card só');
  assert.match(app, /function coletarDupeIds/, 'apagar precisa continuar levando todas as cópias junto');

  // E excluir continua onde sempre esteve: Editar lead → Zona perigosa.
  assert.match(app, /id="editLeadExcluir"/, 'excluir o lead precisa continuar no modal de editar');
  assert.match(app, /Zona perigosa/, 'a zona perigosa do modal de editar precisa continuar');

  // O painel órfão não pode voltar.
  const appSemComentario = app.split('\n').filter(l => !/^\s*\/\//.test(l)).join('\n');
  assert.doesNotMatch(appSemComentario, /cp704QuickActions|cp1186MaisOpcoes/,
    'o painel de ações do lead foi removido de vez (v1187) — o que ele oferecia já existe em outro lugar');
}

// ── E nenhuma rota do servidor pode ficar com ação que ninguém chama ─────────────────────────
{
  const frontes = ['app.js','js/proposta.js','js/pwa-install.js','index.html','share.html','admin-plataforma.html']
    .map(f => { try { return ler(f); } catch { return ''; } }).join('\n');
  const acoesDoServidor = new Set();
  for (const arq of arquivosApi) {
    const src = ler('api/' + arq);
    for (const m of src.matchAll(/case\s+["']([a-z0-9-]+)["']:/g)) acoesDoServidor.add(m[1]);
    for (const m of src.matchAll(/action\s*===\s*["']([a-z0-9-]+)["']/g)) acoesDoServidor.add(m[1]);
  }
  const orfas = [...acoesDoServidor].filter(a => !frontes.includes(`"${a}"`) && !frontes.includes(`'${a}'`) && !frontes.includes(`=${a}&`) && !frontes.includes(`action=${a}`));
  assert.deepEqual(orfas, [],
    `O servidor atende ações que nenhuma tela pede: ${orfas.join(', ')}. Ou falta ligar na tela, ou a ação deve sair.`);
}

console.log('v1186-nada-de-codigo-morto: ok');
