import fs from 'node:fs';
import assert from 'node:assert/strict';

// v1257 — CORREÇÃO DE UM ERRO INTRODUZIDO PELA v1253, flagrado pelo dono com print do WhatsApp.
//
// Na conversa da lead Marina eu (e a análise) concluí que ela "pediu 3 dormitórios três vezes e
// nunca recebeu uma opção". O dono corrigiu: "ela recebeu as opções sim, so q nao vai imagens e
// links e pdfs no histórico, mas veja anexo. acho q vc nao esta lendo o histórico todo como deve
// ser feito SEMPRE".
//
// Ele está certo, e o risco é grave: a conversa exportada do WhatsApp NÃO carrega o conteúdo de
// imagem, vídeo, PDF nem áudio — só um marcador "[Arquivo enviado nesta mensagem: ...]" (v1058).
// Uma tabela de valores, uma planta, um print com opções ou um catálogo inteiro podem estar
// exatamente ali dentro. Link mandado pelo corretor também é entrega (mapa de disponibilidades,
// tabela, lista de opções).
//
// A regra da v1253 ("pedidoSemResposta manda na recomendada: ela precisa ENTREGAR o que o cliente
// pediu") aplicada em cima dessa leitura errada faz o app mandar o corretor REENVIAR como novidade
// algo que ele já enviou — passa desatenção pro cliente. Este teste trava as duas defesas.

const src = fs.readFileSync(new URL('../api/_pipeline.js', import.meta.url), 'utf8');
const bloco = (marca, tam = 1800) => {
  const i = src.indexOf(marca);
  assert.ok(i > -1, `não achei a regra "${marca}"`);
  return { i, txt: src.slice(i, i + tam).replace(/\s+/g, ' ') };
};

// ── 1. O marcador de arquivo continua chegando à IA (base de tudo, criado na v1058) ─────────
assert.match(src, /\[Arquivo enviado nesta mensagem: imagem — conteúdo não analisado pela IA\]/,
  'o marcador de imagem precisa continuar existindo — sem ele a IA nem sabe que houve arquivo');
assert.match(src, /\[Arquivo enviado nesta mensagem: documento\/PDF — conteúdo não analisado pela IA\]/,
  'o marcador de documento/PDF precisa continuar existindo');

// ── 2. A trava: anexo ou link depois do pedido = pedido ATENDIDO ─────────────────────────────
const trava = bloco('TRAVA OBRIGATÓRIA ANTES DE DIZER QUE ALGO NÃO FOI ENTREGUE');
assert.match(trava.txt, /NÃO\s*carrega o conteúdo de imagem, vídeo, PDF\/documento nem áudio/,
  'a trava precisa explicar que o histórico não carrega o conteúdo dos arquivos');
assert.match(trava.txt, /Link\s*também é entrega/,
  'link mandado pelo corretor precisa contar como entrega');
assert.match(trava.txt, /o pedido conta como ATENDIDO e "pedidoSemResposta" recebe "Nenhum"/,
  'com anexo ou link depois do pedido, pedidoSemResposta tem que ser "Nenhum" — senão a v1253 manda reenviar');
assert.match(trava.txt, /Ausência no histórico NÃO é prova de ausência no WhatsApp/,
  'a regra precisa dizer isso com todas as letras — foi exatamente o erro cometido');

// ── 3. Na dúvida, a mensagem funciona nos dois casos ─────────────────────────────────────────
assert.match(trava.txt, /funcionar NOS DOIS CASOS/,
  'na dúvida a mensagem tem que servir pra quem recebeu e pra quem não recebeu');
assert.match(trava.txt, /das opções que te mandei, alguma chegou perto/,
  'precisa existir o exemplo da formulação segura, que não constrange se já foi enviado');
assert.match(trava.txt, /reenviar como novidade algo que ele já enviou é um erro grave/,
  'reenviar como novidade precisa estar classificado como erro grave');

// ── 4. Ler o histórico inteiro, sempre ───────────────────────────────────────────────────────
const leitura = bloco('LEIA O HISTÓRICO INTEIRO, DO COMEÇO — SEMPRE');
assert.match(leitura.txt, /Não analise só as últimas mensagens/,
  'a regra precisa proibir analisar só o fim da conversa');
assert.match(leitura.txt, /percorra a conversa do início ao fim/,
  'precisa mandar percorrer do início ao fim antes de escrever');
assert.match(leitura.txt, /Nunca trate "não aparece aqui" como "não aconteceu"/,
  'o princípio geral precisa estar dito: falta no texto não é falta no mundo real');

// ── 5. As duas regras moram no prompt de quem TEM Cérebro (regra da v1247) ───────────────────
const iniPrincipal = src.indexOf('Execute a análise usando o Cérebro Comercial');
assert.ok(iniPrincipal > -1, 'não achei o prompt principal');
for (const [nome, b] of [['trava de entrega', trava], ['leitura do histórico', leitura]]) {
  assert.ok(b.i > iniPrincipal,
    `a regra de ${nome} precisa estar no prompt que usa o Cérebro Comercial — nunca só no modo prévia`);
}

// A trava tem que vir DEPOIS da regra que ela limita, pra a IA ler a exceção junto com a regra.
const iniV1253 = src.indexOf('E quando "pedidoSemResposta" NÃO for "Nenhum"');
assert.ok(iniV1253 > -1, 'não achei a regra da v1253 que a trava limita');
assert.ok(trava.i > iniV1253,
  'a trava precisa vir logo depois da regra da v1253 — é a exceção dela, e tem que ser lida junto');

console.log('v1257-anexo-e-link-contam-como-entrega: ok');
