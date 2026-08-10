import fs from 'node:fs';
import assert from 'node:assert/strict';

// v1207 — "não acho no celular onde agendar a hora, só dia". O painel "Agendar" de DENTRO do lead
// (o que ele usa no dia a dia, aberto pelo ícone de calendário no topo da análise) só tinha campo
// de data: pra guardar "quinta que vem às 9h" era preciso agendar ali e depois ir na tela Agenda
// reabrir o compromisso pra pôr a hora (v1199). Agora data e hora ficam lado a lado nos dois
// lugares — e a hora continua opcional.

const app = fs.readFileSync(new URL('../app.js', import.meta.url), 'utf8');
const css = fs.readFileSync(new URL('../styles.css', import.meta.url), 'utf8');

const painel = app.slice(app.indexOf('function ui670ScheduleHtml'), app.indexOf('function ui670ScheduleHtml') + 2200);
assert.ok(painel.length > 100, 'o painel Agendar do lead precisa existir');

// 1. O campo de hora existe no painel do lead.
assert.match(painel, /type="time" id="ui670ScheduleHora"/, 'o painel do lead precisa ter campo de HORA');
assert.match(painel, /type="date" id="ui670ScheduleData"/, 'o campo de dia continua existindo');

// 2. Escolher o dia já leva a hora junto; preencher a hora depois também agenda.
assert.ok(painel.includes('onchange=\'reagendarLembrete(${id},this.value,${lerHora})\''),
  'escolher o dia precisa mandar a hora preenchida junto');
assert.ok(painel.includes('if(d) reagendarLembrete(${id},d,this.value)'),
  'preencher a hora depois do dia precisa reagendar com os dois');

// 3. Tem botão de confirmar (v1200: o dono não achava onde salvar) e ele cobra o dia.
assert.match(painel, /class="ui670-schedule-ok"/, 'precisa de um botão Confirmar visível');
assert.match(painel, /Escolha o dia primeiro/, 'confirmar sem dia precisa avisar em vez de falhar calado');

// 4. Os atalhos (Hoje/Amanhã/+7...) levam a hora preenchida.
assert.match(painel, /reagendarDias\(\$\{id\},\$\{n\},\$\{lerHora\}\)/, 'os atalhos precisam levar a hora junto');
assert.match(app, /function reagendarDias\(id, dias, horaStr\)/, 'reagendarDias precisa aceitar a hora');
assert.match(app, /reagendarLembrete\(id, s, horaStr\);/, 'o atalho precisa repassar a hora pro agendamento');

// 5. A hora é OPCIONAL — sem ela, agenda só o dia (regra de sempre, v1199).
assert.match(painel, /A hora é opcional/, 'a tela precisa dizer que a hora é opcional');
assert.match(app, /const horaValida = \/\^\(\[01\]\\d\|2\[0-3\]\):\(\[0-5\]\\d\)\$\/\.test\(String\(horaStr\|\|""\)\)/,
  'hora inválida ou vazia não pode quebrar o agendamento');

// 6. A linha nova tem estilo (senão os três controles empilham feio no celular).
assert.match(css, /\.ui670-schedule-row\{display:flex;flex-wrap:wrap/, 'data, hora e Confirmar dividem uma linha que quebra sozinha');

console.log('v1207-hora-no-agendar-do-lead: ok');
