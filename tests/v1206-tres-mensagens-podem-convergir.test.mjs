// v1206 — as três sugestões podem convergir para o MESMO próximo passo quando só existe um.
//
// v1372/governança: o coração do prompt é medido e protegido pelo porteiro v1327. Portanto esta
// regra não pode mais ser "enfiada" no miolo medido sem uma nova bateria comercial. A garantia
// ficou em duas camadas fora desse miolo: conferência determinística da saída + uma chamada curta
// de reparo SOMENTE quando as mensagens reprovam. Este teste protege essa arquitetura.
import fs from "node:fs";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";

const src = fs.readFileSync(new URL("../api/_pipeline.js", import.meta.url), "utf8");
const assinatura = JSON.parse(fs.readFileSync(new URL("../evals/assinatura-do-prompt.json", import.meta.url), "utf8"));

// 1) O prompt medido continua exatamente o que foi aprovado pela bateria histórica.
const partes = [...src.matchAll(
  /=====\s*INÍCIO DO MIOLO DO PROMPT[^\n]*=====\n([\s\S]*?)\n\s*\/\/ =====\s*FIM DO MIOLO DO PROMPT/g
)].map(m => m[1]);
assert.equal(partes.length, 2, "os dois miolos medidos precisam continuar cercados pelos marcadores");
const miolo = partes.join("\n").replace(/\r/g, "").replace(/[ \t]+/g, " ").trim();
assert.ok(miolo.length > 15000, "o miolo medido precisa existir");
const hash = createHash("sha256").update(miolo).digest("hex").slice(0, 32);
assert.equal(hash, assinatura.assinatura, "a correção das mensagens não pode alterar silenciosamente o prompt medido");

// 2) A regra nova existe no revisor pós-medição, não no coração do diagnóstico.
assert.match(src, /const systemPromptReparoMensagens = `Você é o revisor final das mensagens comerciais do Corretor Pro/);
assert.match(src, /Se houver um único próximo passo adequado, as três DEVEM convergir para ele/i,
  "o reparo precisa obrigar convergência quando só existe um passo adequado");
assert.match(src, /CONVERGIR NO PASSO NÃO É COPIAR A PERGUNTA/i);
assert.match(src, /MESMA LACUNA NÃO SIGNIFICA MESMA MENSAGEM/i);
assert.match(src, /MAIS SUAVE reduz a pressão pela forma de escrever; não muda a pergunta central/i);
assert.match(src, /MAIS DIRETA encurta o caminho até a pergunta central; não troca a pergunta por outra etapa/i);

// 3) A saída é conferida deterministicamente antes de ser mostrada ao corretor.
assert.match(src, /avisosDeQualidadeDasMensagens\(/,
  "a convergência não pode depender só de instrução para a IA");
assert.match(src, /lacunaPrioritaria/,
  "a conferência precisa conhecer a lacuna comercial prioritária");
assert.match(src, /A, B e C devem pedir exatamente essa lacuna/i,
  "o reparo não pode abrir entrada\/parcelas quando a prioridade é outra");

// 4) Variar a redação não autoriza inventar compromisso para parecer diferente.
assert.match(src, /NÃO INVENTE COMPROMISSO/i);
assert.match(src, /não crie ligação, visita, reunião, avaliação, dia, horário ou compromisso/i);

console.log("v1206-tres-mensagens-podem-convergir: ok");
