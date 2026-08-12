# v1226 — "R$ 2,64 hoje" ao lado de "0/150 hoje": os dois números agora usam o mesmo dia

Dono, 12/08/2026, com print do painel de contas: na mesma linha da Empresa 1, um selo dizia
**"💰 R$ 2,64 hoje"** e o selo do lado dizia **"0/150 hoje"**. Gastou dinheiro hoje, mas nenhuma
análise hoje. Os dois não podiam estar certos ao mesmo tempo.

## O que estava acontecendo

Os dois selos contavam "hoje" por relógios diferentes:

- **o selo das análises** (o `0/150`) vira o dia à **meia-noite de Brasília** — é o mesmo contador
  que trava a conta quando ela bate o teto do dia;
- **o selo do dinheiro** virava o dia à **meia-noite de Londres**, três horas antes.

Na prática: entre a meia-noite e as 3h da manhã de Brasília, tudo o que foi gasto no fim da noite
anterior **ainda contava como "hoje"** na coluna do dinheiro, enquanto a coluna das análises já
tinha zerado e começado um dia novo. Daí o print: R$ 2,64 de ontem à noite exibidos como gasto de
hoje, com zero análises de hoje.

O mesmo desalinhamento afetava os dois números do topo da tela — "Chamadas hoje (todas as
empresas)" e "Custo estimado hoje" — e as colunas "hoje" da tabela detalhada de uso de IA.

## O que mudou

O relatório de custo passou a cortar o dia pelo **calendário de Brasília**, exatamente como o
contador de análises. Nada mais muda de aparência: são os mesmos selos, as mesmas colunas, só que
agora o "hoje" do dinheiro e o "hoje" das análises falam do mesmo dia.

## Vale lembrar (não é erro)

Mesmo com tudo alinhado, o selo do dinheiro pode mostrar gasto com o selo de análises em zero: o
aprendizado automático (a leitura que o sistema faz sozinho do histórico da carteira) e a
transcrição de áudio **custam**, mas não consomem o teto de análises. Quem separa isso é o texto
que aparece ao passar o mouse sobre o selo do dinheiro (e a tabela "Uso de IA por empresa", que tem
colunas separadas para "Análise hoje" e "Aprendizado auto hoje").

## Proteção pra não voltar

`tests/v1226-custo-hoje-usa-dia-de-brasilia.test.mjs` monta um gasto às 22h de ontem em Brasília
(que é 1h da manhã de hoje em Londres) e exige que ele **não** apareça no "hoje" do custo, nem no
total da plataforma.
