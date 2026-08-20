import fs from "node:fs";
import assert from "node:assert/strict";
import { avisosDeQualidadeDasMensagens, fatosInventadosNaMensagem } from "../api/_pipeline.js";

// v1332 — A CONFERÊNCIA QUE EXISTIA E NINGUÉM CHAMAVA.
//
// Prints do dono em 20/08/2026, numa cliente com quem ele nunca falou daquele empreendimento:
//   • "você tinha me pedido a metragem e os valores do [empreendimento] no início" — a IA afirmou
//     que a CLIENTE pediu algo que ela nunca pediu, com nome vindo de outra conversa;
//   • "faz 9 dias que te mandei o vídeo" — abertura cobrando tempo;
//   • duas das três terminavam pedindo a mesma coisa (o teto de investimento).
// "que bosta de sugestões são essas? ridículo isso" (dono).
//
// `fatosInventadosNaMensagem` existia desde a v1305 e estava SEM NENHUM CHAMADOR desde a v1315 — a
// conferência tinha morrido junto com a rede de reescrita. Aqui ela volta a ser chamada. Não
// reescreve nada e não pede correção à IA: confere e mostra na tela, ao lado da sugestão.

const CONVERSA = [
  "[19/08/2026 15:00] Vanessa: quero algo em Carazinho ou Ibirubá",
  "[19/08/2026 15:10] Corretor: te mandei o vídeo do Quality",
  "[19/08/2026 15:20] Vanessa: o de Ibirubá ficou acima do que eu queria investir"
].join("\n");

// ── 1. Nome que não está na conversa (nem no Cérebro) é apontado ─────────────────────────────
{
  const avisos = avisosDeQualidadeDasMensagens([
    { qual: "b", texto: "Boa noite Vanessa, você tinha me pedido a metragem e os valores do Evolutti no início. Hoje, Carazinho ou Ibirubá pesa mais para você?" }
  ], { conversa: CONVERSA, cerebro: "" });
  assert.equal(avisos.length, 1);
  assert.match(avisos[0].motivos.join(" | "), /Evolutti/, "o nome forasteiro precisa aparecer no aviso, com todas as letras");

  // E se o empreendimento estiver no Cérebro do corretor, não é invenção: não acusa.
  const comCerebro = avisosDeQualidadeDasMensagens([
    { qual: "b", texto: "Boa noite Vanessa, quer que eu te mande o material do Evolutti? Carazinho ou Ibirubá pesa mais para você?" }
  ], { conversa: CONVERSA, cerebro: "Empreendimentos: Evolutti, Quality." });
  assert.deepEqual(comCerebro, [], "nome que está no Cérebro do corretor não é invenção");
}

// ── 2. Abertura cobrando tempo ───────────────────────────────────────────────────────────────
{
  const avisos = avisosDeQualidadeDasMensagens([
    { qual: "a", texto: "Boa noite Vanessa, faz 9 dias que te mandei o vídeo do Quality. Quer que eu separe outras opções em Carazinho?" }
  ], { conversa: CONVERSA, cerebro: "" });
  assert.match(avisos[0].motivos.join(" | "), /abre contando os dias/, "ninguém abre conversa contando dias parados");

  // Reconhecer o intervalo sem numerar continua liberado — é o que o piso da v1320 pede.
  const semNumero = avisosDeQualidadeDasMensagens([
    { qual: "a", texto: "Boa noite Vanessa, o vídeo do Quality que te mandei ficou sem resposta. Quer que eu separe outras opções em Carazinho?" }
  ], { conversa: CONVERSA, cerebro: "" });
  assert.deepEqual(semNumero, [], "reconhecer o intervalo sem contar os dias não é defeito");
}

// ── 3. Duas das três pedindo a mesma coisa ───────────────────────────────────────────────────
{
  const avisos = avisosDeQualidadeDasMensagens([
    { qual: "a", texto: "Boa noite Vanessa, até quanto você pretende investir agora para eu separar algo em Carazinho?" },
    { qual: "b", texto: "Boa noite Vanessa, entre Carazinho e Ibirubá, qual região pesa mais para você?" },
    { qual: "c", texto: "Boa noite Vanessa, me diz um teto de investimento e eu separo poucas opções." }
  ], { conversa: CONVERSA, cerebro: "" });
  const c = avisos.find(x => x.qual === "c");
  assert.ok(c, "a terceira repete a pergunta da primeira e precisa ser apontada");
  assert.match(c.motivos.join(" | "), /mesma coisa que a sugestão A/i);
  assert.ok(!avisos.some(x => x.qual === "b"),
    "a do meio pergunta outra coisa (região) e NÃO pode ser acusada só por citar as mesmas cidades");
}

// ── 4. Trio bom não é acusado de nada ────────────────────────────────────────────────────────
{
  const avisos = avisosDeQualidadeDasMensagens([
    { qual: "a", texto: "Boa noite Vanessa, o vídeo do Quality que te mandei mostra a unidade pronta. Você prefere Carazinho ou Ibirubá?" },
    { qual: "b", texto: "Boa noite Vanessa, separei duas opções novas em Carazinho. Quer que eu te mande as plantas?" },
    { qual: "c", texto: "Boa noite Vanessa, pra eu filtrar direito: qual o teto de valor que você quer?" }
  ], { conversa: CONVERSA, cerebro: "" });
  assert.deepEqual(avisos, [], "sugestão boa não pode receber aviso — senão o aviso vira ruído e ninguém lê");
}

// ── 5. A conferência está LIGADA na análise, e a tela mostra ─────────────────────────────────
{
  const pipeline = fs.readFileSync(new URL("../api/_pipeline.js", import.meta.url), "utf8");
  assert.match(pipeline, /avisosMensagens = avisosDeQualidadeDasMensagens\(/,
    "a análise precisa CHAMAR a conferência — foi exatamente isso que faltava desde a v1315");
  assert.match(pipeline, /problemasPorSugestao: Object\.fromEntries\(avisosMensagens/,
    "e entregar pela mesma porta que a tela já lê (v1308)");
  // A regra da v1315 continua: conferir sim, reescrever não.
  const bloco = pipeline.slice(pipeline.indexOf("export function avisosDeQualidadeDasMensagens"), pipeline.indexOf("export function avisosDeQualidadeDasMensagens") + 3000);
  assert.ok(!/replace\(/.test(bloco), "a conferência não pode mexer no texto da IA");

  const app = fs.readFileSync(new URL("../app.js", import.meta.url), "utf8");
  assert.match(app, /Confira antes de enviar/, "o aviso aparece colado na sugestão");
  assert.ok(!/O app tentou refazer esta mensagem/.test(app),
    "a tela não pode prometer uma refeitura que não existe desde a v1315");
}

// ── 6. As duas tarjas vermelhas param de gritar ──────────────────────────────────────────────
{
  const app = fs.readFileSync(new URL("../app.js", import.meta.url), "utf8");
  assert.ok(!/notice error[^`]*Estas três mensagens são da análise ANTERIOR/.test(app),
    "o aviso de análise anterior vira uma linha discreta, não um bloco de alarme");
  assert.match(app, /Sugestões da análise anterior/, "mas continua avisando, com o botão de reanalisar");
  assert.ok(!/exporte a conversa no WhatsApp com <b>“Incluir mídia”<\/b> e importe de novo/.test(app),
    "a frase que mandava reexportar sumiu: a mídia vinha, o app é que não lia");
  assert.match(app, /o app lê alguns arquivos por importação/, "no lugar dela, o motivo verdadeiro");
}

// ── 7. A checagem antiga continua inteira (não foi alterada, só voltou a ser usada) ──────────
{
  assert.deepEqual(fatosInventadosNaMensagem("", null), [], "sem contexto, não julga nada");
  const inventado = fatosInventadosNaMensagem(
    "Vamos marcar no Renaissance, na Rua Inventada 400?",
    { conversa: CONVERSA, cerebro: "" }
  );
  assert.ok(inventado.length, "endereço que a conversa não tem continua sendo apontado");
}

console.log("v1332-conferencia-das-tres-sugestoes: ok");
