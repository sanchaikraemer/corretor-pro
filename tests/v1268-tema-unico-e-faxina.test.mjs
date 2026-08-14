import fs from 'node:fs';
import assert from 'node:assert/strict';

// v1268 — ordem do dono (13/08/2026, madrugada): "pode deletar o tema claro do sistema, bem como
// todas linhas de código e arquivos. também quero q faça uma faxina e limpe códigos e linhas ou
// arquivos desnecessário e corrija os corrompidos, revise geral".
//
// Este teste é a trava das duas coisas: o tema claro não volta por nenhuma porta, e o código morto
// que foi retirado nesta faxina não volta a se acumular sem alguém perceber.

const raiz = new URL('../', import.meta.url);
const ler = (f) => fs.readFileSync(new URL(f, raiz), 'utf8');
const app = ler('app.js');
const styles = ler('styles.css');
const index = ler('index.html');
const sw = ler('service-worker.js');
const build = ler('build.js');
// O histórico do porquê fica escrito nos comentários de propósito — a varredura olha o código.
const semComentariosJs = (t) => t.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
const semComentariosCss = (t) => t.replace(/\/\*[\s\S]*?\*\//g, '');

// ── 1. O tema claro não existe mais em lugar nenhum ───────────────────────────────────────────
assert.doesNotMatch(semComentariosCss(styles), /data-theme="?light/, 'nenhuma regra de tema claro no CSS');
assert.doesNotMatch(styles, /prefers-color-scheme/, 'nem por preferência do sistema operacional');
assert.doesNotMatch(semComentariosCss(styles), /\.theme-(option|preview|settings|current|check|options)/,
  'o cartão "Aparência" (seletor de tema) não pode voltar ao CSS');
assert.doesNotMatch(index, /data-theme-choice|direciona_tema|themeCurrentLabel|themeColorMeta/,
  'nem o seletor, nem a preferência salva, nem o meta que era reescrito por tema');
assert.doesNotMatch(semComentariosJs(app + sw + build), /tema\.js/, 'js/tema.js foi apagado — ninguém pode importá-lo');
assert.ok(!fs.existsSync(new URL('js/tema.js', raiz)), 'o arquivo js/tema.js não pode voltar');

// O tema escuro é fixo no <html>: não depende de script, não pisca, não tem o que escolher.
assert.match(index, /<html lang="pt-BR" data-theme="dark" style="color-scheme:dark"/, 'o tema escuro é fixo no <html>');
assert.match(index, /<meta name="theme-color" content="#052B36">/, 'a cor da barra do navegador é a oficial, fixa');
assert.doesNotMatch(index, /--boot-bg|__bootPalette/, 'as variáveis de boot só serviam pra trocar de paleta — saíram junto');
assert.match(index, /html,body\{[^}]*background:#052B36/, 'o boot pinta o petróleo oficial direto');

// ── 2. O código morto retirado na faxina não volta ────────────────────────────────────────────
const codigo = semComentariosJs(app);
assert.doesNotMatch(codigo, /ui684/, 'o bloco "IA COMERCIAL 2.0" (3 funções que ninguém chamava) não volta');
assert.doesNotMatch(codigo, /renderLeadsParecidos/, 'a seção "clientes parecidos" era inalcançável desde que foi ocultada');
assert.doesNotMatch(codigo, /function scoreLead\b/, 'scoreLead era só um apelido sem uso de scorePrioridadeAtendimento');
assert.doesNotMatch(codigo, /navBadgeHoje|navBadgeAgenda|#kpiAtivos|#pillTotalLeads"/,
  'comandos que pintavam elementos que já não existem na tela');
assert.doesNotMatch(codigo, /#agendaRefresh|#dashboardRefresh|#arquivadosRefresh|#carteiraRefresh/,
  'botões de "atualizar" que saíram das telas há versões');

// A segunda renderResumoDia (a que vale) continua sendo a única definição de verdade.
assert.doesNotMatch(codigo, /function renderResumoDia\(items\)\{/,
  'a primeira renderResumoDia era substituída logo abaixo — nunca rodava, e varria todos os leads à toa');
assert.match(codigo, /let renderResumoDia = \(\) => \{\};/, 'o nome precisa existir antes da atribuição real');
assert.match(codigo, /renderResumoDia = function\(items\)\{/, 'a versão usada pela Home continua lá');

// ── 3. Sanidade do CSS: chaves balanceadas (a faxina mexeu em ~500 linhas) ────────────────────
{
  let prof = 0, i = 0;
  while (i < styles.length) {
    const c = styles[i];
    if (c === '/' && styles[i+1] === '*') { const f = styles.indexOf('*/', i+2); i = f < 0 ? styles.length : f + 2; continue; }
    if (c === '"' || c === "'") { const a = c; i++; while (i < styles.length && styles[i] !== a) { if (styles[i] === '\\') i++; i++; } i++; continue; }
    if (c === '{') prof++;
    if (c === '}') { prof--; assert.ok(prof >= 0, 'CSS com chave fechando a mais'); }
    i++;
  }
  assert.equal(prof, 0, 'CSS com chave sem fechar — a faxina não pode deixar o arquivo quebrado');
}

console.log('v1268-tema-unico-e-faxina: ok');
