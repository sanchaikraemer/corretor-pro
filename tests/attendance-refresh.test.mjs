import fs from 'node:fs';
import assert from 'node:assert/strict';

const app = fs.readFileSync(new URL('../app.js', import.meta.url), 'utf8');
const api = fs.readFileSync(new URL('../api/reanalisar-lead.js', import.meta.url), 'utf8');
const persistence = fs.readFileSync(new URL('../api/_persistence.js', import.meta.url), 'utf8');

const markStart = app.indexOf('window.ui667MarcarAtendido=async function(btn)');
const markEnd = app.indexOf('// Atualização #724-2: wrapper antigo', markStart);
const mark = app.slice(markStart, markEnd);
assert.ok(mark.indexOf('renderLeadFoco(lead)') < mark.indexOf('recarregarLeadFoco(lead.id)'), 'tela deve atualizar antes do refetch');
assert.match(mark, /America\/Sao_Paulo/, 'fallback de data/hora precisa usar fuso de São Paulo');
assert.match(mark, /ui667AplicarAtendidoLocal\(item,quando,dataLocal,horaLocal\)/, 'listas em memória também precisam ser atualizadas');

const reloadStart = app.indexOf('async function recarregarLeadFoco(id)');
const reloadEnd = app.indexOf('window.recarregarLeadFoco = recarregarLeadFoco', reloadStart);
const reload = app.slice(reloadStart, reloadEnd);
assert.match(reload, /const mapa = new Map\(\)/, 'refetch deve mesclar eventos, não comparar apenas tamanho');
assert.match(reload, /if\(tLocal>tFresh\)/, 'refetch defasado não pode apagar atendimento local mais novo');

const apiStart = api.indexOf('if (body?.action === "marcar-atendido")');
const apiEnd = api.indexOf('// Reagendar', apiStart);
const apiBlock = api.slice(apiStart, apiEnd);
assert.doesNotMatch(apiBlock, /observacoes:/, 'atendimento não deve duplicar informação nas observações');
assert.match(apiBlock, /eventos\[indiceHoje\] = eventoAtual/, 'nova marcação no mesmo dia deve atualizar o horário anterior');
assert.doesNotMatch(apiBlock, /jaMarcado:\s*true/, 'API não pode devolver o horário antigo como se a nova marcação não existisse');
assert.doesNotMatch(mark, /Atendido\.\`|Atendido\."/, 'frontend não deve inserir observação redundante');
assert.match(app, /const last=cp705FormatDateTime\(lead\.lastInteractionAt/, 'Última mensagem deve usar a data real da timeline');
assert.doesNotMatch(app, /lastInteraction \|\| a\.reanalisadoEm/, 'data da análise não pode ser exibida como data da última mensagem');
assert.match(persistence, /source === "corretor-pro-manual"/, 'observação manual não pode substituir a data da última mensagem real');
assert.match(persistence, /"observacao_manual"/, 'tipo de observação manual deve ser excluído da última mensagem real');
assert.doesNotMatch(app, /function registrarMensagemEnviada/, 'copiar sugestão não pode registrar atendimento automaticamente');
const copyStart = app.indexOf('window.ui631CopyResponse = async function()', app.indexOf('#683 FECHAMENTO'));
const copyEnd = app.indexOf('async function ui683MoverEtapaComEvento', copyStart);
const copyBlock = app.slice(copyStart, copyEnd);
assert.doesNotMatch(copyBlock, /contato_manual|novoAtendimento|registrarMensagemEnviada/, 'botão copiar não pode alterar atendimento, timeline ou status');

console.log('attendance-refresh: ok');
