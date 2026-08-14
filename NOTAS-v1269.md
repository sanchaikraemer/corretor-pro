# v1269 — segunda passada da revisão: o que a primeira faxina deixou aparecer

O dono pediu, depois da v1268: *"agora revise tudo de novo com atenção"*. Esta versão é o resultado
dessa segunda passada — e ela achou coisa que a primeira não tinha como achar, porque **código morto
esconde código morto**: enquanto uma função morta é citada por outra função morta, nenhum contador
enxerga as duas.

## 1. A prova de que a v1268 não mudou a aparência

Antes de mexer em qualquer coisa, montei os dois apps lado a lado — o publicado **antes** da faxina
(v1267) e o de **agora** — e comparei o resultado computado de **cada elemento da página**
(22 propriedades: cor, fundo, borda, tamanho, espaçamento, posição, sombra…), no celular e no
computador.

| | celular | computador |
|---|---|---|
| elementos comparados (chave única) | 539 | 539 |
| **diferenças de estilo** | **0** | **0** |
| erros de página | nenhum | nenhum |

Os 27 elementos a menos são exatamente o cartão "Aparência" e o script de boot do tema. Nada mais
mudou de lugar, de cor ou de tamanho.

## 2. O buraco no detector de código morto do projeto

O projeto já tinha um guarda contra código morto (`tests/v1186`, criado na auditoria de 09/08). Ele
tem uma regra: função com "ponte" pro HTML (`window.x = x`) pode ser chamada por um `onclick`, então
ele tolera. E a régua era:

```js
if (!foraDoApp && dentro <= (temPonte ? 2 : 1)) mortas.push(...)
```

**A régua estava um número abaixo do certo.** A linha da ponte cita o nome **duas** vezes
(`window.mostrarTratadosHoje = mostrarTratadosHoje`), então "declaração + ponte" dá **3**, nunca 2 —
ou seja, **nenhuma função com ponte jamais era apontada**, por mais morta que estivesse. Era um
alarme que não tocava.

Corrigido para 3. E, com a régua certa, o guarda passou a apontar coisas que estavam ali há muitas
versões.

## 3. O que saiu nesta segunda passada

| Item | Linhas | Por quê |
|---|---|---|
| "Atender em sequência" (esteira) — 4 funções | ~35 | Abria a fila um cliente por vez com "Próximo". Os botões saíram quando a Home foi refeita; sobraram as funções. |
| `mostrarTratadosHoje` | 42 | Abria a lista de quem foi tratado hoje a partir de um quadradinho da Home que não existe mais. |
| `abrirMaisAcoes` | 20 | Era o menu do "+" da barra de baixo; o "+" abre o cadastro manual direto há versões. |
| `abrirDesempenhoInsights` + `buildDesempenhoInsightsHTML` | 43 | Modal de insights chamado por um item de menu que saiu. |
| `verListaHoje` | 5 | Botão daquele modal; apontava pro grupo "acao-hoje", que também não existe. |
| `toggleAgendar` | 5 | Abria a caixa `#agendarbox_<id>`, que nenhuma tela desenha desde que o painel de agendar foi refeito. |
| `abrirAtendimentosFiltro` + `leadEhQuente` | 11 | Filtro da Carteira acionado por botões que saíram. |
| `garantirIntelCarregado` | 12 | **Fazia um pedido de rede a cada cliente aberto** pra encher um cache que só a seção "clientes parecidos" (removida na v1268) lia. |
| `cp786CompararConducao` | 15 | Uma **segunda** ordenação de lista, sobrevivente da tela "Condução" (apagada na v1075), com régua **diferente** da que vale. Dois relógios contando diferente é a doença mais cara deste projeto. |

O `garantirIntelCarregado` é o achado que o dono sente: era uma ida à rede **no caminho crítico de
abrir um cliente**, sem nenhum consumidor do outro lado.

## 4. Dois erros meus nesta passada — e como foram pegos

Cortei dois blocos "da função até a ponte dela" sem notar que **outras funções moram entre as
duas**. Nas duas vezes a suíte pegou na hora (`v905` e `v1186`), e nas duas eu restaurei o que não
devia ter saído:

1. `aprenderDaCarteira` e `importarTelefonesCSV` foram junto com o menu "+" → **devolvidas**;
2. sete funções `cp786*`/ordenação foram junto com o comparador morto → **devolvidas**, ficando só
   o comparador.

Fica o registro porque a lição vale mais que o conserto: **nunca cortar "da assinatura até a ponte"**
— num arquivo grande, a ponte quase sempre está num bloco de pontes lá embaixo, com meio arquivo no
meio do caminho.

## 5. Cinco funcionalidades que existem mas estão SEM BOTÃO (decisão do dono)

Não apaguei nenhuma. São recursos de verdade que perderam a porta de entrada em versões passadas, e
apagar é decisão dele:

| Funcionalidade | Situação |
|---|---|
| **Aprender da carteira** | Só era alcançável pelo menu do "+" que saiu. |
| **Importar telefones (CSV)** | Idem — e a v905 registrou que deveria continuar existindo. |
| **Refinar as 3 sugestões em segundo plano** | Perdeu o chamador em alguma versão anterior; hoje nunca roda. |
| **"O cliente respondeu?"** (evento de aprendizado) | Perdeu a tela; a v1189 diz que a pergunta manual continua valendo. |
| **Auditoria de dados** (`auditarDadosV681`) | Ferramenta de apoio, chamada pelo console — esta é intencional. |

As cinco estão **listadas dentro do teste `v1186`, cada uma com o motivo escrito**. Isso é o
contrário de deixar quieto: elas ficam visíveis, e o teste falha se aparecer uma sexta — ou se
alguma delas voltar a ser usada sem sair da lista.

## Testes

- `tests/v1186-nada-de-codigo-morto.test.mjs` — régua corrigida (2 → 3) e lista de exceções
  documentada, com conferência dos dois lados (nada novo entra sem alarme; nada volta a ser usado e
  fica na lista).
- `tests/v1138-lembrete-diario-cobranca.test.mjs` — o teste fatiava o arquivo usando
  `function leadEhQuente` como marcador de fim. Com a função apagada, o `indexOf` devolvia -1 e a
  fatia virava **o arquivo quase inteiro** — o teste falhava sem nada estar errado. Agora o marcador
  é o fim real do bloco, e a fatia é conferida antes de valer.
- `tests/v1069-remove-anexar-zip-manual.test.mjs` — a regra que ele protege (nada abre seletor de
  arquivo) agora é conferida pelo caminho que sobrou.

Suíte completa verde: 23 arquivos + 424 testes.
