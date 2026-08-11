import fs from 'node:fs';
import assert from 'node:assert/strict';

// v1199 — relato do dono: o envio do ZIP ("Enviando com segurança") ficou parado numa porcentagem
// por quase um minuto, e pareceu que o app tinha travado — mesmo com um ZIP pequeno (5 mensagens
// de texto, sem áudio), o que descarta "arquivo grande" como causa. O código do envio (XHR PUT
// direto pro Storage) não tinha nenhuma trava artificial — o mais provável é o próprio caminho de
// rede até o Supabase naquele momento, algo que esta sessão não consegue enxergar sem acesso aos
// logs de produção. O que dá pra fazer: nunca mais parecer travado, mostrando quantos MB já foram
// enviados de verdade e avisando se ficar tempo demais sem nenhum byte novo — sem cancelar nada
// sozinho.

const src = fs.readFileSync(new URL('../js/importacao.js', import.meta.url), 'utf8');

// 1. O texto mostrado durante o envio inclui MB enviados / MB totais, não só a porcentagem crua.
// v1217 — o texto ganhou o sufixo da tentativa (o envio agora se repete sozinho quando a
// conexão cai), mas o "X de Y MB" que esta guarda existe pra proteger continua ali.
assert.match(
  src,
  /renderEtapas\(1, `enviando a conversa — \$\{enviadoMb\} de \$\{totalMb\.toFixed\(1\)\} MB\$\{sufixo\}`\);/,
  'o progresso do envio precisa mostrar "X de Y MB", não só a porcentagem'
);

// 2. Existe um vigia que dispara um aviso de lentidão quando passa tempo sem avançar nenhum byte.
assert.match(src, /const vigiaLentidao = setInterval\(/, 'precisa existir um vigia de lentidão do envio');
assert.match(
  src,
  /está lento, aguarde — se a conexão cair o app tenta de novo sozinho/,
  'o aviso de lentidão precisa deixar claro que não travou, só está demorando'
);

// 3. O vigia é encerrado tanto no sucesso/erro HTTP quanto na falha de conexão — nunca fica
// rodando pra sempre depois que o envio termina.
// v1217 — quem para o vigia virou encerrar(), chamado nas TRÊS saídas do envio (sucesso/erro
// HTTP, queda de conexão e corte por envio parado).
assert.match(src, /const encerrar = \(\) => \{ clearInterval\(vigiaLentidao\); \};/, 'precisa existir um único jeito de parar o vigia');
assert.match(src, /xhr\.onload = function\(\)\{\s*\n\s*encerrar\(\);/, 'onload precisa parar o vigia');
assert.match(src, /xhr\.onerror = function\(\)\{ encerrar\(\);/, 'onerror precisa parar o vigia');
assert.match(src, /xhr\.onabort = function\(\)\{ encerrar\(\);/, 'o corte por envio parado precisa parar o vigia');

console.log('v1199-envio-mostra-mb-e-avisa-lentidao: ok');
