import fs from 'node:fs';
import assert from 'node:assert/strict';

const app = fs.readFileSync(new URL('../app.js', import.meta.url), 'utf8');

// v866: importar num aparelho e não aparecer no outro nem com Ctrl+Shift+R. Causa: o backend
// (leads-recentes) tem um cache de 30s por instância; uma carga fria (recarregar a página)
// buscava SEM fresh=1 e aceitava o snapshot velho. Correção: a primeira busca após abrir a
// página começa com _leadsForceFresh=true, forçando fresh=1 e ignorando o cache do servidor.

assert.match(
  app,
  /let _leadsForceFresh = true;/,
  'a carga fria precisa começar forçando fresh (_leadsForceFresh = true)'
);
// E a primeira busca precisa consumir esse sinal e desligá-lo depois (pra não forçar sempre).
assert.match(app, /const usarFresh = force \|\| _leadsForceFresh;/, 'getLeadsData usa o sinal de fresh');
assert.match(app, /_leadsForceFresh = false;/, 'o sinal precisa ser desligado após a primeira busca');

console.log('v866-cold-load-fresh: ok');
