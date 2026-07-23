import fs from 'node:fs';
import assert from 'node:assert/strict';

const app = fs.readFileSync(new URL('../app.js', import.meta.url), 'utf8');
const api = fs.readFileSync(new URL('../api/reanalisar-lead.js', import.meta.url), 'utf8');
const persistence = fs.readFileSync(new URL('../api/_persistence.js', import.meta.url), 'utf8');
const pipeline = fs.readFileSync(new URL('../api/_pipeline.js', import.meta.url), 'utf8');

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
// v887 tinha uma metalinha "Última mensagem" no cabeçalho do lead que puxava a hora da própria
// última mensagem real (mesma do histórico), pra não divergir por fuso; a v934 removeu essa
// metalinha do cabeçalho (pedido do dono: só "Última análise" ali). cp786UltimaMensagemReal
// continua existindo/usada em outros lugares (histórico, análise) — só a exibição no cabeçalho
// do lead que saiu.
assert.doesNotMatch(app, /lastInteraction \|\| a\.reanalisadoEm/, 'data da análise não pode ser exibida como data da última mensagem');
assert.match(persistence, /source === "corretor-pro-manual"/, 'observação manual não pode substituir a data da última mensagem real');
assert.match(persistence, /"observacao_manual"/, 'tipo de observação manual deve ser excluído da última mensagem real');
// v826 §6.2/§6.5: copiar uma sugestão AGORA registra atendimento e entra na timeline
// como "Mensagem enviada" — mas nunca altera a etapa comercial (reverte a decisão v809,
// conforme aprovação do corretor).
assert.match(app, /async function registrarMensagemEnviada\(id, msg\)/, 'copiar sugestão deve registrar atendimento + mensagem enviada');
const envStart = app.indexOf('async function registrarMensagemEnviada(id, msg)');
const envEnd = app.indexOf('window.copiarMensagemLead = function', envStart);
const envBlock = app.slice(envStart, envEnd);
assert.match(envBlock, /tipoManual:"mensagem_enviada"/, 'entra na timeline como mensagem enviada');
assert.match(envBlock, /registrarAtendimento:true/, 'conta como atendimento');
assert.doesNotMatch(envBlock, /etapa/, 'copiar nunca altera a etapa comercial');
assert.match(app, /done = \(\) => \{ toast\("Mensagem copiada"\);[\s\S]*?registrarMensagemEnviada\(l\.id, msg\)/, 'o botão Copiar do hero chama o registro');
assert.match(app, /cp704CopyMsg=async function[\s\S]*?registrarMensagemEnviada\(state\.lead\?\.id, msg\)/, 'o botão Copiar do detalhe chama o registro');
// Backend: copiar registra o evento de atendimento (contato_manual), sem tocar na etapa.
assert.match(api, /body\?\.registrarAtendimento === true/, 'backend registra atendimento ao copiar');
assert.match(api, /de: "copiar_msg"/, 'evento de atendimento marcado como cópia de mensagem');
const apenasSalvarBlock = api.slice(api.indexOf('if (apenasSalvar) {'), api.indexOf('// ORDEM CORRETA'));
assert.doesNotMatch(apenasSalvarBlock, /update\.etapa|\.etapa =/, 'copiar nunca altera a etapa comercial no backend');
// A mensagem copiada é sugestão da IA: não pode virar fonte de aprendizado de estilo.
assert.match(pipeline, /if \(tipo === "mensagem_enviada"\) return false/, 'mensagem enviada não alimenta o aprendizado de estilo');

console.log('attendance-refresh: ok');
