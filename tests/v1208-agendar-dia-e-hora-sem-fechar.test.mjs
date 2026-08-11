import fs from 'node:fs';
import assert from 'node:assert/strict';

// v1208 — "não estou conseguindo agendar a hora, porra... boto ali o dia, e daí quando eu vou
// tentar selecionar a hora fecha. Sem falar que está feio, nem parece um app desse nível."
//
// Dois defeitos somados:
//  1. escolher o dia SALVAVA na hora (onchange), e salvar redesenha a tela — o painel fechava
//     antes de ele chegar no campo de hora. Marcar dia E hora na mesma ida era impossível;
//  2. os campos nativos de data/hora herdavam esquema de cor CLARO: texto guia e ícones escuros
//     sobre fundo escuro = duas caixas vazias no print.
//
// Agora existe UM painel só (lead e Agenda), nada salva antes do "Confirmar agendamento", e os
// campos têm color-scheme escuro, altura de dedo e fonte de 16px.

const app = fs.readFileSync(new URL('../app.js', import.meta.url), 'utf8');
const css = fs.readFileSync(new URL('../styles.css', import.meta.url), 'utf8');

// --- 1. NADA salva sozinho: o único caminho até reagendarLembrete é o Confirmar. -------------
const ini = app.indexOf('function cpAgendarPainelHTML');
assert.ok(ini > 0, 'o painel único de agendamento precisa existir');
const painel = app.slice(ini, app.indexOf('window.cpAgendarPainelHTML'));

const inline = [...painel.matchAll(/on(?:click|change)='([^']*)'/g)].map(m => m[1]);
assert.ok(inline.length >= 4, 'esperava os atalhos, os dois campos e o botão de confirmar');
for(const codigo of inline){
  assert.ok(!/reagendarLembrete|reagendarDias/.test(codigo),
    `nenhum campo/atalho do painel pode salvar sozinho (fecha o painel no meio): ${codigo}`);
}
assert.match(painel, /cpAgendarConfirmar\(\$\{p\},\$\{idJs\}\)/, 'só o botão Confirmar salva');
const confirmar = app.slice(app.indexOf('function cpAgendarConfirmar'), app.indexOf('window.cpAgendarEscolherDia'));
assert.match(confirmar, /reagendarLembrete\(id, data, c\.hora\?\.value \|\| ""\)/, 'o Confirmar precisa mandar dia e hora juntos');
assert.match(confirmar, /Escolha o dia primeiro/, 'confirmar sem dia avisa em vez de falhar calado');

// --- 2. Dia e hora: campos + atalhos dos dois lados. -----------------------------------------
assert.match(painel, /type="date" class="cp1208-campo" id="\$\{pref\}Data"/, 'campo de dia');
assert.match(painel, /type="time" class="cp1208-campo" id="\$\{pref\}Hora"/, 'campo de hora');
assert.match(app, /const CP1208_HORAS_RAPIDAS = \["08:00","09:00","10:00","14:00","16:00","18:00"\]/, 'atalhos de hora');
assert.match(app, /const CP1208_DIAS_RAPIDOS = \[\["Hoje",0\],\["Amanhã",1\],\["\+7d",7\],\["\+15d",15\],\["\+30d",30\]\]/, 'atalhos de dia, com rótulo curto pra caber numa linha só no celular');
assert.match(painel, /Sem hora</, 'precisa dar pra desmarcar a hora num toque');
assert.match(painel, /cpAgendarEscolherDia\(\$\{p\},\$\{n\},this\)/, 'o atalho de dia só preenche o campo');
assert.match(painel, /cpAgendarEscolherHora\(\$\{p\},"\$\{h\}",this\)/, 'o atalho de hora só preenche o campo');

// --- 3. O painel é o MESMO nas duas telas (lead e cartão da Agenda). -------------------------
const doLead = app.slice(app.indexOf('function ui670ScheduleHtml'), app.indexOf('window.ui670ScheduleHtml'));
assert.match(doLead, /cpAgendarPainelHTML\(String\(lead\.id\), "ui670Schedule", atual\)/, 'o lead usa o painel único');
const daAgenda = app.slice(app.indexOf('function reagendarControlHTML'), app.indexOf('window.reagendarControlHTML'));
assert.match(daAgenda, /cpAgendarPainelHTML\(id, "reag_"\+id, atual\)/, 'a Agenda usa o mesmo painel');
assert.ok(!/reagHora_/.test(app), 'o painel antigo da Agenda (ids reagHora_) precisa sair junto');

// --- 4. Pré-preenche o que já está marcado (em vez de dois campos vazios). -------------------
assert.match(app, /function cpAgendarDataDoLembrete\(quando\)/, 'precisa saber a data do compromisso já marcado');
assert.match(app, /timeZone:"America\/Sao_Paulo"/, 'a data pré-preenchida tem que ser a do fuso do Brasil');
assert.match(doLead, /hora: lem\?\.hora \|\| ""/, 'o lead pré-preenche a hora já marcada');
assert.match(daAgenda, /hora: lembrete\?\.hora \|\| ""/, 'a Agenda pré-preenche a hora já marcada');

// --- 5. Tudo que os atributos inline chamam existe em window (lição da v1202). ---------------
for(const nome of ['cpAgendarEscolherDia','cpAgendarEscolherHora','cpAgendarResumo','cpAgendarConfirmar']){
  assert.ok(app.includes(`window.${nome} = ${nome};`), `${nome} precisa estar em window (é chamado de atributo inline)`);
}

// --- 6. O visual: campo legível no escuro, alvo de dedo e sem zoom automático. ---------------
assert.match(css, /\.cp1208-agendar \.cp1208-campo\{color-scheme:dark;/, 'sem color-scheme escuro o campo fica invisível no celular do dono');
assert.match(css, /\.cp1208-agendar \.cp1208-campo\{[^}]*font-size:16px/, 'menos de 16px faz o celular dar zoom sozinho ao tocar');
assert.match(css, /\.cp1208-agendar \.cp1208-campo\{[^}]*min-height:48px/, 'o campo precisa ser alvo de dedo');
assert.match(css, /\.cp1208-agendar \.cp1208-ok\{[^}]*width:100%/, 'o botão de confirmar é a ação principal — largura toda');
assert.match(css, /\.cp1208-agendar \.cp1208-chip\.ativo\{/, 'o atalho escolhido precisa ficar marcado');

// --- 7. Frase de conferência antes de salvar. ------------------------------------------------
const resumo = app.slice(app.indexOf('function cpAgendarResumoTexto'), app.indexOf('function cpAgendarResumo('));
assert.match(resumo, /Vai agendar: \$\{quando\}, às \$\{hora\}/, 'com hora, a frase mostra dia e hora');
assert.match(resumo, /sem hora marcada/, 'sem hora, a frase deixa claro que só o dia foi marcado');

console.log('v1208-agendar-dia-e-hora-sem-fechar: ok');
