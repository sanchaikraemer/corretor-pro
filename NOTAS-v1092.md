# NOTAS v1092 — Faxina grande, e uma falha achada a tempo de não estragar nada

## O que o dono mandou

Uma lista de sete tarefas de auditoria pra fazer durante a madrugada, com uma ordem clara junto:
validar tudo de verdade antes de publicar, sem inventar resultado de teste e sem esconder
limitação do ambiente. E, no fim: *"lembre-se de fazer mais uma faxina além disso, vamos cada dia
'varrer um pouco mais a casa'"*.

Esta versão **não muda nada na tela**. É toda por dentro: o app faz o mesmo que fazia, com menos
peça solta e com travas melhores.

---

## O mais importante: uma falha grave que ia derrubar toda importação

No meio da faxina apareceu um problema **novo, criado nesta própria rodada de trabalho**, que
ainda não tinha ido pro ar. Vale explicar porque é o tipo de coisa que dá trabalho depois.

Cada cliente importado é gravado com três "etiquetas de reconhecimento" (o final do telefone, o
nome do arquivo e o nome do cliente). São elas que fazem o app perceber que aquele cliente **já
existe** na carteira e atualizar o cadastro dele em vez de criar um duplicado.

O código passou a gravar uma dessas etiquetas com um nome, e a lista de "campos que podem faltar
sem problema" estava escrita com **outro nome**. Resultado: como o banco de produção ainda não
tem essas colunas, o app entenderia que faltava um campo **essencial** e **interromperia a
gravação** — ou seja, **nenhuma importação funcionaria**, em nenhuma conta.

Foi corrigido e, mais importante, **agora existe um teste que reproduz exatamente o banco de
produção de hoje** (sem a migração aplicada) e prova que a importação grava normalmente. Antes de
considerar resolvido, o teste foi rodado contra o código errado de propósito, pra confirmar que
ele realmente pega a falha — e pegou.

---

## As sete tarefas

**1. Teste que dependia do dia da semana.** Tinha teste que passava de segunda a sexta e falhava
no sábado — e um outro que falhava só nos dias 31. Os dois foram tornados independentes da data.
Para provar, a suíte inteira foi rodada simulando cinco datas diferentes: segunda, quarta, sábado,
domingo e um dia 31. Verde nas cinco.

> Observação honesta: a tarefa pedia que "sábado e domingo continuem sem fila". Isso **não** foi
> feito de propósito — na v1091 o dono decidiu o contrário, que quem escolhe os dias de
> atendimento é ele, no Cérebro. A decisão mais nova é a que vale.

**2. A busca pesada da importação.** Pra descobrir se um cliente já existia, o app baixava até
5.000 cadastros inteiros e comparava um por um — mais de uma vez por importação. Agora existe um
caminho direto e instantâneo. Ele depende de uma migração no banco (ver o final destas notas) e,
**enquanto ela não for aplicada, nada quebra**: o app percebe sozinho e continua pelo caminho
antigo, só mais devagar.

**3. Campo crítico não pode mais ser inventado nem descartado em silêncio.** O app tinha uma
"adaptação automática": se o banco recusasse uma coluna, ela era descartada; se faltasse um campo
obrigatório, ele era preenchido com um valor inventado. O caso mais perigoso: o dono do registro
(a empresa) podia ser preenchido com um código **aleatório**, e o cliente passava a pertencer a
uma empresa que não existe — sem erro nenhum na tela. Agora existe uma lista explícita do que pode
faltar sem problema; qualquer campo fora dela **interrompe a gravação com um erro claro**, dizendo
qual campo é, por que ele importa e que nada foi gravado. Errar alto é melhor que corromper baixo.

**4. Auditoria da chave compartilhada antiga.** A porta de entrada legada agora é bloqueada em
produção e tem um interruptor pra desligá-la de vez.

**5. Teste de integração da importação.** O pedido foi explícito: nada de teste que só procura
palavra dentro do código. Este monta um banco de mentira que guarda dados de verdade e confere o
resultado final — cliente existente é encontrado e atualizado (sem duplicar), cliente novo não é
confundido com outro, conta de um corretor nunca enxerga a de outro, reimportar a mesma conversa
não duplica mensagem nem perde áudio já transcrito, e falha do banco vira erro visível em vez de
sucesso falso.

**6. Documentação em dia.** Comentário desatualizado corrigido e a documentação interna
atualizada com a migração nova e os dois interruptores.

**7. Suíte de testes que se descobre sozinha.** A lista de testes era uma linha gigante escrita à
mão; era só esquecer de acrescentar um nome pra ele nunca mais rodar. Agora a suíte encontra os
testes sozinha. Foram 270 testes verdes.

---

## A faxina

Removido do código, tudo confirmado sem nenhum uso antes de sair:

- a montagem antiga da conversa a partir do arquivo do WhatsApp (substituída há tempos);
- a classificação de "corretor parceiro" — que, além de não ser chamada por ninguém, tinha **nome
  de pessoa cravado no código**, coisa que este projeto proíbe;
- o "modelo comercial único" inteiro (sete listas e oito funções), sem uso desde um reset antigo;
- a leitura de prazo solto na conversa ("semana que vem", "dia 20") pra criar lembrete sozinho —
  justamente o que o dono baniu: compromisso só existe quando ele marca;
- duas leituras de configuração que, além de não serem usadas, **não filtravam por empresa**;
- duas rotas de API de lembrete que nenhuma tela chamou em nenhum momento da história do projeto.

**O que foi deliberadamente mantido:** duas outras rotas antigas continuam de pé de propósito. As
telas que as chamavam saíram há poucos dias, e o app é instalável — um celular que não foi aberto
desde então ainda roda a versão antiga em cache e chamaria essas rotas. Removê-las agora daria
erro na mão de quem está com o app desatualizado. Ficam marcadas no código pra sair numa faxina
futura.

**Dois testes foram corrigidos, não só ajustados.** Os dois procuravam um texto fixo dentro do
código-fonte — e esse texto morava justamente em funções que ninguém chamava. Ou seja: ficavam
verdes enquanto o que eles diziam proteger podia perfeitamente não estar acontecendo. Um deles
supostamente garantia que **as regras que o dono escreve no Cérebro chegam na inteligência
artificial**. Foi conferido caminho por caminho: **chegam sim** — mas por outro trajeto, não pelo
que o teste vigiava. Agora os dois verificam o efeito real.

---

## Validação feita antes de publicar

| Verificação | Resultado |
|---|---|
| `npm ci` | ok |
| Suíte completa | 270 testes verdes |
| Suíte em 5 datas (seg, qua, **sáb**, **dom**, dia 31) | verde nas cinco |
| `npm run build` | 27 arquivos publicados, versão 1092 |
| Verificação de sintaxe em todo o código | sem erro |
| Verificação visual no navegador de verdade | ok (abaixo) |

**Verificação visual** (obrigatória por regra do projeto): as páginas de Privacidade e Termos —
que o dono flagrou "cortando o início" — foram abertas num navegador real em três tamanhos de tela
(celular 390, celular pequeno 320 e computador 1440). Nas seis combinações o começo da página
aparece inteiro, e não há rolagem lateral. O app principal abre sem nenhum erro e mostra 1092.

**Limitação do ambiente, dita abertamente:** esta sessão não tem acesso ao banco de produção nem
aos registros do servidor. Tudo acima foi verificado localmente, com bancos de mentira que imitam
o comportamento real. A migração abaixo precisa ser aplicada por uma pessoa.

---

## Migração do banco (opcional, pode esperar)

`supabase/migrations/0010_dedupe_indexado.sql` — deixa a importação bem mais rápida em carteiras
grandes.

- **É opcional.** Sem ela o app funciona igual, só mais devagar. Não é urgente.
- **É aditiva.** Só cria colunas e índices novos; não altera nem apaga nada.
- **Pode ser aplicada com o app no ar**, sem parada.
- Como aplicar: Supabase → SQL Editor → colar o arquivo inteiro → Run. O jeito de desfazer está
  escrito dentro do próprio arquivo.

---

## Arquivos alterados

**Código:** `api/_persistence.js`, `api/_pipeline.js`, `api/lead-update.js`,
`api/restaurar-leads.js`, `app.js`, `contas-config.js`, `contas-estilo.css`

**Versão:** `package.json`, `package-lock.json`

**Banco (novo):** `supabase/migrations/0010_dedupe_indexado.sql`

**Documentação:** `ESTADO-ATUAL.md`, `NOTAS-v1092.md` (novo)

**Testes (novos):** `tests/run-all.mjs`, `tests/v1092-importacao-integracao.test.mjs`,
`tests/v1092-gravacao-nunca-inventa-nem-descarta-campo-critico.test.mjs`,
`tests/v1092-chave-compartilhada-so-empresa-principal.test.mjs`

**Testes (atualizados):** `tests/aprendizado-continuo.test.mjs`,
`tests/v858-cerebro-blocos-texto.test.mjs`, `tests/v979-zip-seguro-rota-compat-perf.test.mjs`,
`tests/v999-organizacao-nas-acoes-do-lead.test.mjs`,
`tests/v1023-agendamento-so-por-clique-nunca-por-texto.test.mjs`,
`tests/v1085-import-nao-perde-cache-de-audio.test.mjs`
