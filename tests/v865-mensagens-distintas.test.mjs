import fs from 'node:fs';
import assert from 'node:assert/strict';

const pipeline = fs.readFileSync(new URL('../api/_pipeline.js', import.meta.url), 'utf8');

// v865: as 3 sugestões vinham praticamente iguais. A proteção continua valendo, mas a v1371
// esclarece uma distinção importante: quando o app elege UMA lacuna prioritária, variar não pode
// significar trocar o dado a descobrir. Nesse caso são três REDAÇÕES da mesma jogada, com linguagem,
// ritmo e grau de objetividade diferentes — não três etapas comerciais diferentes.
assert.match(pipeline, /podendo ter ângulos diferentes sem\s*\n?inventar diferenças artificiais/,
  'o prompt ainda precisa evitar três cópias sem utilidade');
assert.match(pipeline, /As três nascem da mesma verdade factual e da mesma leitura comercial/,
  'as três precisam nascer da mesma leitura');
assert.match(pipeline, /RECOMENDADA é a que você enviaria se só pudesse enviar uma/,
  'papel da recomendada precisa estar descrito');
assert.match(pipeline, /MAIS SUAVE reduz a pressão pela forma de escrever; não muda a pergunta central/,
  'com lacuna, a suave muda a forma, não o dado pedido');
assert.match(pipeline, /MAIS DIRETA encurta o caminho até a pergunta central; não troca a pergunta por outra etapa/,
  'com lacuna, a direta não pode pular para outra etapa');
assert.match(pipeline, /só abrem caminhos comerciais diferentes quando NÃO existe lacuna\s*\n?\s*prioritária/,
  'sem lacuna única ainda pode haver alternativas estratégicas; com lacuna, não');
assert.match(pipeline, /MODO DE CONVERGÊNCIA — REGRA ESTRUTURAL DO PRODUTO/,
  'a exceção de uma lacuna por vez precisa estar explícita');
assert.match(pipeline, /B é uma reescrita mais leve da MESMA mensagem/,
  'a opção B precisa preservar a jogada canônica');
assert.match(pipeline, /C é uma reescrita mais direta da MESMA mensagem/,
  'a opção C precisa preservar a jogada canônica');
assert.match(pipeline, /MESMA LACUNA NÃO SIGNIFICA MESMA MENSAGEM/,
  'convergência não libera três textos copiados');
assert.match(pipeline, /Não repita pergunta já respondida nem transforme falta de dado em interrogatório/,
  'não pode perguntar o que já está resolvido');
assert.match(pipeline, /Não repita automaticamente uma tentativa ignorada/,
  'tentativa ignorada não vira repetição automática');

console.log('v865-mensagens-distintas: ok');
