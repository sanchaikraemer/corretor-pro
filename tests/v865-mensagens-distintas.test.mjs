import fs from 'node:fs';
import assert from 'node:assert/strict';

const pipeline = fs.readFileSync(new URL('../api/_pipeline.js', import.meta.url), 'utf8');

// v865: as 3 sugestões vinham praticamente iguais.
// v1372/governança: o prompt principal é medido e não pode ser reescrito sem nova bateria. A
// distinção nova (uma lacuna prioritária por vez) fica no fichário determinístico, na conferência
// da saída e no revisor pós-medição. Este teste protege o COMPORTAMENTO, não exige que a regra
// nova seja inserida dentro do miolo protegido.

// Base medida: as três continuam partindo da mesma leitura e sem diferenças artificiais.
assert.match(pipeline, /podendo ter ângulos diferentes sem\s*\n?inventar diferenças artificiais/,
  'o prompt medido ainda precisa evitar três cópias sem utilidade');
assert.match(pipeline, /As três nascem da mesma verdade factual e da mesma leitura comercial/,
  'as três precisam nascer da mesma leitura');
assert.match(pipeline, /RECOMENDADA é a que você enviaria se só pudesse enviar uma/,
  'papel da recomendada precisa continuar descrito');

// v1372: quando existe lacuna prioritária, a camada posterior trava a jogada e só varia redação.
assert.match(pipeline, /const systemPromptReparoMensagens = `Você é o revisor final das mensagens comerciais do Corretor Pro/,
  'a correção das mensagens precisa ficar fora do coração medido');
assert.match(pipeline, /Quando houver uma LACUNA COMERCIAL PRIORITÁRIA, as três mensagens devem resolver ESSA MESMA lacuna/,
  'com lacuna única, A\/B\/C não podem abrir etapas comerciais diferentes');
assert.match(pipeline, /MAIS SUAVE reduz a pressão pela forma de escrever; não muda a pergunta central/,
  'a suave muda a forma, não o dado pedido');
assert.match(pipeline, /MAIS DIRETA encurta o caminho até a pergunta central; não troca a pergunta por outra etapa/,
  'a direta não pode pular para outra etapa');
assert.match(pipeline, /MODO DE CONVERGÊNCIA DO REPARO/,
  'a convergência da lacuna precisa estar explícita no reparo');
assert.match(pipeline, /A, B e C devem pedir exatamente essa lacuna/,
  'nenhuma alternativa pode trocar faixa por entrada, parcelas, reforços etc.');
assert.match(pipeline, /As três são alternativas, não sequência\. Varie a redação, não o objetivo comercial/,
  'as três precisam ser alternativas da mesma jogada');
assert.match(pipeline, /MESMA LACUNA NÃO SIGNIFICA MESMA MENSAGEM/,
  'convergência não libera três textos copiados');

// Proteções antigas continuam válidas.
assert.match(pipeline, /Não repita pergunta já respondida nem transforme falta de dado em interrogatório/,
  'não pode perguntar o que já está resolvido');
assert.match(pipeline, /Não repita automaticamente uma tentativa ignorada/,
  'tentativa ignorada não vira repetição automática');

console.log('v865-mensagens-distintas: ok');
