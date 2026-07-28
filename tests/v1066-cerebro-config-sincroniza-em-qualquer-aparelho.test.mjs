import fs from 'node:fs';
import assert from 'node:assert/strict';

const app = fs.readFileSync(new URL('../app.js', import.meta.url), 'utf8');

// v1066 — o dono mandou prints mostrando o computador e o celular escolhendo um lead DIFERENTE
// como prioridade #1 do dia, com os MESMOS números agregados (225 leads, 96 aguardando cliente,
// 1 vaga no "Fazer agora"): no PC aparecia um lead atendido há só 6 dias (Adão), no celular só
// apareciam leads muito mais parados (Silvana, há 18 dias). Já tinha pedido pra dar Ctrl+Shift+R
// e fechar/abrir o navegador — não resolveu, porque a causa não é cache de rede.
//
// Causa real: "dias de descanso" e "meta por dia" (usados por cpFilaFazerAgora pra decidir quem
// já pode voltar à fila) são lidos de uma cópia salva SÓ NAQUELE APARELHO (localStorage,
// obterCerebroConfigParaAnalise) — e essa cópia só era atualizada quando o corretor abria a tela
// "Cérebro" NAQUELE MESMO aparelho (carregarCerebro, chamada só por carregarTelaAtiva quando
// t === "cerebro"). Um aparelho onde ele nunca abriu essa tela ficava preso no valor padrão,
// mesmo já tendo ajustado esse número há tempos em outro aparelho.

{
  assert.match(app, /async function cp7SincronizarCerebroConfigInicial\(\)\{/,
    'precisa existir uma função que sincroniza a configuração do Cérebro assim que o app abre');
  assert.match(app, /cp7SincronizarCerebroConfigInicial\(\);/,
    'a sincronização precisa ser disparada na hora, sem esperar o corretor abrir a tela Cérebro');

  const fnMatch = app.match(/async function cp7SincronizarCerebroConfigInicial\(\)\{[\s\S]*?\n\}/);
  assert.ok(fnMatch, 'cp7SincronizarCerebroConfigInicial não encontrada por inteiro');
  const src = fnMatch[0];

  assert.match(src, /fetch\("\.\/api\/cerebro-config"/, 'precisa buscar a configuração de verdade no servidor');
  assert.match(src, /localStorage\.setItem\(CEREBRO_LS_KEY,/, 'precisa gravar a configuração fresca na cópia local desse aparelho');
  assert.match(src, /refreshAllSections\(\)/, 'precisa atualizar a Home na hora se a regra da fila mudou');

  // Teste funcional: simula um aparelho com valor VELHO/inexistente no localStorage e confirma que,
  // depois da sincronização, o valor salvo no servidor passa a valer e a Home é recarregada.
  const chamadas = { setItem: [], refresh: 0 };
  const armazenamentoFake = {
    _dados: {},
    getItem(k){ return Object.prototype.hasOwnProperty.call(this._dados, k) ? this._dados[k] : null; },
    setItem(k, v){ chamadas.setItem.push([k, v]); this._dados[k] = v; }
  };
  const CEREBRO_LS_KEY = "direciona-cerebro-config";
  const sanitizeCerebroConfigV762 = (c) => c; // identidade — só precisamos confirmar o encadeamento
  const fetch = async () => ({ json: async () => ({ ok: true, config: { diasDescansoPosAtendimento: 15, atendimentosPorDia: 10 } }) });
  const refreshAllSections = () => { chamadas.refresh++; };
  const localStorage = armazenamentoFake;

  const rodar = new Function(
    'CEREBRO_LS_KEY', 'sanitizeCerebroConfigV762', 'fetch', 'refreshAllSections', 'localStorage',
    `${src}\nreturn cp7SincronizarCerebroConfigInicial();`
  );
  await rodar(CEREBRO_LS_KEY, sanitizeCerebroConfigV762, fetch, refreshAllSections, localStorage);

  assert.equal(chamadas.setItem.length, 1, 'precisa gravar a configuração uma vez');
  assert.deepEqual(JSON.parse(chamadas.setItem[0][1]), { diasDescansoPosAtendimento: 15, atendimentosPorDia: 10 },
    'o que é gravado precisa ser exatamente o que veio do servidor');
  assert.equal(chamadas.refresh, 1,
    'sem valor anterior (aparelho novo/nunca abriu o Cérebro), precisa recarregar a Home com a regra certa');

  console.log('v1066 (sincronização Cérebro): aparelho que nunca abriu a tela Cérebro pega a regra certa mesmo assim — ok');
}

console.log('v1066-cerebro-config-sincroniza-em-qualquer-aparelho: ok');
