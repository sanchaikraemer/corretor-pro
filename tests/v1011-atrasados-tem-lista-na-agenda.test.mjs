import fs from 'node:fs';
import assert from 'node:assert/strict';

// v1011 — o sino dizia "9 compromissos atrasados" e não existia LUGAR NENHUM pra ver quais
// eram (o clique caía na Condução, que nem lista atrasados). Agora a Agenda tem a seção
// "Atrasados" no topo — mesma régua da contagem do sino — com retomar (abrir o lead) ou
// descartar (× quando o compromisso veio da leitura da conversa e a IA errou).

const app = fs.readFileSync(new URL('../app.js', import.meta.url), 'utf8');

// 1. A seção existe, usa a MESMA régua da contagem e aparece mesmo sem nada mais agendado.
assert.match(app, /Atrasados — retome ou descarte/, 'a Agenda precisa da seção "Atrasados"');
assert.match(app, /cp786CompromissoAtrasado === 'function'\) \? cp786CompromissoAtrasado\(l\)/, 'a lista precisa usar a mesma régua da contagem do sino');
assert.match(app, /&& !atrasados\.length\)\{\s*\n\s*box\.innerHTML = '<div class="empty">Nada agendado/, 'com só atrasados, a Agenda não pode dizer "Nada agendado"');

// 2. Cada compromisso vencido pode ser descartado (a IA pode ter errado a leitura).
assert.match(app, /function cpCompromissosVencidosDoLead/, 'precisa listar os compromissos vencidos de cada lead');
assert.match(app, /dispensarCompromisso\(\$\{keyJs\}\);carregarAgenda\(\)/, 'o × de descartar precisa atualizar a Agenda na hora');

// 3. O aviso do sino agora leva pra Agenda (onde a lista mora), não mais pra Condução.
assert.match(app, /atrasado\$\{d\.atrasados===1\?'':'s'\}<\/b><span>Veja a lista na Agenda/, 'o aviso do sino precisa levar pra lista na Agenda');
assert.ok(!/Venceram e ainda não foram tratados/.test(app), 'o texto antigo (que levava pra Condução) precisa sair');

console.log('v1011-atrasados-tem-lista-na-agenda: ok');
