import fs from 'node:fs';
import assert from 'node:assert/strict';

// v1267 — pedido do dono depois de estudar o método do Joe Girard ("Como vender qualquer coisa a
// qualquer um"). O ponto aproveitado é o do capítulo do "selling the smell": explicar não vende como
// experimentar vende. No carro era o cheiro e o test drive; em imóvel é entrar no apartamento, ir
// até a sacada, ver a posição solar, sentir o tamanho do living.
//
// Traduzido pro que sai na tela: quando o cliente JÁ recebeu vídeo/foto/link/planta e a conversa
// esfriou, mandar mais material é repetir o que já não funcionou. O próximo passo é o presencial.
//
// Entrou como ITEM da conferência final da v1263 — a lista curta, depois da conversa — e não como
// mais um bloco de princípio no meio do prompt. Essa escolha é o próprio remédio da v1263: entre a
// v1253 e a v1262 o prompt virou um paredão de 15 blocos de "É PROIBIDO" e a IA passou a honrar um
// subconjunto diferente a cada rodada. Regra concreta e conferível, no fim, funciona; princípio
// abstrato no meio do texto, não.

const src = fs.readFileSync(new URL('../api/_pipeline.js', import.meta.url), 'utf8');

const i = src.indexOf('CONFERÊNCIA FINAL — FAÇA ISTO ANTES DE DEVOLVER O JSON');
assert.ok(i > -1, 'precisa existir a conferência final (v1263)');
const fimPrompt = src.indexOf('`;', i);
const lista = src.slice(i, fimPrompt).replace(/\s+/g, ' ');

// ── A regra existe, e mora DENTRO da conferência (não num bloco novo espalhado pelo prompt) ────
assert.match(lista, /O CLIENTE JÁ RECEBEU MATERIAL E A CONVERSA PAROU\?/,
  'a conferência precisa perguntar se o cliente já recebeu material e a conversa parou');
assert.match(lista, /MAIS MATERIAL NÃO É O PRÓXIMO PASSO/,
  'precisa dizer com todas as letras que mandar mais material não é o próximo passo');
assert.match(lista, /Pelo menos uma das três precisa oferecer o presencial/,
  'pelo menos uma das três mensagens precisa oferecer o presencial');

// O presencial precisa ser executável: nada de "vamos marcar uma visita qualquer hora".
assert.match(lista, /dois dias\/horários concretos/,
  'a oferta de visita precisa vir com dois dias/horários concretos (senão vira intenção vaga)');
assert.match(lista, /por que vale mais ir do que continuar recebendo arquivo/,
  'a mensagem precisa dizer em uma frase por que ir vale mais que receber arquivo');

// ── E as três exceções, pra regra não virar cobrança automática ─────────────────────────────────
assert.match(lista, /cliente é de fora ou já disse que não consegue ir agora/,
  'exceção 1: cliente que não consegue ir (vira vídeo-chamada ao vivo, nunca mais um PDF)');
assert.match(lista, /vídeo-chamada ao vivo/, 'a alternativa pra quem não pode ir precisa estar dita');
assert.match(lista, /já existe visita marcada, ou ele acabou de receber o material/,
  'exceção 2: visita já marcada ou material recém-enviado');
assert.match(lista, /motivo declarado que uma visita não resolve/,
  'exceção 3: a conversa parou por um motivo que visita não resolve');
assert.match(lista, /vender o imóvel dele,\s*aprovar financiamento, esperar alguém decidir/,
  'a exceção 3 precisa dar os exemplos reais (imóvel a vender, financiamento, terceiro decidindo)');
// v1271 estreitou isto: "deixar as três como estavam" agora vale SÓ pra exceção 2 (visita já
// marcada / material recém-enviado). Nas outras duas, o que muda é a forma do encontro — a
// proibição de mandar mais material continua valendo (era essa brecha que deixava a mensagem
// oferecer "agrupar os materiais" pra quem já tinha recebido tudo).
assert.match(lista, /já existe visita marcada, ou ele acabou de receber o material e ainda nem teve tempo de olhar\s*— só aqui deixe as três como estavam/,
  'a exceção que congela as três mensagens é só a da visita marcada / material recém-enviado');

// ── Nada comercial cravado (regra da casa) ─────────────────────────────────────────────────────
const bloco = lista.slice(lista.indexOf('O CLIENTE JÁ RECEBEU MATERIAL'));
assert.doesNotMatch(bloco, /R\$|Personalité|Renaissance|Evolutti|Boulevard|Nova Vila Rica/,
  'a regra não pode citar empreendimento, preço ou condição — isso vem do Cérebro ou da conversa');

console.log('v1267-material-parou-chama-pra-ver: ok');
