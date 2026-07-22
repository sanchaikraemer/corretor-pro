import fs from 'node:fs';
import assert from 'node:assert/strict';

// v915 — bug do print (Maiquel Malheiros): o corretor reimportou a conversa depois de editar
// o nome do contato no celular (acrescentou o empreendimento ao nome salvo). O nome extraído
// pela IA na nova importação ("Maiquel Malheiros Evolutti Lançamento Cristian") não batia mais,
// nem por igualdade exata nem por telefone/arquivo, com o lead já salvo ("Maiquel Malheiros
// Lançamento Cristian"). Como acharLeadExistente só reconhecia nome IDÊNTICO, o app tratava
// como cliente novo e SALVAVA DIRETO (sem perguntar) — criando um cadastro duplicado. O
// original, ainda "parado" na home, continuava intocado; o corretor só via o duplicado se
// soubesse que ele existia. Da perspectiva dele, a atualização "sumia" ao voltar pra home.
//
// Correção: quando o nome não é idêntico mas é "quase igual" (mesmas duas primeiras palavras +
// todas as palavras do nome mais curto aparecem, na mesma ordem, dentro do mais longo), o app
// avisa o corretor e pergunta se é o mesmo cliente — nunca funde sozinho, só evita salvar uma
// duplicata em silêncio sem dar chance de o corretor perceber.

const app = fs.readFileSync(new URL('../app.js', import.meta.url), 'utf8');

const palavrasSrc = app.match(/function _palavrasNome\(valor\)\{[\s\S]*?\n\}/);
const parecemSrc = app.match(/function nomesParecemMesmoCliente\(nomeA, nomeB\)\{[\s\S]*?\n\}/);
assert.ok(palavrasSrc && parecemSrc, 'não achei _palavrasNome/nomesParecemMesmoCliente em app.js');
const nomesParecemMesmoCliente = eval(`${palavrasSrc[0]}\n${parecemSrc[0]}\n; nomesParecemMesmoCliente`);

// 1. O caso real do print: palavra "Evolutti" inserida no meio do nome já salvo.
assert.equal(
  nomesParecemMesmoCliente('Maiquel Malheiros Evolutti Lançamento Cristian', 'Maiquel Malheiros Lançamento Cristian'),
  true,
  'nome com palavra extra no meio deve ser reconhecido como possível mesmo cliente'
);

// 2. Palavra extra no fim também conta (contato ganhou um apelido/tag depois do nome).
assert.equal(
  nomesParecemMesmoCliente('Joao Silva', 'Joao Silva Corretor Parceiro'),
  true,
  'nome com palavra extra no fim deve ser reconhecido como possível mesmo cliente'
);

// 3. Nome idêntico não passa por aqui (isso é "nome-exato", tratado antes) — mas a função
// ainda deve reconhecer como parecida (é um caso mais específico do mesmo teste de subsequência).
assert.equal(nomesParecemMesmoCliente('Joao Silva', 'Joao Silva'), true, 'nome idêntico também bate na checagem de semelhança');

// 4. Sobrenome diferente nunca é "parecido" — evita perguntar bobagem para pessoas distintas.
assert.equal(nomesParecemMesmoCliente('Joao Silva', 'Joao Souza'), false, 'sobrenomes diferentes não são parecidos');

// 5. Nome só com uma palavra a mais NO MEIO do primeiro/segundo nome (ex.: "Ana Maria" vs
// "Ana Clara") não pode enganar por ordem — exige as duas primeiras palavras idênticas.
assert.equal(nomesParecemMesmoCliente('Ana Maria Souza', 'Ana Clara Souza'), false, 'segunda palavra diferente não é parecida');

// 6. Nome parecido mas fora de ordem (não é subsequência) não bate.
assert.equal(nomesParecemMesmoCliente('Joao Silva Cristian', 'Joao Silva Lancamento Cristian Torres'), true, 'extra no fim depois de Cristian ainda é subsequência válida');
assert.equal(nomesParecemMesmoCliente('Joao Silva Torres Cristian', 'Joao Silva Cristian Torres'), false, 'palavras fora de ordem não contam como subsequência');

// 7. Nomes vazios ou com uma palavra só nunca "parecem" (evita falso positivo com nome genérico).
assert.equal(nomesParecemMesmoCliente('', 'Joao Silva'), false, 'nome vazio nunca parece');
assert.equal(nomesParecemMesmoCliente('Joao', 'Joao Silva'), false, 'nome de uma palavra só não é comparável');

// 8. acharLeadExistente precisa consultar o caso "nome-parecido" além do "nome-exato", e
// renderProcessedResult não pode mais salvar direto (sem perguntar) quando só há semelhança.
assert.ok(app.includes('via:"nome-parecido"'), 'acharLeadExistente deve devolver via:"nome-parecido" quando o nome só é semelhante');
assert.ok(app.includes('nomeSoParecido'), 'renderProcessedResult deve tratar o caso de nome só parecido separadamente');
assert.ok(app.includes('btnSalvarComoNovo'), 'a UI de nome parecido precisa oferecer a opção de salvar como cliente novo');
assert.ok(
  app.includes('É o mesmo cliente?'),
  'o corretor precisa ser perguntado explicitamente quando o nome só é parecido, não idêntico'
);

console.log('v915-nome-parecido-avisa: ok');
