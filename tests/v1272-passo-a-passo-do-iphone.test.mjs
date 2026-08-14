import fs from "node:fs";
import assert from "node:assert/strict";

// v1272 — O PASSO A PASSO ILUSTRADO PASSA A TER VERSÃO DE IPHONE.
//
// Relato do dono, em duas frases: "ninguém vai fazer todo esse processo" e, logo depois, "ele vai
// ter que enviar pra alguém pra conseguir salvar no PC e não no cel, pra depois abrir e importar".
// A segunda frase é o diagnóstico: o caminho do iPhone termina DENTRO do iPhone ("Salvar em
// Arquivos" guarda o ZIP no aparelho) — quem entendeu que precisava de computador entendeu porque
// o app estava ensinando o caminho do ANDROID pra quem estava no iPhone.
//
// O passo a passo ilustrado (v1149) era um só: mandava tocar nos "três pontinhos" (não existem no
// iPhone) e depois escolher o Corretor Pro na lista de compartilhar (a Apple não deixa aparecer,
// ver v1126). Duas paredes seguidas, e a conclusão de que só dava por fora.

const app = fs.readFileSync(new URL("../app.js", import.meta.url), "utf8");

const iniIos = app.indexOf("const CP1149_PASSOS_IOS = [");
assert.ok(iniIos > -1, "existe um passo a passo próprio do iPhone");
const passosIos = app.slice(iniIos, app.indexOf("function cp1149Passos(){"));

// ── 1. Os toques são os que EXISTEM no iPhone ─────────────────────────────────────────────────
for (const trecho of [
  "Abra a conversa do cliente",
  "Toque no nome do cliente",
  "Exportar conversa",
  "Anexar mídia",
  "Salvar em Arquivos",
  "Volte aqui e escolha o arquivo"
]) {
  assert.ok(passosIos.includes(trecho), `o passo a passo do iPhone precisa citar "${trecho}"`);
}
assert.ok(passosIos.indexOf("Toque no nome do cliente") < passosIos.indexOf("Exportar conversa"),
  "a ordem segue o caminho real do iPhone");
assert.ok(passosIos.indexOf("Anexar mídia") < passosIos.indexOf("Salvar em Arquivos"),
  "anexar mídia vem antes de salvar");

// ── 2. Nenhuma instrução impossível de cumprir no iPhone ──────────────────────────────────────
// Estas duas foram exatamente as paredes: "três pontinhos" não existe, e o ícone do Corretor Pro
// nunca vai aparecer na lista de compartilhar do iPhone (WebKit não implementa Web Share Target).
assert.doesNotMatch(passosIos, /três pontinhos/i,
  "no iPhone não existe o menu de três pontinhos — mandar procurar é beco sem saída");
assert.doesNotMatch(passosIos, /ícone do <b>Corretor Pro<\/b>/i,
  "no iPhone o app não aparece na lista de compartilhar — a Apple não deixa");

// ── 3. Diz ONDE o arquivo fica — é o que evita a ideia de "mandar pra alguém e abrir no PC" ────
assert.match(passosIos, /próprio iPhone/,
  "precisa dizer que o arquivo fica no próprio celular");
assert.match(passosIos, /não precisa de computador/,
  "precisa desmentir na cara a ideia de que o caminho passa por um computador");

// ── 4. Cada passo tem desenho, e o último abre o seletor de arquivo ali mesmo ──────────────────
assert.equal((passosIos.match(/desenho: cp1149Telinha\(/g) || []).length, 6,
  "os seis passos do iPhone têm ilustração");
assert.match(passosIos, /id=\\"cp1149EscolherArquivo\\"/,
  "o último passo traz o botão que abre o seletor de arquivo");
assert.match(app, /card\.querySelector\("#cp1149EscolherArquivo"\)\?\.addEventListener\("click", \(\) => \{/,
  "e esse botão está ligado de verdade");
// O Safari só abre o seletor DENTRO do toque do dedo: fechar o modal antes mataria a abertura.
const bloco = app.slice(app.indexOf('card.querySelector("#cp1149EscolherArquivo")'));
const corpo = bloco.slice(0, bloco.indexOf("});"));
assert.ok(corpo.indexOf('#zipFileInput') < corpo.indexOf('fechar()'),
  "abre o seletor antes de fechar o modal (senão o Safari bloqueia)");

// ── 5. O aparelho decide qual passo a passo ver ───────────────────────────────────────────────
assert.match(app, /function cp1149Passos\(\)\{\s*return cpEhIOS\(\) \? CP1149_PASSOS_IOS : CP1149_PASSOS_ANDROID;/,
  "quem está no iPhone vê o do iPhone; o resto continua vendo o do Android");
assert.match(app, /const passos = cp1149Passos\(\);/,
  "o modal monta a lista pelo aparelho, não numa lista fixa");
assert.doesNotMatch(app, /CP1149_PASSOS\[/,
  "não pode sobrar nenhum acesso à lista antiga e única");
// O desenho do Android é texto pronto e o do iPhone também, mas o modal precisa aguentar os dois
// formatos (o de instalar, v1155, usa função) — senão volta a aparecer "undefined" na tela.
assert.match(app, /const desenhoPasso = \(typeof p\.desenho === "function"\) \? p\.desenho\(\) : p\.desenho;/,
  "o modal aceita desenho como texto ou como função");

// ── 6. A ajuda escrita da tela conta a mesma história ─────────────────────────────────────────
const ajuda = app.slice(app.indexOf("function cpTextoAjudaImportar(){"));
const blocoAjuda = ajuda.slice(0, ajuda.indexOf("\n}"));
assert.match(blocoAjuda, /mais dois toques e acabou/,
  "a ajuda do iPhone abre pelo caminho (curto), não pela trava da Apple");
assert.match(blocoAjuda, /não precisa de computador/,
  "a ajuda também desmente o computador");
// Sem os comentários: o que interessa aqui é o texto que o corretor lê na tela.
const ajudaNaTela = blocoAjuda.split("\n").filter(l => !l.trim().startsWith("//")).join("\n");
assert.doesNotMatch(ajudaNaTela, /Atalho/,
  "a ajuda curta não gasta espaço com o Atalho — montar um Atalho na mão não é o caminho normal");
assert.match(ajudaNaTela, /Como enviar sua conversa/,
  "e aponta o passo a passo com desenho, que é onde o caminho está inteiro");
// Nos passos da Home ele continua citado (a v1126 guarda isso), mas como plano B: depois do
// caminho que qualquer um consegue seguir, e marcado como opcional.
const passosHome = app.slice(app.indexOf("function cpPassosImportar(){"));
const blocoPassos = passosHome.slice(0, passosHome.indexOf("\n}"));
assert.ok(blocoPassos.indexOf("Salvar em Arquivos") < blocoPassos.indexOf("Atalho"),
  "o Atalho vem depois do caminho normal, nunca no lugar dele");
assert.match(blocoPassos, /é opcional, o caminho acima já resolve/,
  "e está escrito que é opcional");

console.log("v1272-passo-a-passo-do-iphone: ok");
