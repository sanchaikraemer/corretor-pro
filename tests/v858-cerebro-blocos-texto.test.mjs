import fs from 'node:fs';
import assert from 'node:assert/strict';

const html = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const app = fs.readFileSync(new URL('../app.js', import.meta.url), 'utf8');
const api = fs.readFileSync(new URL('../api/cerebro-config.js', import.meta.url), 'utf8');
const pipeline = fs.readFileSync(new URL('../api/_pipeline.js', import.meta.url), 'utf8');

assert.match(html, /id="cerebroRegrasTexto"/);
assert.match(html, /id="cerebroObjecoesTexto"/);
assert.doesNotMatch(html, /id="cerebroAddRegra"/);
assert.doesNotMatch(html, /id="cerebroAddObjecao"/);
assert.doesNotMatch(html, /id="cerebroNovaRegra"/);
assert.doesNotMatch(html, /id="cerebroNovaObjecao"/);
assert.match(app, /regrasTexto:\s*qs\("#cerebroRegrasTexto"\)/);
assert.match(app, /objecoesTexto:\s*qs\("#cerebroObjecoesTexto"\)/);
// acrescentarRegraAoBloco existia só pra alimentar as sugestões de áudio/print/vídeo-link —
// todas removidas (v919/v920), então a função virou órfã e saiu junto.
assert.doesNotMatch(app, /function acrescentarRegraAoBloco/);
assert.doesNotMatch(app, /cerebroRegras\.push/);
assert.match(api, /regrasTexto:/);
assert.match(api, /objecoesTexto:/);
// v1092 — antes daqui procurava dois títulos fixos dentro do código do pipeline. Esses títulos
// moravam em montarOrientacoes, uma função que NENHUM chamador chamava: o teste ficava verde
// mesmo que as regras do Cérebro não chegassem na IA. Agora verifica o caminho vivo — o texto
// que realmente é montado e enviado.
{
  const { formatCerebroPrompt } = await import('../api/_pipeline.js');

  const prompt = formatCerebroPrompt({
    corretorNome: 'Fulano de Tal',
    metodo: 'sempre confirmar o prazo de entrega antes de falar de preço',
    tom: 'direto e cordial',
    diferenciais: 'obra própria, entrega no prazo',
    evitar: 'nunca prometer desconto sem aprovação',
    regrasTexto: 'só apresentar unidade que esteja liberada pela diretoria',
    objecoesTexto: 'quando disser que está caro, comparar com o aluguel atual'
  });

  assert.match(prompt, /só apresentar unidade que esteja liberada/,
    'as REGRAS escritas pelo corretor no Cérebro precisam chegar na IA');
  assert.match(prompt, /comparar com o aluguel atual/,
    'as OBJEÇÕES escritas pelo corretor no Cérebro precisam chegar na IA');
  assert.match(prompt, /confirmar o prazo de entrega/, 'o método precisa chegar na IA');
  assert.match(prompt, /nunca prometer desconto/, 'o que evitar precisa chegar na IA');
  assert.match(prompt, /Fulano de Tal/, 'o nome do corretor precisa chegar na IA');

  // Cérebro em branco não pode virar instrução inventada.
  assert.equal(formatCerebroPrompt({}), '',
    'sem nada configurado no Cérebro, nenhuma regra pode ser inventada');

  // Formato ANTIGO (listas em vez de texto corrido) ainda precisa chegar na IA — há contas
  // com o Cérebro salvo assim desde antes da v858.
  const legado = formatCerebroPrompt({
    regras: [{ texto: 'nunca enviar tabela sem antes qualificar' }],
    objecoes: [{ objecao: 'vou pensar', resposta: 'pergunto o que ficou em dúvida' }]
  });
  assert.match(legado, /nunca enviar tabela sem antes qualificar/,
    'Cérebro salvo no formato antigo não pode parar de chegar na IA');
  assert.match(legado, /o que ficou em dúvida/,
    'objeção salva no formato antigo não pode parar de chegar na IA');
}
console.log('v858-cerebro-blocos-texto: ok');
