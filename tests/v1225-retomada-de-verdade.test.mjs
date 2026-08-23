import fs from 'node:fs';
import assert from 'node:assert/strict';

const pipeline = fs.readFileSync(new URL('../api/_pipeline.js', import.meta.url), 'utf8');
const app = fs.readFileSync(new URL('../app.js', import.meta.url), 'utf8');

// v1225 — "Olha que ridículas sugestões de retomada de mensagem. Não está fazendo a retomada após
// vários dias sem conversa. Falou não sei o que está na cabeça, o que é isso? [...] Olha uma das
// respostas: 'sei que a vida corre'. Cara, que imbecilidade é essa?" (dono, 11/08/2026, 21h31).
//
// As três sugestões daquele print: a mesma oferta ("quer que eu te mande as plantas e valores?")
// em três tons, nenhuma reconhecendo que a conversa estava parada havia dias, uma delas dando a
// desculpa pronta pro cliente e outra dizendo o que o cliente tinha "na cabeça".

// ── 1. O que a IA recebe pra saber que a conversa parou ───────────────────────────────────────
// v1291 — ATENÇÃO, ISTO MUDOU DE FORMA. O dono reescreveu as instruções: o bloco longo "RETOMADA
// DEPOIS DE DIAS SEM CONVERSA — REGRA DURA" (com a lista de desculpas prontas proibidas: "sei que
// a vida corre", "se ainda tiver interesse", e a proibição de adivinhar o que o cliente pensa)
// saiu do produto. Quem decide como retomar passou a ser o Cérebro do corretor. O que o sistema
// garante é o INSUMO: dias parados, data da última mensagem, saudação do horário e prazo de
// retomada continuam chegando na IA — sem eles, nem o Cérebro consegue decidir.
assert.match(pipeline, /Dias corridos desde a última mensagem identificada: \$\{contextoTemporal\.dias/,
  'os dias parados precisam continuar chegando na IA');
assert.match(pipeline, /Data da última mensagem identificada: \$\{contextoTemporal\.ultimaData\}/,
  'e a data da última mensagem também');
assert.match(pipeline, /A saudação, o reconhecimento ou não do intervalo e o tipo de próximo passo devem seguir o Cérebro\./,
  'quem manda na retomada agora é o Cérebro do corretor');
assert.match(pipeline, /Os dados acima são contexto, não ordens para forçar visita, pergunta, encontro ou retomada\./,
  'e o contexto técnico não pode virar ordem de forçar retomada');
// A proibição de transformar silêncio em diagnóstico ("vi que você está com X na cabeça")
// sobreviveu à reescrita, dentro das proteções de integridade.
assert.match(pipeline, /não transforme silêncio em confirmação, aceite, objeção ou diagnóstico psicológico/,
  'a IA continua proibida de dizer o que o cliente tem "na cabeça"');
// ── 2. As três continuam nascendo da mesma leitura, sem virar três pedidos de licença ─────────
// v1291 — o bloco "AS TRÊS NÃO PODEM SER TRÊS PEDIDOS DE LICENÇA" também saiu na reescrita do
// dono. O que continua escrito, em forma curta, é o papel de cada uma das três.
// v1330 — as regras das três mensagens viraram um bloco próprio (blocoRegrasDasMensagens),
// declarado antes do prompt e colado na etapa que ESCREVE. Os recortes abaixo passaram a apontar
// pro bloco, não pro texto solto no meio do pedido.
const inicioTrio = pipeline.indexOf('const blocoRegrasDasMensagens = `');
const trio = pipeline.slice(inicioTrio, pipeline.indexOf('`;', inicioTrio));
assert.ok(trio.length > 200, 'a regra das três mensagens precisa existir');
assert.match(trio, /RECOMENDADA é a que você enviaria se só pudesse enviar uma/, 'a recomendada continua sendo a melhor de todas');
assert.match(trio, /MAIS DIRETA é objetiva/, 'o papel medido da direta continua existindo no prompt principal');
assert.match(pipeline, /MAIS DIRETA encurta o caminho até a pergunta central; não troca a pergunta por outra etapa/,
  'quando houver reparo por lacuna prioritária, a direta não pode pular para outra etapa');
assert.match(trio, /As três nascem da mesma verdade factual e da mesma leitura comercial/,
  'e as três continuam saindo da mesma leitura, não de três diagnósticos diferentes');

// ── 3. A IA voltou a receber CONVERSA DE VERDADE (resumo demais gera mensagem genérica) ────────
// v1247 — deixou de ser "conversa média vai inteira": TODA conversa vai inteira (limiar
// desligado). Resumo demais gerava mensagem genérica, e o dono cobrou isso de novo em 13/08.
assert.match(pipeline, /DIRECIONA_INCREMENTAL_MIN_CHARS \|\| Infinity/, 'toda conversa vai inteira');
assert.match(pipeline, /DIRECIONA_INCREMENTAL_CAUDA_CHARS \|\| 9000/, 'e a conversa longa vai com bem mais material real');

// ── 4. O corretor para de adivinhar se o Cérebro entrou ────────────────────────────────────────
// v1308 — a marca continua existindo, só passou a considerar TAMBÉM a chave "Usar o meu Cérebro"
// da tela de Configurações: sem Cérebro configurado OU com a chave desligada, ela vem falsa.
assert.match(pipeline, /cerebroAplicado: cerebroNoPedido,/, 'a análise registra se o Cérebro entrou');
assert.match(pipeline, /const cerebroNoPedido = chaveCerebro && !modoPrevia;/, 'e a chave da tela manda nisso');
assert.match(pipeline, /conversaLidaPelaIA: entradaIncremental/, 'e quanto da conversa a IA leu');
const linha = app.slice(app.indexOf('function cp1225LinhaDeOndeVeio(a){'), app.indexOf('function cp865UltimaAnaliseISO'));
assert.match(linha, /sem o seu Cérebro/, 'a tela avisa quando a análise saiu SEM o Cérebro');
// v1304 — o texto virou porcentagem a pedido do dono ("verde 100%, vermelho quando não conclui"):
// "leu a conversa inteira (3 mensagens)" virou "leu 100% da conversa (3 mensagens)". O que este
// teste guarda continua sendo o mesmo: a tela precisa dizer quanto da conversa a IA leu.
assert.match(linha, /leu \$\{cp1304Pct\(100\)\} da conversa/, 'e diz quando leu a conversa inteira');
assert.match(linha, /resumo de \$\{Number\(lida\.mensagensResumidas\)\|\|0\} antigas/, 'ou quanto entrou como resumo');
assert.match(app, /\$\{cp1225LinhaDeOndeVeio\(a\)\}/, 'a linha aparece embaixo das sugestões, no cliente');
// Análise antiga (sem esses campos) não pode mostrar linha nenhuma.
// v1309 — a única coisa que passou a sair mesmo numa análise antiga é o aviso de que as três
// mensagens são as da análise ANTERIOR (quando a nova não foi concluída): sem ele, o corretor
// recebia de volta, com cara de novidade, as mensagens que ele já tinha mandado.
assert.match(linha, /if\(a\.cerebroAplicado == null && !lida\) return reuso;/, 'análise antiga não inventa informação');
assert.match(linha, /a\.analiseReutilizadaDeImportacaoAnterior === true/, 'e o aviso de análise reaproveitada existe');

console.log('v1225-retomada-de-verdade: ok');
