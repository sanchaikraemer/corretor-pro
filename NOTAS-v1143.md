# v1143 — importação pequena para de pagar pedágio: uma viagem em vez de duas

Reclamação do dono (05/08/2026): **"quando exporto a análise mesmo com 2 ou 3 mensagens e sem
áudio, demora demais, está impraticável; qualquer corretor desiste com essa demora."**

Numa conversa dessas não existe nada pra transcrever e a conversa é minúscula — ou seja, o tempo
não estava no trabalho, estava na **estrutura em volta do trabalho**. Foi isso que esta versão
cortou. O que sobra de espera agora é a IA escrevendo (ver "O que ainda demora", no fim).

## 1. Preparar e analisar na MESMA ida ao servidor

Toda importação fazia duas viagens separadas: "preparar" (abrir o ZIP) e "analisar". Cada viagem
tem partida a frio da função, gravação e leitura do arquivo de controle da importação, e a conversa
inteira subindo de volta no corpo do pedido.

Quando **não sobrou áudio pra transcrever** (nada a fazer entre as duas etapas) e a conversa é
pequena, a análise agora sai **junto** da preparação — e sem nenhuma leitura extra no banco: a
busca que já procura o cache de áudio do cliente traz, na mesma consulta, a conversa salva e a
análise salva de que a análise precisa.

Proteções: só acontece sem áudio pendente e com conversa pequena (a função tem 60s de teto; num ZIP
grande a extração já come tempo demais pra caber junto). Qualquer problema na análise junta e a
resposta volta como sempre — o app faz a chamada separada, com todas as redes de proteção que já
existiam. E numa **retentativa** o app nunca pede a análise junto: se a primeira tentativa morreu
no teto de tempo, a análise pode ter sido feita e paga sem a resposta chegar; repetir só a
preparação (que é idempotente) nunca paga duas vezes.

## 2. A busca de "esse cliente já existe?" parou de baixar a carteira inteira

Essa busca roda **duas vezes por importação** (ao preparar e ao salvar) e precisa de duas coisas:
telefone e nome do cliente. Só que ela trazia a **análise inteira** — diagnóstico, três mensagens,
memória, histórico — de **até 5 mil clientes**, duas vezes, em toda importação. Numa carteira de
verdade são megabytes de tráfego e segundos de espera até numa conversa de 2 mensagens.

A v1086 já tinha tirado a conversa (`timeline_json`) dessa consulta; ficou faltando a análise.
Agora o banco devolve só o telefone e o nome, extraídos direto do JSON, e o cliente **encontrado**
tem a conversa e a análise buscadas numa consulta pontual (uma linha, não cinco mil). Se a versão
do banco não aceitar essa forma de pedir, cai sozinho na consulta antiga — otimização nunca pode
custar um cliente não encontrado.

## 3. Depois de salvar, nada pesado segura a abertura do cliente

- A **faxina dos arquivos temporários** (3 exclusões no armazenamento) era esperada com o corretor
  olhando "Salvando". Ela não muda nada do que ele vê: agora roda por trás. Se falhar, a faxina
  periódica refaz, e o lead está salvo de qualquer jeito.
- A **recarga da carteira inteira** — a busca mais pesada do app — também era esperada antes de o
  cliente abrir, mesmo com o cliente já vindo confirmado do banco na linha anterior. Agora roda por
  trás e as seções da Home se atualizam quando os dados chegam.
- O que é **local e rápido** continua esperado de propósito: apagar do aparelho o ZIP
  compartilhado. Sem isso, um ZIP antigo pode ser reprocessado depois — importação paga de novo.

## O que ainda demora (e é honesto dizer)

Depois destes cortes, a espera restante de uma importação pequena é **a IA escrevendo a análise**:
o diagnóstico e as três mensagens, com todo o Cérebro do corretor no contexto. Isso não é estrutura,
é o trabalho — e leva de 15 a 30 segundos no modelo atual, independentemente do tamanho da conversa
(uma conversa de 3 mensagens gasta quase o mesmo tempo que uma de 300, porque o que pesa é o que a
IA **escreve**, não o que ela lê).

Para descer disso existem dois caminhos, e a escolha é comercial, não técnica:

1. **Modelo mais rápido na importação** (o modelo é configurável por variável de ambiente na
   Vercel, sem publicar nada): cai para algo em torno da metade do tempo, com redação um pouco
   menos afiada nas três mensagens. O "Reanalisar" continuaria no modelo bom.
2. **Encurtar o que a IA precisa escrever**: o diagnóstico tem 12 campos e a tela mostra poucos.
   Cortar os que ninguém lê reduz o tempo sem mexer no que aparece — mas mexe no formato do que
   fica salvo, então merece uma versão dedicada, com o dono sabendo o que sai.

## Validação

| Verificação | Resultado |
|---|---|
| Suíte completa | 316 testes verdes |
| Teste novo | `v1143-importacao-pequena-em-uma-viagem` (análise junta só sem áudio pendente e com conversa pequena; app não repete a análise; retentativa não pede junto; varredura leve encontrando o cliente **com banco de mentira**; nada pesado esperado antes de abrir o cliente) |
| Teste ajustado | `v1028` (guardava a etapa "liberando os arquivos temporários" como espera — ela deixou de ser espera) |
| `npm run build` | ok, versão 1143 |
| Navegador de verdade | app publicado em Chromium headless: boot sem erro de JS, tela de importação intacta |

## Arquivos alterados

**Código:** `app.js`, `api/processar-storage.js`, `api/_persistence.js`

**Documentação:** `NOTAS-v1143.md` (novo)

**Versão:** `package.json`, `package-lock.json`

**Testes:** `tests/v1143-importacao-pequena-em-uma-viagem.test.mjs` (novo),
`tests/v1028-mensagens-2cliques-e-salvando-sem-feedback.test.mjs`
