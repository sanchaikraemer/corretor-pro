import fs from 'node:fs';
import assert from 'node:assert/strict';

// v1082 — quem abre o app SEM estar conectado (nunca entrou, ou saiu / limpou o navegador)
// via a caixinha crua do navegador pedindo "a chave de segurança do Corretor Pro" — uma coisa
// que cliente nenhum tem nem entende — e a tela ficava presa em "Reconectando…". Agora, quando
// não há login E não há chave guardada neste aparelho, o app manda direto pra tela de entrar.
// A caixinha da chave só sobrevive pro aparelho que JÁ usa o caminho antigo (chave guardada) e
// cuja chave parou de valer.

const app = fs.readFileSync(new URL('../app.js', import.meta.url), 'utf8');

// Recorta o tratamento do 401 dentro do interceptador de chamadas à API.
const bloco401 = app.match(/if \(res\.status === 401\) \{[\s\S]*?\n {4}\}/);
assert.ok(bloco401, 'o interceptador precisa continuar tratando o 401 da API');
const corpo = bloco401[0];

// 1. Sessão vencida (havia token) continua indo pra tela de entrar.
assert.match(corpo, /if \(token\) \{\s*\n\s*irParaEntrar\(\);/,
  'com sessão vencida (token existia) o app precisa voltar pra tela de entrar');

// 2. Sem token E sem chave salva: vai pra tela de entrar, NUNCA pra caixinha da chave.
const guardaSemChave = corpo.match(/if \(!key\) \{\s*\n\s*irParaEntrar\(\);\s*\n\s*return res;\s*\n\s*\}/);
assert.ok(guardaSemChave, 'sem login e sem chave salva, o app precisa ir pra tela de entrar');

// 3. A caixinha da chave só pode ser alcançada DEPOIS dessa guarda — ou seja, só pra aparelho
// que já tem chave guardada. Se um dia alguém reordenar isso, este teste quebra.
const posGuarda = corpo.indexOf('if (!key)');
const posPergunta = corpo.indexOf('pedirChaveUmaVezSo(');
assert.ok(posPergunta > posGuarda && posGuarda !== -1,
  'a caixinha da chave antiga só pode ser pedida depois da guarda de "sem chave salva"');

// 4. O 401 nunca mais pode chamar a caixinha crua direto (era o que empilhava várias seguidas).
assert.doesNotMatch(corpo, /window\.definirChaveSegurancaCorretorPro\(\)/,
  'o 401 precisa passar pelo pedido único (pedirChaveUmaVezSo), não chamar a caixinha direto');

// 5. Travas de uma vez só: várias chamadas de API voltando 401 juntas (a Home dispara várias)
// não podem mandar a navegação nem abrir a caixinha uma vez por chamada.
assert.match(app, /let jaMandouPraEntrar = false;/, 'precisa da trava de uma ida só pra tela de entrar');
assert.match(app, /function irParaEntrar\(\)\{\s*\n\s*if \(jaMandouPraEntrar\) return;/,
  'irParaEntrar precisa checar a trava antes de navegar');
assert.match(app, /let chavePerguntadaNestaSessao = false;/, 'precisa da trava de pergunta única da chave');
assert.match(app, /function pedirChaveUmaVezSo\(\)\{\s*\n\s*if \(chavePerguntadaNestaSessao\) return chaveRespondida;/,
  'pedirChaveUmaVezSo precisa reaproveitar a resposta em vez de perguntar de novo');

// 6. O caminho antigo (chave compartilhada) continua existindo de verdade pra quem já usa.
assert.match(app, /X-Corretor-Pro-Key/, 'o caminho antigo da chave compartilhada precisa continuar existindo');
assert.match(app, /retryHeaders\.set\("X-Corretor-Pro-Key", nova\)/,
  'com chave nova informada, a chamada precisa ser refeita com ela');

// 7. Faxina de código morto da mesma versão: a geração antiga do Arquivar (com confirm() do
// navegador) saiu — vale só a versão viva da v1073, com confirmação dentro do app.
assert.doesNotMatch(app, /async function arquivarLead\(/,
  'a geração antiga de arquivarLead (com confirm nativo) precisa ter saído');
assert.match(app, /window\.arquivarLead = function\(id, nome\)\{/,
  'a versão viva do Arquivar (v1073) precisa continuar existindo');
const pontesReanalisarTudo = app.match(/window\.reanalisarTudo = reanalisarTudo;/g) || [];
assert.equal(pontesReanalisarTudo.length, 1,
  'window.reanalisarTudo só precisa ser publicado uma vez (a segunda linha era repetida)');


console.log('v1082-sem-login-vai-pra-tela-de-entrar: ok');
