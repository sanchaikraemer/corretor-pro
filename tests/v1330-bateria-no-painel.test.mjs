import fs from "node:fs";
import path from "node:path";
import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";
import { CASOS, montarPedidoDoJuiz, modeloJuiz } from "../evals/motor.mjs";

// v1330 — A RÉGUA DA ANÁLISE SAI DA LINHA DE COMANDO E VAI PRO BOTÃO DO PAINEL.
//
// A bateria de conversas existe desde a v1283 e virou porteiro na v1327: mudou o miolo da análise,
// a suíte fica vermelha até a bateria ser medida. Só que ela só rodava por linha de comando, com a
// chave da OpenAI na mão de quem tem terminal — ou seja, o DONO, que é quem decide se a análise
// melhorou ou piorou, não tinha como medir. Portão que o dono não abre é parede.
//
// Agora o mesmo motor roda pelo painel administrativo, com a chave que já está na hospedagem.

const raiz = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const ler = (f) => fs.readFileSync(path.join(raiz, f), "utf8");

// ── 1. As conversas chegam ao servidor por IMPORTAÇÃO, não por leitura de arquivo ─────────────
// Numa função da Vercel só vai pro ar o que o código importa; ler evals/conversas/*.json de dentro
// da função é justamente o jeito de descobrir isso quebrado em produção.
{
  assert.ok(CASOS.length >= 30, `a bateria precisa das conversas empacotadas — achei ${CASOS.length}`);
  const empacotado = ler("evals/casos-empacotados.mjs");
  assert.match(empacotado, /ARQUIVO GERADO/, "o empacotado precisa se identificar como gerado");
  const bateria = ler("evals/motor.mjs");
  assert.match(bateria, /import \{ CASOS_DA_BATERIA \} from "\.\/casos-empacotados\.mjs"/,
    "o motor importa as conversas; nunca lê a pasta evals em tempo de execução");
  assert.ok(!/readFileSync|readdirSync/.test(bateria), "o motor não pode depender de arquivo solto no servidor");
}

// ── 2. O empacotado não pode ficar velho ─────────────────────────────────────────────────────
{
  const pasta = path.join(raiz, "evals", "conversas");
  const arquivos = fs.readdirSync(pasta).filter(f => f.endsWith(".json")).sort();
  const daPasta = arquivos.map(f => JSON.parse(fs.readFileSync(path.join(pasta, f), "utf8")));
  assert.deepEqual(
    CASOS.map(c => c.id),
    daPasta.map(c => c.id),
    "evals/casos-empacotados.mjs está diferente de evals/conversas/. Rode: node evals/empacotar-casos.mjs"
  );
  assert.equal(JSON.stringify(CASOS), JSON.stringify(daPasta),
    "o conteúdo das conversas mudou e o empacotado não foi regerado. Rode: node evals/empacotar-casos.mjs");
}

// ── 3. O juiz continua julgando pela régua escrita, sem receber resposta pronta ───────────────
{
  const caso = CASOS[0];
  const pedido = montarPedidoDoJuiz(caso, {
    messages: { a: "Mensagem A", b: "Mensagem B", c: "Mensagem C" },
    diagnostico: { objecaoPrincipal: "Não identificado" },
    summary: "resumo qualquer",
    nextAction: "passo qualquer"
  });
  assert.match(pedido, /=== A RÉGUA ===/, "o juiz julga pela régua da conversa");
  assert.match(pedido, /na dúvida, marque como não cumprido/, "o juiz não pode ser generoso");
  assert.match(pedido, /Mensagem A/, "as três mensagens julgadas são as que o sistema escreveu");
  for (const item of (caso.esperado.aIaPrecisaPerceber || [])) {
    assert.ok(pedido.includes(item), "cada item da régua daquela conversa precisa chegar ao juiz");
  }
  assert.ok(modeloJuiz(), "precisa existir um modelo juiz configurado");
}

// ── 4. A rota é do administrador, roda em pedaços e tem tempo pra isso ───────────────────────
{
  const rota = ler("api/diagnostico.js");
  assert.match(rota, /mode === "bateria"/, "a rota precisa atender mode=bateria");
  assert.match(rota, /if \(!admin\) return json\(res, 403[\s\S]{0,200}Medir a qualidade da análise/,
    "medir gasta IA de verdade: exclusivo do administrador da plataforma");
  assert.match(rota, /MAX_CASOS_POR_CHAMADA = 3/, "cada chamada roda poucos casos — o resto é a tela que varre");
  assert.match(rota, /rodarCaso\(\{ openai, caso, organizationId, etapas \}\)/, "usa o mesmo motor da linha de comando");

  const vercel = JSON.parse(ler("vercel.json"));
  assert.equal(vercel.functions["api/diagnostico.js"].maxDuration, 300,
    "uma análise de verdade leva perto de um minuto: a rota da bateria precisa de tempo");
}

// ── 5. O botão existe no painel, avisa o custo e não mede sozinho ────────────────────────────
{
  const painel = ler("admin-plataforma.html");
  assert.match(painel, /id="areaBateria"/, "o cartão da bateria precisa existir no painel");
  assert.match(painel, /Qualidade da análise/, "com nome que o dono entenda");
  assert.match(painel, /onclick="rodarBateria\(\)"/, "e um botão que roda a medição");
  assert.match(painel, /Medir a qualidade da análise roda conversas de teste na IA de verdade/,
    "precisa avisar antes: isso gasta IA de verdade");
  assert.match(painel, /if \(!confirm\(aviso\)\) return;/, "e o aviso precisa ser uma pergunta que segura a rodada");
  assert.match(painel, /R\$ 3 a R\$ 5/, "e dizer quanto custa, em reais");
  assert.match(painel, /mode=bateria&de=\$\{de\}&quantos=2/, "a tela varre a bateria em pedaços");
  assert.ok(!/carregarBateria\(\);/.test(painel), "a bateria NÃO pode rodar sozinha ao abrir o painel — cada rodada é dinheiro");
}

// ── 6. A linha de comando e o painel usam o MESMO motor ──────────────────────────────────────
{
  const cli = ler("evals/executar.mjs");
  assert.match(cli, /from "\.\/motor\.mjs"/, "a linha de comando importa o motor único");
  assert.ok(!/async function julgar\(/.test(cli), "não pode existir um segundo juiz na linha de comando");
  assert.match(cli, /rodarCaso\(\{ openai, caso, cerebroConfig \}\)/, "e roda cada caso pelo motor");
}

console.log("v1330-bateria-no-painel: ok");
