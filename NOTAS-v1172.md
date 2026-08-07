# v1172 — custo de IA direto no card de cada conta (painel administrativo)

O dono voltou a pedir "falta os custos usados de cada usuário" mostrando um print do painel
administrativo. A funcionalidade já existia desde a v1038 — uma seção própria **"Uso de IA por
empresa"**, com uma tabela (chamadas e custo por conta, hoje e nos últimos 30 dias) — mas ela fica
**abaixo** da lista principal de corretores, que é comprida (cada conta é um card com vários
campos). Ele nunca chegou a rolar até lá, então via a seção como "não existe".

## O que mudou

O custo de **hoje** de cada conta agora aparece direto no card dela, na lista principal — sem
precisar rolar até a seção separada (que continua existindo, com o detalhe dos últimos 30 dias e
o áudio transcrito).

Reaproveita o MESMO dado que a seção de baixo já buscava (`GET
/api/admin-contas?relatorio=uso-ia`, que devolve `organizationId` por empresa) — não é uma segunda
chamada ao servidor, só uma segunda leitura do mesmo resultado.

Três estados possíveis no selo (`celulaUsoIA`):
- **Ainda não carregou** (`carregarUsoIA()` não respondeu ainda): mostra "—", nunca "R$ 0,00" —
  que pareceria "sem uso" quando na verdade é só "ainda não sei".
- **Sem uso hoje** (0 chamadas): texto claro "Sem uso hoje", não "R$ 0,00" solto.
- **Com uso**: "💰 R$ X,XX hoje", com o número de chamadas no `title` (tocar e segurar / passar o
  mouse).

## Sobre os botões ainda estarem "feios/errados"

Não consegui achar, olhando o código e reproduzindo a tela de verdade (mesmo HTML/CSS publicado,
print em anexo na conversa), o que especificamente ainda está errado — os botões de ação (Pago ·
Pro, Pago · Pro Master, +7 dias teste, Bloquear, Excluir) já estão no formato pequeno/neutro da
v1169. Perguntei de volta pro dono o que exatamente incomoda (cor, tamanho, forma) antes de mexer
de novo — mudar sem saber o quê especificamente arrisca fazer a MESMA correção de novo (já foi
v1168 → v1169) sem resolver.

## Testes

`tests/v1172-uso-de-ia-por-conta.test.mjs` (novo): roda `celulaUsoIA` de verdade cobrindo os 3
estados; confirma que `renderizarPainel()` usa a célula nova; confirma que `carregarUsoIA()`
indexa o resultado por `organizationId` e redesenha a lista principal (sem precisar de F5);
confirma o CSS do selinho e a mesma proteção contra "selo dentro de selo" no celular que a v1168
já tinha pra "Dias de teste".

## Verificação

- `npm test`: 338 arquivos de teste, todos verdes.
- Chromium headless, `admin-plataforma.html` publicado (dados de mentira nas mesmas 4 contas do
  print do dono): computador e celular, selo de custo aparecendo em cada card, sem selo duplicado
  no celular, zero erro de JavaScript.

## Arquivos

`admin-plataforma.html` (`usoIaPorConta`, `celulaUsoIA`, coluna nova em `renderizarPainel` e no
cabeçalho da tabela, `carregarUsoIA` alimentando e redesenhando), `contas-estilo.css`
(`.chip-uso-ia` + proteção mobile), `tests/v1172-uso-de-ia-por-conta.test.mjs` (novo),
`package.json`/`package-lock.json`, `NOTAS-v1172.md`, versão **1171 → 1172**.
