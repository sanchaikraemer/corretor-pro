import fs from 'node:fs';
import assert from 'node:assert/strict';

const src = fs.readFileSync(new URL('../api/_persistence.js', import.meta.url), 'utf8');

// v900 — ao reimportar a conversa, a mensagem REAL do WhatsApp deve vencer a "mensagem enviada"
// (sugestão copiada), que é só uma aproximação do que foi mandado. Antes o dedup mantinha a
// cópia antiga e o app mostrava um texto diferente do que o corretor realmente enviou.

// Extrai as funções puras e executa.
const assinatura = src.match(/function _assinaturaTimelineV681\(m\) \{[\s\S]*?\n\}/)[0];
const mesclar = src.match(/function _mesclarTimelinesV681\(antiga, nova\) \{[\s\S]*?\n\}/)[0];
const _mesclarTimelinesV681 = eval(`${assinatura}\n${mesclar}\n_mesclarTimelinesV681`);

const prefixo = 'Boa tarde Tiago, tudo bem? Faz algum tempo que falamos sobre o Boulevard de 3 dormitórios e lembro que você e sua esposa estavam buscando mais espaço';
const copia = { type: 'mensagem_enviada', source: 'manual', author: 'Você', date: '21/07/2026', time: '12:13',
  iso: '2026-07-21T15:13:00Z', text: prefixo + '. Faz sentido avaliarmos algo dentro desse perfil?' };
const real = { type: 'text', source: 'whatsapp', author: 'Você', date: '21/07/2026', time: '12:14',
  iso: '2026-07-21T15:14:00Z', text: prefixo + '. Algumas vezes nos ofertam outros imóveis na negociação, o que acha?' };

// 1. Bug: a cópia sai, a real fica.
const r1 = _mesclarTimelinesV681([copia], [real]);
const textos1 = r1.timeline.map(m => m.text);
assert.ok(textos1.some(t => /o que acha\?$/.test(t)), 'a mensagem REAL enviada deve permanecer');
assert.ok(!textos1.some(t => /desse perfil\?$/.test(t)), 'a cópia (sugestão) deve ser descartada');
assert.equal(r1.timeline.length, 1, 'fica só uma mensagem (a real)');
assert.equal(r1.substituidasPelaReal, 1, 'contabiliza 1 cópia substituída');

// 2. Sem a real correspondente na importação, a cópia é preservada (não some sozinha).
const r2 = _mesclarTimelinesV681([copia], [{ type:'text', source:'whatsapp', author:'Tiago', date:'21/07/2026', time:'14:01', iso:'2026-07-21T17:01:00Z', text:'agradeço, mas já temos apartamento de 2 quartos' }]);
assert.ok(r2.timeline.some(m => /desse perfil\?$/.test(m.text)), 'sem import correspondente, a cópia fica');

// 3. Mensagem real com começo DIFERENTE não derruba a cópia (evita falso positivo).
const r3 = _mesclarTimelinesV681([copia], [{ type:'text', source:'whatsapp', author:'Você', date:'22/07/2026', time:'09:00', iso:'2026-07-22T12:00:00Z', text:'Bom dia! Consegui uma opção nova no Ibirubá pra vocês verem.' }]);
assert.ok(r3.timeline.some(m => /desse perfil\?$/.test(m.text)), 'cópia preservada quando não há real parecida');

console.log('v900-mensagem-real-vence: ok');
