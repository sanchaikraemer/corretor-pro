import fs from 'node:fs';
import assert from 'node:assert/strict';
import {
  TENTATIVAS_ENVIO,
  PARADA_MAXIMA_MS,
  classificarFalhaEnvio,
  enviarComRetentativa,
  mensagemDesistencia,
  passouDoTempoParado
} from '../js/envio-retentativa.js';

// v1217 — print do dono, 11/08/2026: ZIP de 54 MB, celular no 4G, barra em 100% e "Falha de
// conexão durante o envio. Verifique a internet e tente novamente." A importação desistia na
// PRIMEIRA queda de conexão; o "Tentar novamente" recomeçava tudo do zero, inclusive o preparo
// do ZIP no aparelho. Este teste EXECUTA a regra de repetição (não confere por leitura).

// ── 1. Uma queda de conexão no meio não pode matar a importação ──────────────────────────────
{
  const urlsPedidas = [];
  const esperas = [];
  let tentativa = 0;
  const preparo = await enviarComRetentativa({
    totalMb: 54,
    pedirUrl: (n) => { urlsPedidas.push(n); return { meta:{ bucket:'zips' }, signedUrl:`url-${n}` }; },
    enviar: (p) => {
      tentativa++;
      if (tentativa < 3) throw classificarFalhaEnvio({ tipo:'rede', totalMb:54, enviadoMb:31.2 });
      return p;
    },
    esperar: async (ms) => { esperas.push(ms); }
  });
  assert.equal(tentativa, 3, 'precisa tentar de novo sozinho até conseguir');
  assert.equal(preparo.signedUrl, 'url-3', 'devolve o preparo da tentativa que deu certo');
  assert.deepEqual(urlsPedidas, [1, 2, 3], 'cada tentativa pede uma URL de envio NOVA (a anterior pode ter expirado)');
  assert.deepEqual(esperas, [3000, 6000], 'espera um pouco mais a cada queda, em vez de martelar o servidor');
}

// ── 2. Arquivo recusado (4xx) não é repetido: repetir daria o mesmo resultado ─────────────────
{
  let vezes = 0;
  await assert.rejects(
    enviarComRetentativa({
      totalMb: 54,
      pedirUrl: () => ({ signedUrl:'url' }),
      enviar: () => { vezes++; throw classificarFalhaEnvio({ tipo:'http', status:413, totalMb:54 }); },
      esperar: async () => {}
    }),
    /não foi aceito/,
    'recusa do arquivo precisa chegar inteira pro dono'
  );
  assert.equal(vezes, 1, 'recusa do arquivo não pode ser repetida — só faria o dono esperar à toa');
}

// ── 3. Erro temporário do armazenamento (5xx) é repetido ─────────────────────────────────────
{
  let vezes = 0;
  await enviarComRetentativa({
    totalMb: 12,
    pedirUrl: () => ({ signedUrl:'url' }),
    enviar: () => { vezes++; if (vezes === 1) throw classificarFalhaEnvio({ tipo:'http', status:503, totalMb:12 }); },
    esperar: async () => {}
  });
  assert.equal(vezes, 2, 'HTTP 5xx é temporário: tenta de novo');
}

// ── 4. Envio parado (celular sem sinal, sem erro nenhum do navegador) conta como queda ────────
{
  assert.equal(passouDoTempoParado(PARADA_MAXIMA_MS - 1), false, 'lento mas andando não pode ser cortado');
  assert.equal(passouDoTempoParado(PARADA_MAXIMA_MS), true, 'parado de vez precisa ser cortado pra poder recomeçar');
  assert.equal(classificarFalhaEnvio({ tipo:'parado' }).cpPodeTentarDeNovo, true, 'envio parado é motivo pra tentar de novo');
  assert.equal(classificarFalhaEnvio({ tipo:'abortado' }).cpPodeTentarDeNovo, false, 'interrupção não é falha de rede');
}

// ── 5. Acabadas as tentativas, o dono recebe uma saída — não um beco sem saída ────────────────
{
  const avisos = [];
  await assert.rejects(
    enviarComRetentativa({
      totalMb: 54,
      pedirUrl: () => ({ signedUrl:'url' }),
      enviar: () => { throw classificarFalhaEnvio({ tipo:'rede', totalMb:54, enviadoMb:20 }); },
      esperar: async () => {},
      avisar: (e) => avisos.push(e)
    }),
    (err) => {
      assert.match(err.message, /3 tentativas/, 'a mensagem diz que já tentou sozinho');
      assert.match(err.message, /Wi-Fi/, 'a mensagem diz o que fazer (sair dos dados do celular)');
      assert.match(err.message, /20\.0 de 54\.0 MB/, 'a mensagem diz quanto foi enviado');
      // Mensagem longa demais vira texto genérico lá na tela (userFriendlyError), perdendo a dica.
      assert.ok(err.message.length < 200, 'a mensagem precisa caber sem virar texto genérico');
      return true;
    }
  );
  assert.equal(avisos.filter(a => a.fase === 'recomecando').length, 2, 'o dono vê na tela que está recomeçando');
}

// ── 6. A regra continua ligada na importação (não adianta o módulo existir sozinho) ───────────
{
  const importacao = fs.readFileSync(new URL('../js/importacao.js', import.meta.url), 'utf8');
  assert.match(importacao, /enviarComRetentativa\({/, 'o envio do ZIP precisa passar pela regra de repetição');
  assert.match(importacao, /pedirUrl: \(\) => pedirUrlDeEnvio\(\)/, 'cada tentativa pede uma URL nova');
  assert.match(importacao, /passouDoTempoParado\(parado\)/, 'o vigia precisa cortar o envio parado, não só avisar');
  assert.ok(!/Falha de conexão durante o envio\. Verifique a internet/.test(importacao),
    'a mensagem antiga (desistir de primeira) não pode voltar');

  const build = fs.readFileSync(new URL('../build.js', import.meta.url), 'utf8');
  assert.equal((build.match(/js\/envio-retentativa\.js/g) || []).length, 2,
    'o arquivo novo precisa ser publicado (lista de arquivos e lista de texto do build)');
  assert.equal(TENTATIVAS_ENVIO >= 3, true, 'pelo menos 3 tentativas');
  assert.match(mensagemDesistencia({ enviadoMb: 1, totalMb: 2, tentativas: 3 }), /1\.0 de 2\.0 MB/);
}

console.log('v1217-envio-zip-tenta-de-novo: ok');
