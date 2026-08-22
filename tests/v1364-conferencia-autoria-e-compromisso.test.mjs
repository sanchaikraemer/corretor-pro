import assert from "node:assert/strict";
import { compromissoDaConversa, avisosDeQualidadeDasMensagens } from "../api/_pipeline.js";

// v1364 — A CONFERÊNCIA DAS TRÊS MENSAGENS APRENDE O COMPROMISSO.
//
// Três defeitos do caso Vande que a conferência não enxergava:
//   1. mensagem atribuindo AO CLIENTE o adiamento que foi do corretor;
//   2. mensagem que ignora o compromisso pendente (não conduz pra marcar nada);
//   3. mensagem tratando como desinteresse um cancelamento que foi só de agenda.
// E um quarto ponto no sentido contrário: quando o compromisso está pendente, as três CONVERGIREM
// na visita é o comportamento certo — a conferência não pode carimbar isso de "pede a mesma coisa".

const C = "Ana Corretora";
const lead = { clientName: "Vande" };
const AGORA = new Date(2026, 7, 22, 10, 0);
const m = (author, date, text) => ({ author, date, text });

const TIMELINE = [
  m(C, "20/08/2026", "Temos um apartamento com 2 dormitórios por R$ 430.000. Quer agendar uma visita?"),
  m("Vande", "20/08/2026", "Podemos agendar para amanhã à tarde?"),
  m(C, "20/08/2026", "As 14h fica bom para o Sr?"),
  m(C, "21/08/2026", "Se quiser deixar para semana que vem com calma, posso atendê-lo qualquer dia"),
  m("Vande", "21/08/2026", "Bom dia fica melhor, estou em visita ao cliente e não vou chegar a tempo.")
];
const compromisso = compromissoDaConversa(TIMELINE, C, lead, AGORA);
assert.ok(compromisso && compromisso.continuaValido && compromisso.pendencia, "o cenário tem compromisso pendente");
const contexto = {
  // Com o AUTOR na linha, igual o texto que o app monta de verdade — senão a conferência antiga
  // de "cita nome que não aparece nesta conversa" acusa o próprio nome do cliente do cenário.
  conversa: TIMELINE.map(x => `[${x.date}] ${x.author}: ${x.text}`).join("\n"),
  cerebro: "",
  compromisso
};

// ── 1. Autoria trocada: "como você pediu, deixamos para semana que vem" ──────────────────────
{
  const avisos = avisosDeQualidadeDasMensagens(
    [{ qual: "a", texto: "Bom dia, Vande! Como você pediu, deixamos a visita para semana que vem. Posso te receber segunda às 10h?" }],
    contexto
  );
  assert.ok(avisos.some(a => a.motivos.some(mo => mo.includes("atribui ao cliente o adiamento"))),
    "atribuir ao cliente o adiamento do corretor precisa gerar aviso");
}

// ── 2. v1366 — A RÉGUA "NÃO CONDUZ PARA O COMPROMISSO PENDENTE" FOI APAGADA POR ORDEM DO DONO ─
//
// Print de 22/08/2026 (cliente Pâmela): as TRÊS sugestões saíram com tarja vermelha dizendo
// "não conduz para o compromisso pendente (visita ainda sem dia e horário)" — sendo que as três
// respondiam o que a cliente tinha acabado de perguntar (outro edifício, sem piscina). Atender o
// pedido do cliente é a coisa certa; a régua reprovava mensagem boa. Ordem: "apagar".
//
// Este teste agora garante o CONTRÁRIO: com visita pendente de data, uma mensagem que trata de
// outro assunto NÃO pode ganhar aviso nenhum por isso.
{
  const avisos = avisosDeQualidadeDasMensagens(
    [{ qual: "b", texto: "Bom dia, Vande! Você pretende usar financiamento ou recursos próprios na compra?" }],
    contexto
  );
  assert.ok(!avisos.some(a => a.motivos.some(mo => /conduz para o compromisso/i.test(mo))),
    "a régua apagada na v1366 não pode voltar: mensagem sobre outro assunto não é defeito");
}
{
  const avisos = avisosDeQualidadeDasMensagens(
    [{ qual: "b", texto: "Bom dia, Vande! Segue o material que fiquei de te enviar, dá uma olhada." }],
    contexto
  );
  assert.ok(!avisos.some(a => a.motivos.some(mo => /conduz para o compromisso/i.test(mo))),
    "entregar o que foi prometido nunca foi defeito");
}
// E a régua não pode voltar disfarçada em outro texto. Este é o formato exato do print da
// Pâmela — as três respondendo o que o cliente perguntou sobre OUTRO assunto, com a visita ainda
// pendente de data. Nenhuma pode sair com tarja vermelha. (Nome do cliente do cenário, senão a
// conferência de "cita nome de outra conversa" — que é legítima e antiga — dispara sozinha.)
{
  const avisos = avisosDeQualidadeDasMensagens([
    { qual: "a", texto: "Bom dia, Vande! Sobre outro edifício, tem algo específico que você quer evitar?" },
    { qual: "b", texto: "Bom dia, Vande! Você prefere um condomínio sem piscina ou com o mínimo possível de área comum?" },
    { qual: "c", texto: "Bom dia, Vande! Eu vou separar somente opções de outros edifícios com estrutura comum mais simples." }
  ], contexto);
  assert.equal(avisos.length, 0,
    `as três mensagens no formato do print da Pâmela respondem o que o cliente perguntou — nenhuma pode sair com tarja vermelha. Vieram: ${JSON.stringify(avisos)}`);
}

// ── 3. Desinteresse inventado em cima de agenda ──────────────────────────────────────────────
{
  const avisos = avisosDeQualidadeDasMensagens(
    [{ qual: "c", texto: "Bom dia, Vande! Se você ainda tem interesse no apartamento, posso te mandar mais informações." }],
    contexto
  );
  assert.ok(avisos.some(a => a.motivos.some(mo => mo.includes("cancelamento que foi só de agenda"))),
    "requalificar interesse depois de cancelamento de agenda precisa gerar aviso");
}

// ── 4. Convergir na visita NÃO é defeito quando o compromisso está pendente ──────────────────
{
  const avisos = avisosDeQualidadeDasMensagens(
    [
      { qual: "a", texto: "Bom dia, Vande! Como de manhã fica melhor, consigo te receber na visita amanhã às 10h. Funciona pra você?" },
      { qual: "b", texto: "Bom dia, Vande! Vamos deixar a visita organizada: tenho amanhã às 9h ou às 10h. Qual horário fica melhor na visita?" },
      { qual: "c", texto: "Bom dia, Vande! Conforme combinamos, vamos organizar nossa visita essa semana. Quer que eu reserve a manhã de terça pra sua visita?" }
    ],
    contexto
  );
  assert.ok(!avisos.some(a => a.motivos.some(mo => mo.includes("pede a mesma coisa"))),
    "as três convergindo na visita pendente não podem ganhar tarja de repetição");
  assert.ok(!avisos.some(a => a.motivos.some(mo => mo.includes("não conduz para o compromisso"))),
    "as três conduzem para o compromisso — nenhum aviso");
}

// ── 5. Sem compromisso no contexto, nada disso dispara (conversa comum segue como era) ───────
{
  const avisos = avisosDeQualidadeDasMensagens(
    [{ qual: "a", texto: "Boa tarde, Maria! Você prefere apartamento pronto ou na planta?" }],
    { conversa: "Oi\nOlá, tudo bem?", cerebro: "" }
  );
  assert.ok(!avisos.some(a => a.motivos.some(mo => /compromisso|adiamento|agenda/.test(mo))),
    "sem compromisso reconstruído, as checagens novas ficam quietas");
}

console.log("v1364-conferencia-autoria-e-compromisso: ok (autoria, condução, agenda ≠ desinteresse, convergência liberada)");
