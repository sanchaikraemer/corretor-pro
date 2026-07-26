import fs from 'node:fs';
import assert from 'node:assert/strict';

// v994 criou o redirecionamento do login pro sistema — na época, SÓ pra conta original,
// porque o sistema ainda não separava os dados por corretor. A v1004 encerrou essa fase:
// com a separação pronta (v997–v1003), TODO corretor com a conta em dia entra direto.
// Este teste guarda o comportamento atual: redireciona depois do login ok, sem "tela de
// espera" e sem tratamento especial pra conta original.

const entrar = fs.readFileSync(new URL('../entrar.html', import.meta.url), 'utf8');

assert.match(entrar, /window\.location\.href\s*=\s*['"]\/['"]/, 'entrar.html precisa redirecionar pra "/" depois do login confirmado');
assert.ok(!/ehEmpresaPrincipal/.test(entrar), 'não pode mais existir tratamento especial pra conta original — todo corretor em dia entra');
assert.ok(!/quase pronta/.test(entrar), 'a tela de espera pra corretores novos acabou — ninguém mais fica barrado depois do login ok');

// A trava de conta bloqueada/teste vencido continua ANTES do redirecionamento (e também existe
// no servidor desde a v1003 — aqui é só a mensagem amigável).
const idxBloqueado = entrar.indexOf('teste grátis acabou');
const idxRedirect = entrar.indexOf("window.location.href = '/'");
assert.ok(idxBloqueado !== -1 && idxRedirect !== -1 && idxBloqueado < idxRedirect,
  'a checagem de bloqueado/vencido precisa vir antes do redirecionamento');

console.log('v994-login-empresa-principal-vai-pro-sistema: ok (atualizado pela v1004 — todo corretor em dia entra)');
