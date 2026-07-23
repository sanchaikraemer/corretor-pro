import fs from 'node:fs';
import assert from 'node:assert/strict';

const app = fs.readFileSync(new URL('../app.js', import.meta.url), 'utf8');
const pipeline = fs.readFileSync(new URL('../api/_pipeline.js', import.meta.url), 'utf8');

// v935 — bug reportado pelo dono via print: a conversa importada tinha a Angelica escolhendo
// TRÊS lotes específicos ("105 da quadra 77, 37 quadra 157, 31 quadra 155"), mas em NENHUM
// lugar da análise/"Detalhes comerciais" isso aparecia — só o nome genérico do empreendimento
// ("Terrenos no Loteamento Nova Vila Rica III"). A escolha real do cliente se perdia.
//
// Causa: o prompt de análise não instruía a IA a capturar identificadores específicos de
// unidade (lote/quadra/apartamento) quando o cliente os citava, e o array "produtosInteresse"
// (já existia no schema, mas só recebia fallback do produto genérico) nunca era exibido no
// front. Fix: (1) instrução explícita no prompt; (2) nova linha em "Detalhes comerciais" que
// mostra as unidades específicas quando há mais de uma.

// 1. O prompt de análise agora instrui a IA a capturar identificadores específicos de unidade
// (lote/quadra/apartamento/bloco/torre) em vez de só o nome genérico do empreendimento, e a
// listar cada unidade específica separadamente em "produtosInteresse" quando houver mais de uma.
assert.match(pipeline, /PRODUTO ESPECÍFICO:/, 'prompt precisa ter a instrução de produto específico');
assert.match(pipeline, /"produtoInteresse" PRECISA incluir esses\nidentificadores/,
  '"produtoInteresse" deve ser instruído a incluir os identificadores específicos citados pelo cliente');
assert.match(pipeline, /liste cada uma como um\nitem separado em "produtosInteresse"/,
  '"produtosInteresse" deve listar cada unidade específica separadamente');

// 2. cp704DetailRows (a lista de "Detalhes comerciais" do lead) ganha uma linha nova que só
// aparece quando existe MAIS DE UMA unidade específica em analysis.produtosInteresse (evita
// duplicar a linha "Produto" no caso comum de só um item genérico).
const iniRows = app.indexOf('function cp704DetailRows(lead,mc){');
const fimRows = app.indexOf('\n  }', iniRows);
assert.ok(iniRows !== -1 && fimRows !== -1, 'cp704DetailRows não encontrada em app.js');
const rows = app.slice(iniRows, fimRows);
assert.match(rows, /const produtosInteresse ?= ?Array\.isArray\(a\.produtosInteresse\)/,
  'deve ler o array produtosInteresse da análise');
assert.match(rows, /\['Unidades específicas de interesse',produtosInteresse\.length>1\?produtosInteresse\.join\('; '\):''\]/,
  'nova linha "Unidades específicas de interesse" só aparece com 2+ unidades específicas');

console.log('v935-unidades-especificas-produto: ok');
