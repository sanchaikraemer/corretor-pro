import fs from 'node:fs';
import assert from 'node:assert/strict';
import { _mesclarTimelinesV681, _assinaturaTimelineV681 } from '../api/_persistence.js';

// v956 — revisão de api/lead-update.js. acaoAtualizarComEvolucao (ação "atualizar-com-evolucao",
// o caminho mais comum de reimportação de um lead já existente — inclusive o novo fluxo
// automático da v953) tinha sua PRÓPRIA mescla de timeline (assinaturaMsg/mesclarTimelines),
// mais simples que _mesclarTimelinesV681 de _persistence.js — sem a proteção da v900 ("mensagem
// enviada" copiada/sugestão sendo substituída pela mensagem REAL quando a reimportação a traz).
// O teste v900-mensagem-real-vence.test.mjs só cobria _persistence.js; esse caminho (o mais
// comum) ficava sem essa proteção. Corrigido: agora usa a mesma função, já exportada.

const leadUpdateSrc = fs.readFileSync(new URL('../api/lead-update.js', import.meta.url), 'utf8');

// 1. O import busca as funções de _persistence.js.
assert.match(leadUpdateSrc, /_assinaturaTimelineV681, _mesclarTimelinesV681 \} from "\.\/_persistence\.js"/,
  'lead-update.js importa as funções de mescla de _persistence.js');

// 2. acaoAtualizarComEvolucao usa as funções importadas, não uma versão local.
const fnStart = leadUpdateSrc.indexOf('async function acaoAtualizarComEvolucao');
const fnEnd = leadUpdateSrc.indexOf('\n}\n', fnStart);
const corpo = leadUpdateSrc.slice(fnStart, fnEnd);
assert.match(corpo, /_mesclarTimelinesV681\(timelineAntiga, timelineNova\)/, 'usa _mesclarTimelinesV681 pra mesclar');
assert.match(corpo, /timeline: novaTimeline/, 'desestrutura a propriedade "timeline" (formato de _mesclarTimelinesV681, não "mescladas")');
assert.match(corpo, /_assinaturaTimelineV681/, 'usa _assinaturaTimelineV681 pra achar mensagens novas');

// 3. As funções locais antigas (mais simples, sem proteção v900) não existem mais no arquivo.
assert.doesNotMatch(leadUpdateSrc, /function assinaturaMsg\(/, 'assinaturaMsg local foi removida');
assert.doesNotMatch(leadUpdateSrc, /function mesclarTimelines\(/, 'mesclarTimelines local foi removida');

// 4. Comportamento de verdade: a mesma cena do v900 (cópia enviada substituída pela mensagem
// real), agora via import direto (a função está exportada) — prova que o fix de export não
// alterou o comportamento já validado.
const prefixo = 'Boa tarde, tudo bem? Vi que você tinha interesse no imóvel e';
const copia = { type: 'mensagem_enviada', source: 'manual', author: 'Você', date: '10/03/2026', time: '09:00',
  iso: '2026-03-10T12:00:00Z', text: prefixo + ' queria saber se ainda faz sentido conversarmos essa semana' };
const real = { type: 'text', source: 'whatsapp', author: 'Você', date: '10/03/2026', time: '09:05',
  iso: '2026-03-10T12:05:00Z', text: prefixo + ' fiquei pensando numa condição diferente pra você, topa ver?' };
const resultado = _mesclarTimelinesV681([copia], [real]);
assert.equal(resultado.timeline.length, 1, 'fica só a mensagem real, a cópia sai');
assert.ok(resultado.timeline[0].text.endsWith('topa ver?'), 'o texto que sobra é o real, não a cópia');
assert.equal(resultado.substituidasPelaReal, 1, 'contabiliza a substituição');

// 5. Assinatura de áudio: já vinha em minúsculo em _persistence.js (não precisou de fix aqui,
// diferente do achado da v955 em _pipeline.js) — confere que segue assim.
assert.equal(_assinaturaTimelineV681({ mediaFile: 'AUD-Teste.OPUS' }), 'audio|aud-teste.opus');

console.log('v956-atualizar-usa-mescla-v900: ok');
