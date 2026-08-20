# v1325 — a trava que não depende de ninguém lembrar

> Este trabalho nasceu numerado como v1324 e foi renumerado para 1325 na hora de publicar: outra
> sessão publicou a v1324 (fala de funil e produto largado por preço) enquanto ele estava em
> andamento. Nada do conteúdo mudou por causa disso.

Terceiro bloco da auditoria de 20/08/2026. As duas primeiras (v1322 e v1323) resolveram o
que era risco imediato e o que estava errado na tela. Esta resolve três coisas que a auditoria
apontou como **desenho frágil**: proteções que funcionam hoje só porque as pessoas estão lembrando
delas.

## 1. Uma conta nunca ver dados de outra deixou de ser questão de memória

O texto da auditoria é direto:

> "O banco possui RLS. Porém o backend utiliza `service_role`, e `service_role` ignora a RLS.
> Portanto hoje a defesa real é: cada programador lembrar de colocar
> `.eq("organization_id", organizationId)` em toda consulta. Revisei as rotas atuais e a disciplina
> está boa. Mas basta **uma** rota futura esquecer o filtro."

Não há vazamento hoje — conferi as 91 consultas que existem. O problema é a próxima consulta,
escrita com pressa num dia qualquer. Agora existe uma guarda automática: a suíte varre a pasta
`api/` inteira e **reprova** qualquer consulta às tabelas que têm dono (as conversas/leads, as
configurações do Cérebro e o registro de uso de IA) que não filtre pela empresa.

Exceção continua podendo existir — mas tem que ser **declarada no código, com motivo escrito**
(o comentário `multiempresa-ok:`). Hoje são duas: o construtor de consulta da carteira (quem usa
filtra, logo abaixo) e a gravação do backup restaurado (cada linha já carrega a empresa dona). Se
um dia passarem de quatro, a própria guarda reprova — exceção demais é trava virando fachada.

## 2. Teste vermelho não vai mais pro ar

A auditoria: *"o CI executa, mas não bloqueia o merge; push em main faz a Vercel publicar
automaticamente. Ou seja: teste vermelho ≠ produção bloqueada."*

A trava foi posta no ponto que ninguém contorna sem querer — **a própria publicação**. A Vercel
passa a publicar com `npm test && node build.js`: se a suíte estiver vermelha, o build falha e
**a versão anterior continua no ar**, intacta. Custa cerca de 1min30 a mais por publicação, que é
barato perto de publicar quebrado.

Duas consequências práticas:

- a instalação na Vercel passou a ser `npm ci --include=dev` (sem isso, três guardas de código
  morto ficariam sem a biblioteca que leem o código, e derrubariam a publicação por falta de
  ferramenta, não por defeito);
- em emergência dá pra publicar sem a suíte trocando o comando de build no painel da Vercel. É
  saída de incêndio, não caminho normal — e está escrito assim na documentação.

Falta **um clique, e só o dono pode dar**: marcar o check `testes` como obrigatório no GitHub
(Settings → Branches/Rules), pra impedir também a mesclagem de código vermelho, não só a
publicação. O passo a passo está em `ESTADO-ATUAL.md`, seção 5-C.

## 3. A configuração do servidor passou a ser conferida — e aparece na tela

A auditoria contou 55 variáveis de ambiente sem nenhuma validação. Neste projeto o erro típico é
duplamente silencioso:

- **nome digitado errado** na Vercel não é lido por ninguém. Quem escrever
  `DIRECIONA_LIMITE_LEITURA_VISUAL` (sem o `_DIA`) jura que configurou o teto — e o app segue no
  valor de fábrica;
- **valor no formato errado** também não avisa. Quase toda chave de liga/desliga daqui só liga com
  o valor exato `1`; escrever `true` deixa a chave desligada.

Agora existe `api/_config.js`: o catálogo das **74 variáveis** que o código lê, cada uma com o que
faz (em português, sem jargão — o texto vai pra tela), o formato esperado e se é obrigatória. A
conferência compara o catálogo com o que está no ar e devolve os problemas: obrigatória faltando,
número escrito como palavra, endereço sem `https://`, chave curta demais, chave que "parece
ligada" e não está, e **variável deste projeto que ninguém lê** — com sugestão do nome certo
("você quis dizer DIRECIONA_LIMITE_LEITURA_VISUAL_DIA?").

Onde isso aparece:

- **no painel administrativo**, num cartão novo — **Saúde da configuração** —, irmão do cartão da
  saúde do banco: diz se está tudo certo, o que precisa arrumar, o que está sem efeito, e onde
  arrumar (Vercel → Settings → Environment Variables). Nenhum valor de chave é mostrado, nunca;
- **no registro do servidor**, uma vez por acordar, quando houver erro — quem publica vê na hora,
  em vez de descobrir quando um corretor esbarra na função que dependia daquilo.

O catálogo não pode envelhecer: a suíte falha se o código passar a ler uma variável que não está
nele, ou se ele guardar uma que o código não lê mais.

## 4. Miudeza que a auditoria também pegou

`MIGRACAO_MINIMA_EXIGIDA` estava em 18 com a migração 0019 já no repositório. Subiu para 19. A 0019
é aditiva (só reescreve a função de conferência pra ela reportar também o baseline), então aplicá-la
num banco que já roda não muda dado nenhum — e agora o diagnóstico cobra isso corretamente.

## Verificação

- Guardas novas: `tests/v1325-isolamento-entre-empresas-na-guarda.test.mjs` (91 consultas
  conferidas, 2 exceções declaradas), `tests/v1325-configuracao-catalogada.test.mjs` (catálogo
  completo, conferência pegando cada tipo de erro, nenhum segredo vazando na resposta) e
  `tests/v1325-publicacao-nao-sobe-com-teste-vermelho.test.mjs`.
- `tests/v1043` guardava que o CI rodava em push pro `main`; agora ele roda em push de qualquer
  branch, e o teste foi atualizado pra aceitar os dois.
- Chromium (390px e 1280px): o cartão novo do painel, no tema escuro. A 390px os nomes longos de
  variável empurravam a página pro lado — corrigido com quebra de linha própria (`.config-item`) e
  reconferido.
- `npm test`: 31 arquivos checados + 472 testes, verdes (já com a v1324, publicada em paralelo).

## O que a auditoria ainda pede, e não entrou aqui

Anonimizar o aprendizado reaproveitado entre clientes; dividir os arquivos gigantes; bateria
comercial maior como porteiro das mudanças de prompt; medir o resultado real da condução; fuso
horário por conta. Nada disso é conserto — são obras, cada uma com sua versão.
