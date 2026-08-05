import fs from 'node:fs';
import assert from 'node:assert/strict';

const app = fs.readFileSync(new URL('../app.js', import.meta.url), 'utf8');

// v1097 — o dono, com dois prints: copiou a sugestão (a opção ficou marcada em coral), mas o
// ATENDIMENTO não foi marcado. E a frase que importa: "isso está sendo corriqueiro, só marca às
// vezes na segunda vez que copia".
//
// Causa: copiar disparava DUAS gravações EM SEQUÊNCIA, e a do atendimento era a SEGUNDA. Copiar
// é justamente o momento em que o corretor sai do app pra colar no WhatsApp — e o celular corta
// os pedidos de rede de um app em segundo plano. A primeira gravação (a contagem do Desempenho,
// o detalhe menos importante) consumia a janela segura; a que importa saía tarde e morria.
// Copiando de novo, já olhando pra tela, funcionava — daí a intermitência.

function extrair(re, oQue) {
  const m = app.match(re);
  assert.ok(m, `não localizei ${oQue}`);
  return m[0];
}

const copiar = extrair(/window\.cp704CopyMsg=async function\(k\)\{[\s\S]*?\n  \};/, 'cp704CopyMsg');

// ── 1. O atendimento vai PRIMEIRO ─────────────────────────────────────────────────────────────
{
  const posAtendimento = copiar.indexOf('registrarMensagemEnviada');
  const posContagem = copiar.indexOf('"aprendizado"');
  assert.ok(posAtendimento !== -1, 'o registro de atendimento precisa continuar existindo ao copiar');
  assert.ok(posContagem !== -1, 'a contagem do Desempenho precisa continuar existindo');
  assert.ok(posAtendimento < posContagem,
    'o ATENDIMENTO precisa ser gravado ANTES da contagem — se só uma sobreviver, que seja a que importa');
}

// ── 2. As duas gravações sobrevivem ao app ir pro segundo plano ───────────────────────────────
{
  assert.match(copiar, /keepalive:\s*true/,
    'a gravação feita ao copiar precisa de keepalive — senão o celular a corta quando o corretor vai pro WhatsApp');

  const registrar = extrair(/const registrarAtendimentoDaCopia = \(\) =>[\s\S]*?\}\);/, 'registrarAtendimentoDaCopia');
  assert.match(registrar, /keepalive:\s*true/,
    'o pedido que grava o atendimento precisa de keepalive — é O pedido que estava se perdendo');
  assert.match(registrar, /registrarAtendimento:true/, 'e precisa continuar pedindo o registro do atendimento');
}

// ── 3. O atendimento é esperado antes de seguir (as duas gravam no MESMO campo) ────────────────
{
  assert.match(copiar, /await registrarMensagemEnviada\(/,
    'o atendimento precisa ser esperado: as duas gravações leem-e-escrevem o mesmo campo do cliente, ' +
    'e em paralelo uma apagaria a outra');
}

// ── 4. A gravação do atendimento continua tentando de novo e avisando se não conseguir ────────
// v1142 — as duas tentativas escritas na mão viraram um laço de 3, com 30s cada (igual ao botão
// "Marcar atendimento"), e o aviso de falha ficou mais direto porque agora ele vem junto com a
// marca local sendo DESFEITA: a tela não mostra mais "Atendido" quando o banco não recebeu.
{
  const fn = extrair(/async function registrarMensagemEnviada\(id, msg\)\{[\s\S]*?\n\}/, 'registrarMensagemEnviada');
  assert.match(fn, /tentativa<=3 && !atendimentoConfirmado/, 'precisa tentar 3 vezes antes de desistir');
  assert.match(fn, /NÃO consegui registrar o atendimento/,
    'se nem assim gravar, o corretor precisa ser avisado — nunca ficar achando que marcou');
}

// ── 5. Dia sem fila: a Home precisa dizer que a regra é DELE e onde mudar ─────────────────────
// O dono viu "Fazer agora: 0" num sábado e perguntou "por que isso? porque é sábado?". Era a
// configuração dele (segunda a sexta), mas a frase que ele viu não dizia isso nem onde mudar —
// a dica só existia na outra versão da mensagem.
{
  const bloco = extrair(/html = tratadosHoje > 0[\s\S]*?Dá pra mudar seus dias no Cérebro\.`;/, 'a saudação de dia sem fila');
  const avisos = (bloco.match(/Hoje você não atende\./g) || []).length;
  const dicas = (bloco.match(/Dá pra mudar seus dias no Cérebro/g) || []).length;
  assert.equal(avisos, 2, 'as duas versões da frase precisam existir (com e sem atendimento no dia)');
  assert.equal(dicas, avisos,
    'TODA versão da frase precisa dizer onde mudar os dias — senão o corretor acha que é defeito do app');
}

console.log('v1097-copiar-marca-atendimento: ok');
