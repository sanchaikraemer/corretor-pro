# v724-2 — Correção real das 3 mensagens

## Problema encontrado
A v724/v724-1 resetou o prompt, mas a integração ainda falhava porque:
- o prompt ainda continha instrução incompatível: “Não gere três mensagens”; 
- a API montava apenas `messages.a` e deixava `messages.b`/`messages.c` vazios;
- o app exige `a`, `b` e `c` preenchidos para mostrar a seção de mensagem.

## Correção
- `api/_pipeline.js` agora exige no JSON:
  - `mensagens.recomendada`
  - `mensagens.maisSuave`
  - `mensagens.maisDireta`
- O parser converte esses campos em:
  - `messages.a`
  - `messages.b`
  - `messages.c`
- `sugestoesPendentes` só fica falso quando as 3 existem.
- `app.js` aceita a nova arquitetura `gpt55-v724-2-analise-pura-3-mensagens`.
- Versão/cache atualizados para `724-2`.

## Teste
1. Subir os arquivos.
2. Confirmar topo `Atualização #724-2`.
3. Reanalisar Eder.
4. A seção Mensagem recomendada deve mostrar 3 opções novamente.
