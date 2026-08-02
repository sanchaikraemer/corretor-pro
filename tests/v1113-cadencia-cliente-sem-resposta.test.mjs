import fs from "node:fs";
import assert from "node:assert/strict";

// v1113 — cadência do cliente que NUNCA respondeu (ideia do dono, 02/08/2026): 10 retomadas em
// 6 meses a partir do 1º contato registrado (mês 1: 7/14/21 · mês 2: 35/50 · mês 3: 65/80 ·
// mês 4: 105 · mês 5: 135 · mês 6: 165 = encerramento). Depois das 10, o app SUGERE arquivar
// com a frase combinada. Resposta do cliente tira do filtro; toque só conta quando o corretor
// agiu (dias distintos); sugestão ignorada espera (nunca "queima").

const app = fs.readFileSync(new URL("../app.js", import.meta.url), "utf8");
const DIA = 86400000;

// Extrai as funções REAIS do app.js e roda com dependências de mentira controláveis.
const fonteConsts = app.match(/const CP_CADENCIA_OFFSETS_DIAS = \[[^\]]+\];[\s\S]*?const CP_CADENCIA_MSG_ARQUIVAR = "[^"]+";/)[0];
const fonteFn = app.match(/function cpCadenciaSemResposta\(l\)\{[\s\S]*?\n\}/)[0];
const fonteTipos = app.match(/const TIPOS_ATENDIMENTO_TIMELINE = new Set\(\[[^\]]+\]\);/)[0];
const { cpCadenciaSemResposta, CP_CADENCIA_OFFSETS_DIAS, CP_CADENCIA_MSG_ARQUIVAR } = eval(`
  const leadEhAtivo = (l) => l?.etapa !== "Geladeira";
  const mensagensDoCliente = (l) => Number(l?.clientMessageCount) || 0;
  ${fonteTipos}
  ${fonteConsts}
  ${fonteFn}
  ({ cpCadenciaSemResposta, CP_CADENCIA_OFFSETS_DIAS, CP_CADENCIA_MSG_ARQUIVAR });
`);

const agora = Date.now();
const evento = (diasAtras) => ({ evento: "contato_manual", quando: new Date(agora - diasAtras * DIA).toISOString() });
const leadCom = (eventosDiasAtras, extra = {}) => ({
  id: "x", name: "Cliente Silencioso", etapa: "Ativo", clientMessageCount: 0,
  analysis: { aprendizado: { eventos: eventosDiasAtras.map(evento) } }, ...extra
});

// ── 1. O calendário é exatamente o combinado: 3 no mês 1, 2 no mês 2, 2 no mês 3, 1+1+1 ──────
{
  assert.deepEqual(CP_CADENCIA_OFFSETS_DIAS, [7, 14, 21, 35, 50, 65, 80, 105, 135, 165],
    "as 10 retomadas nos dias combinados (encerramento no dia 165, dentro do 6º mês)");
  assert.equal(CP_CADENCIA_MSG_ARQUIVAR, "Arquive este lead: esgotaram as 10 tentativas em 6 meses sem retorno.",
    "a frase de arquivamento é a que o dono ditou");
}

// ── 2. Quem NÃO entra no filtro ───────────────────────────────────────────────────────────────
{
  assert.equal(cpCadenciaSemResposta(leadCom([2], { clientMessageCount: 3 })), null,
    "cliente que JÁ respondeu segue o fluxo normal de prioridades");
  assert.equal(cpCadenciaSemResposta(leadCom([])), null,
    "sem nenhum contato registrado, vale a regra normal de nunca atendido");
  assert.equal(cpCadenciaSemResposta(leadCom([2], { etapa: "Geladeira" })), null,
    "lead arquivado não entra na cadência");
}

// ── 3. A régua do tempo: 1º contato ancora, retomada vence no dia certo ───────────────────────
{
  const soContato = cpCadenciaSemResposta(leadCom([2]));
  assert.equal(soContato.ativo, true);
  assert.equal(soContato.feitas, 0, "o 1º contato não conta como retomada");
  assert.equal(soContato.devida, false, "2 dias depois do 1º contato, a retomada dos 7 dias ainda não venceu");

  const venceu = cpCadenciaSemResposta(leadCom([8]));
  assert.equal(venceu.devida, true, "8 dias depois do 1º contato, a retomada dos 7 dias está vencida");
  assert.equal(venceu.feitas, 0);

  // 1º contato há 16 dias + retomada feita há 9 → 1 feita; a dos 14 dias venceu de novo.
  const emDia = cpCadenciaSemResposta(leadCom([16, 9]));
  assert.equal(emDia.feitas, 1);
  assert.equal(emDia.devida, true, "16 dias do 1º contato e 9 do último toque: a 2ª retomada (14d) venceu");

  // Intervalo mínimo de 7 dias: corretor atrasado não recebe rajada (tocou ONTEM → espera).
  const rajada = cpCadenciaSemResposta(leadCom([40, 1]));
  assert.equal(rajada.feitas, 1);
  assert.equal(rajada.devida, false, "tocou ontem: a próxima só depois de 7 dias, mesmo com o calendário atrasado");
}

// ── 4. Toques no MESMO dia contam uma vez só ──────────────────────────────────────────────────
{
  const l = leadCom([10, 10, 10, 3]);
  const cad = cpCadenciaSemResposta(l);
  assert.equal(cad.feitas, 1, "3 cópias no mesmo dia = 1 toque (dias civis distintos)");
}

// ── 5. A 10ª é o encerramento; depois das 10, sugestão de arquivar ────────────────────────────
{
  const nonaFeita = cpCadenciaSemResposta(leadCom([170, 160, 150, 140, 130, 120, 110, 100, 90, 80]));
  assert.equal(nonaFeita.feitas, 9);
  assert.equal(nonaFeita.encerramento, true, "a próxima (10ª) é a mensagem de encerramento");
  assert.equal(nonaFeita.encerrar, false, "ainda não sugere arquivar — falta a última mensagem");

  const todasFeitas = cpCadenciaSemResposta(leadCom([200, 190, 180, 170, 160, 150, 140, 130, 120, 110, 100]));
  assert.equal(todasFeitas.encerrar, true, "10 retomadas feitas sem resposta → sugerir arquivamento");
  assert.equal(todasFeitas.feitas, 10);
}

// ── 6. Integração na tela (fila, linha da Home e detalhe do lead) ─────────────────────────────
{
  assert.match(app, /const cad = \(typeof cpCadenciaSemResposta === 'function'\) \? cpCadenciaSemResposta\(l\) : null;[\s\S]{0,300}?return cad\.encerrar \|\| cad\.devida;/,
    "a fila do dia usa a cadência no lugar dos sinais normais pra quem nunca respondeu");
  assert.match(app, /Retomada \$\{cad\.feitas\+1\} de \$\{cad\.total\}/, "a linha da Home mostra qual retomada é");
  assert.match(app, /cpCadenciaNoticeHTML\(lead\)/, "o detalhe do lead mostra o aviso da cadência");
  assert.match(app, /Arquivar este lead<\/button>/, "a sugestão de arquivar tem botão (nunca arquiva sozinho)");
}

console.log("v1113-cadencia-cliente-sem-resposta: ok");
