import fs from 'node:fs';
import assert from 'node:assert/strict';

// v996 — o dono escolheu, entre 4 propostas visuais, o modelo "resumo + tabela": números
// grandes no topo (total/teste/ativos/bloqueados), busca por nome, status em pílulas coloridas,
// e o painel usando bem mais largura da tela no computador (antes ficava espremido em 640px).

const admin = fs.readFileSync(new URL('../admin-plataforma.html', import.meta.url), 'utf8');

assert.match(admin, /class="cartao painel-largo" id="areaPainel"/, 'o painel precisa usar a classe mais larga, não a mesma do formulário de login');
assert.match(admin, /id="statTotal"/, 'precisa mostrar o total de corretores');
assert.match(admin, /id="statTeste"/, 'precisa mostrar quantos estão em teste');
assert.match(admin, /id="statAtivo"/, 'precisa mostrar quantos estão ativos');
assert.match(admin, /id="statBloqueado"/, 'precisa mostrar quantos estão bloqueados');
assert.match(admin, /id="buscaCorretor"/, 'precisa ter busca por nome do corretor');
assert.match(admin, /filtrarPorStatus\('teste'/, 'precisa ter filtro por status');
assert.match(admin, /class="pill \$\{e\.status\}"/, 'o status de cada corretor precisa aparecer como pílula colorida, não texto solto');

// O nome do corretor vem de quem se cadastra — sem escapar, um nome com HTML/script
// quebraria ou injetaria código na tela do administrador (é a mesma classe de bug que existe
// se qualquer texto digitado pelo usuário for jogado direto num innerHTML).
assert.match(admin, /function escapeHtml/, 'precisa ter uma função de escape de HTML');
assert.match(admin, /escapeHtml\(e\.nome\)/, 'o nome do corretor precisa passar por escapeHtml antes de entrar na tela');

const css = fs.readFileSync(new URL('../contas-estilo.css', import.meta.url), 'utf8');
assert.match(css, /\.painel-largo\{/, 'contas-estilo.css precisa definir a classe que amplia o painel administrativo');
assert.match(css, /\.pill\.teste\{/, 'contas-estilo.css precisa estilizar a pílula de status "teste"');
assert.match(css, /\.pill\.ativo\{/, 'contas-estilo.css precisa estilizar a pílula de status "ativo"');
assert.match(css, /\.pill\.bloqueado\{/, 'contas-estilo.css precisa estilizar a pílula de status "bloqueado"');

console.log('v996-painel-admin-resumo-e-filtro: ok');
