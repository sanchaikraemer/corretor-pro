import fs from 'node:fs';
import assert from 'node:assert/strict';

// v916 — pedido do dono: dentro de "Aguardando cliente" (bola com o cliente, você já atendeu
// e ele não respondeu ainda), a ordem de apresentação passa a ser por quem você atendeu MAIS
// RECENTEMENTE primeiro — não mais por chance de venda (scoreRankingHoje). Se você acabou de
// atender o Michael agora, ele sobe pro topo da lista, na frente de quem foi atendido antes.

const app = fs.readFileSync(new URL('../app.js', import.meta.url), 'utf8');

const tipos = app.match(/const TIPOS_ATENDIMENTO_TIMELINE = new Set\(\[[^\]]*\]\);/);
const ultAt = app.match(/function ultimoAtendimentoTs\(l\)\{[\s\S]*?\n\}/);
const ordenar = app.match(/function cp786OrdenarConducao\(lista,metaPronto=null\)\{[\s\S]*?\n\}/);
assert.ok(tipos && ultAt && ordenar, 'não achei TIPOS_ATENDIMENTO_TIMELINE/ultimoAtendimentoTs/cp786OrdenarConducao em app.js');

// cp786OrdenarConducao chama cp786Categoria/scoreRankingHoje/cp786CompromissoOrdemTs só quando
// necessário. Com metaPronto informando a categoria e _score já preenchido em cada lead, o
// teste executa a função REAL sem precisar extrair essas outras cadeias de dependência.
const cp786OrdenarConducao = eval(`${tipos[0]}\n${ultAt[0]}\n${ordenar[0]}\n; cp786OrdenarConducao`);

function leadAtendidoEm(nome, quandoISO){
  return {
    name: nome,
    _score: 0, // mesmo score pra forçar o desempate pelo atendimento mais recente
    analysis: { aprendizado: { eventos: [{ evento: 'contato_manual', quando: quandoISO }] } }
  };
}

const michael = leadAtendidoEm('Michael', new Date().toISOString()); // atendido agora
const antigo1 = leadAtendidoEm('Ana', '2026-07-20T10:00:00Z');       // atendido 2 dias atrás
const antigo2 = leadAtendidoEm('Bruno', '2026-07-18T10:00:00Z');     // atendido 4 dias atrás

const metaPronto = new Map([
  [michael, { categoria: 'aguardando' }],
  [antigo1, { categoria: 'aguardando' }],
  [antigo2, { categoria: 'aguardando' }]
]);

// Embaralhado de propósito — a ordem de entrada não pode influenciar o resultado.
const ordenado = cp786OrdenarConducao([antigo2, michael, antigo1], metaPronto);
assert.deepEqual(
  ordenado.map(l => l.name),
  ['Michael', 'Ana', 'Bruno'],
  'quem foi atendido mais recentemente deve vir primeiro em "Aguardando cliente"'
);

// Um score de conversão mais alto NÃO pode furar a fila: atendimento recente manda.
const bemQualificado = { name: 'Cliente A', _score: 500, analysis: { aprendizado: { eventos: [{ evento: 'contato_manual', quando: '2026-07-10T10:00:00Z' }] } } };
const recemAtendido = { name: 'Cliente B', _score: 0, analysis: { aprendizado: { eventos: [{ evento: 'contato_manual', quando: new Date().toISOString() }] } } };
const metaPronto2 = new Map([[bemQualificado, { categoria: 'aguardando' }], [recemAtendido, { categoria: 'aguardando' }]]);
const ordenado2 = cp786OrdenarConducao([bemQualificado, recemAtendido], metaPronto2);
assert.equal(ordenado2[0].name, 'Cliente B', 'atendimento recente vence score de conversão mais alto dentro de "Aguardando cliente"');

console.log('v916-aguardando-por-atendimento-recente: ok');
