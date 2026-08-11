import fs from 'node:fs';
import assert from 'node:assert/strict';

const html = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const importacao = fs.readFileSync(new URL('../js/importacao.js', import.meta.url), 'utf8');
const app = fs.readFileSync(new URL('../app.js', import.meta.url), 'utf8');

// v1220 — "esse botão de ver se é o mesmo cliente precisa aparecer logo na tela inicial sem ter
// que rolar pra baixo, senão dá impressão que travou" (dono, 11/08/2026).
//
// A v1219 fez a linha de andamento dizer que estava esperando ele. Faltava o principal: a
// pergunta em si nascia no FIM do card de Resultado, depois da análise inteira — ele precisava
// rolar a tela pra achar o que o app estava esperando.

// 1. Existe um lugar pra decisão ANTES de tudo na tela de importação.
const zip = html.slice(html.indexOf('<section id="zip"'), html.indexOf('id="resultCard"'));
assert.match(zip, /id="perguntaTopo"/, 'precisa existir a caixa de decisão do topo');
assert.ok(zip.indexOf('id="perguntaTopo"') < zip.indexOf('id="importCard"'),
  'a decisão vem ANTES do card de importar — é a primeira coisa da tela');
assert.match(zip, /id="perguntaTopo"[^>]*hidden/, 'sem decisão pendente, a caixa fica escondida');

// 2. A pergunta que TRAVA a importação é desenhada lá — e sai do resultado (senão duplica).
assert.match(importacao, /if\(nomeSoParecido && caixaTopo\)\{[\s\S]{0,320}caixaTopo\.hidden = false;[\s\S]{0,80}acoesHtml = "";/,
  'a pergunta vai pro topo e não fica repetida dentro do resultado');
assert.match(importacao, /caixaTopo\.innerHTML = `<div class="label">Precisa da sua resposta<\/div>` \+ acoesHtml;/,
  'a caixa do topo precisa se identificar como a que pede resposta');

// 3. E a página vai pro topo quando ela aparece — sem rolagem, que é o pedido.
assert.match(importacao, /window\.scrollTo\(\{ top: 0, behavior: "auto" \}\)/, 'a tela precisa voltar pro topo');
assert.ok(!/scrollIntoView\(\{ behavior:"smooth", block:"center" \}\)/.test(importacao),
  'a rolagem "pro meio" antiga não pode voltar: ela mirava uma posição que ainda ia mudar');
assert.match(importacao, /setTimeout\(irProTopo, 120\);/,
  'segunda passada depois que o resto do resultado é escrito (a altura da página muda)');

// 3b. A ORDEM importa e não é óbvia: enquanto a tela cheia da importação está de pé, o corpo da
// página fica travado (body.cpio-aberto{overflow:hidden}) — rolar antes disso não sai do lugar.
// Foi o que a conferência em tela pegou. A rolagem tem que vir DEPOIS de fechar a tela cheia.
const styles = fs.readFileSync(new URL('../styles.css', import.meta.url), 'utf8');
assert.match(styles, /body\.cpio-aberto\{overflow:hidden\}/, 'é essa regra que trava a rolagem — se sumir, revisar a ordem abaixo');
const fechaTelaCheia = importacao.indexOf('try{ cpImportOverlayVisivel(false); }catch(_){}', importacao.indexOf('qs("#btnVerCadastroParecido")?.addEventListener'));
assert.ok(fechaTelaCheia > -1 && fechaTelaCheia < importacao.indexOf('const irProTopo = () =>'),
  'primeiro fecha a tela cheia, só então rola pro topo — o contrário não tem efeito nenhum');

// 4. Numa análise nova a caixa some — senão a pergunta da importação anterior fica de pé.
const limpar = app.slice(app.indexOf('export function clearAnalysis(){'), app.indexOf('// Limpa nomes longos'));
assert.match(limpar, /cpPerguntaTopo\.innerHTML=""; cpPerguntaTopo\.hidden=true;/,
  'começar de novo precisa apagar a pergunta pendente da importação anterior');

// 5. Os dois casos que NÃO perguntam nada continuam onde estavam (não ganham caixa no topo).
const ramoExato = importacao.slice(importacao.indexOf('}else if(perguntarNome){'), importacao.indexOf('const caixaTopo = qs("#perguntaTopo");'));
assert.ok(!ramoExato.includes('perguntaTopo'), 'nome exato salva sozinho — não ocupa o topo da tela');

console.log('v1220-pergunta-no-topo-da-tela: ok');
