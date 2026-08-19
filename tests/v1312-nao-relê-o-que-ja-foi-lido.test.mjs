import fs from 'node:fs';
import assert from 'node:assert/strict';
import { leiturasDeLinksDoLeadAnterior, leiturasVisuaisDoLeadAnterior } from '../api/processar-storage.js';

// v1312 — "demorando demais pra analisar, sendo que já tem histórico de monte e acho que nada de
// novo" (dono, 19/08/2026).
//
// Ele está certo, e a conta é grande. O áudio já transcrito deste cliente é reaproveitado desde a
// v1141 — mas a IMAGEM e o PDF (v1306) e o LINK (v1307) eram lidos DE NOVO, do zero, em toda
// importação: até 22 segundos de leitura de imagem mais 20 de leitura de link, repetidos numa
// reimportação que não trouxe uma única mensagem nova. E cada uma dessas leituras é uma chamada
// paga à IA, gasta pra produzir exatamente o texto que já estava salvo na conversa do cliente.

const raiz = new URL('../', import.meta.url);
const rota = fs.readFileSync(new URL('api/processar-storage.js', raiz), 'utf8');

// ── 1. A leitura antiga é encontrada na conversa salva (executado) ───────────────────────────
{
  const timelineSalva = [
    { source: 'visual', mediaFile: 'IMG-20260121-WA0001.jpg', text: '[Imagem lida pela IA] Mapa do Ed. Evolutti · centro, próximo à avenida Pátria' },
    { source: 'visual', mediaFile: 'TABELA-EVOLUTTI.pdf', text: '[Documento lido pela IA] Tabela de agosto · 2 dormitórios a partir de R$ 670.000' },
    { source: 'audio', mediaFile: 'PTT-20260121-WA0002.opus', text: '[Áudio transcrito] bom dia Noemi' },
    { source: 'txt', text: 'mensagem comum, sem leitura nenhuma' },
    { source: 'visual', mediaFile: 'SEM-TEXTO.jpg', text: '[Imagem lida pela IA]   ' }
  ];
  const visuais = leiturasVisuaisDoLeadAnterior(timelineSalva);
  assert.equal(visuais['IMG-20260121-WA0001.jpg']?.text, 'Mapa do Ed. Evolutti · centro, próximo à avenida Pátria');
  assert.equal(visuais['TABELA-EVOLUTTI.pdf']?.status, 'lido', 'PDF também conta');
  assert.ok(!visuais['PTT-20260121-WA0002.opus'], 'áudio tem o caminho dele próprio, não entra aqui');
  assert.ok(!visuais['SEM-TEXTO.jpg'], 'leitura vazia não vale como já lida — ela precisa ser refeita');

  const links = leiturasDeLinksDoLeadAnterior([
    { linkLido: 'https://maps.app.goo.gl/abc', text: 'segue o mapa\n[Link lido pela IA] Localização do empreendimento no centro' },
    { linkLido: 'https://vazio.com', text: 'olha aqui\n[Link lido pela IA]    ' },
    { text: 'mensagem sem link' }
  ]);
  assert.equal(links['https://maps.app.goo.gl/abc']?.text, 'Localização do empreendimento no centro');
  assert.ok(!links['https://vazio.com'], 'link sem texto guardado precisa ser lido de novo');

  assert.deepEqual(leiturasVisuaisDoLeadAnterior(null), {}, 'conversa vazia não quebra nada');
  assert.deepEqual(leiturasDeLinksDoLeadAnterior(undefined), {});
}

// ── 2. E é usada ANTES de gastar tempo e dinheiro relendo ────────────────────────────────────
{
  assert.match(rota, /const cacheVisualDoLead = matchAnterior\?\.row \? leiturasVisuaisDoLeadAnterior\(matchAnterior\.row\.timeline_json\) : \{\};/,
    'a leitura salva do cliente precisa ser buscada junto com a transcrição de áudio');
  assert.match(rota, /const cacheLinksDoLead = matchAnterior\?\.row \? leiturasDeLinksDoLeadAnterior\(matchAnterior\.row\.timeline_json\) : \{\};/,
    'idem para os links');
  assert.match(rota, /cacheDoLead, cacheVisualDoLead, cacheLinksDoLead, organizationId/,
    'e precisa chegar em quem prepara a importação');

  const preparo = rota.slice(rota.indexOf('export async function prepararExtracaoPersistente('), rota.indexOf('const audioStorage = {}'));
  assert.match(preparo, /candidatos = candidatos\.filter\(\(\{ name \}\) => \{/,
    'o arquivo já lido não pode nem virar candidato — senão desce pra IA de novo');
  assert.match(preparo, /visuaisReaproveitados\+\+/, 'e o reaproveitamento é contado');
  assert.match(preparo, /const links = todosOsLinks\.filter\(\(url\) => \{/, 'mesma coisa nos links');
  assert.match(preparo, /linksReaproveitados\+\+/);
  assert.match(preparo, /reaproveitado: true/, 'a leitura que veio pronta fica marcada como tal');
  // A leitura reaproveitada NÃO pode contar no teto do dia: ela não gastou chamada nenhuma.
  const trechoConsumo = preparo.slice(preparo.indexOf('const { leituras } = await lerArquivosVisuais'), preparo.indexOf('} catch (erroVisual)'));
  assert.match(trechoConsumo, /Object\.values\(leituras \|\| \{\}\)\.filter\(l => l\?\.status === "lido"\)\.length/,
    'só o que foi lido AGORA conta no teto do dia');
}

console.log('v1312-nao-relê-o-que-ja-foi-lido: ok');
