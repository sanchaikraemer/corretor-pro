# v1146 — a carteira para de "travar" (a causa era minha) e a opção copiada volta a ficar coral

Três prints do dono em 05/08/2026, todos depois das minhas próprias atualizações do dia:

1. **19:04** — "carregou por cerca de 30 segundos, porém travou nessa tela" (tela com os quadros
   vazios do carregamento).
2. **19:06** — "e agora mudou pra essa e travou de novo": *"Carregando os leads… Buscando sua
   carteira atualizada"* — parado ali por mais de dois minutos.
3. **19:12** — "por que não ficou vermelho o 'copiar' quando clico, como era antes?"

## O app não estava travado: estava esperando. E fui eu que aumentei essa espera

A v1140 (de hoje) deu 65s à busca da carteira — isso está certo, porque a rota tem 60s de teto no
servidor e desistir aos 15s era desistir com o servidor ainda trabalhando. O erro foi **repetir
sempre**: quando a primeira tentativa queimava os 65s inteiros, a segunda dobrava a espera —
**mais de dois minutos de rodinha muda**, que é indistinguível de travar.

Agora:

- **A segunda tentativa é condicional**: só quando a primeira falha RÁPIDO (menos de 20s), que é o
  perfil de tropeço de rede — o caso que repetir realmente conserta. Se a primeira já esperou
  muito, o controle volta pra tela avisar, em vez de sumir por outro minuto.
- **A tela mostra o relógio e a saída**: a partir de 6s aparece "Buscando sua carteira… 12s"
  (contando de 1 em 1 segundo, prova de que está vivo) e, aos 12s, os botões **"Tentar de novo"** e
  **"Abrir Atendimentos"** — sem cancelar a busca em andamento: se ela chegar, a Home desenha
  normal por cima.
- **O aviso não depende mais da tela ativa.** Esse detalhe é o que explica o print das 19:06: a
  mensagem só era atualizada se a tela ativa fosse a Home naquele instante; fora isso, o texto
  ficava congelado pra sempre. Agora quem manda é o que está escrito na área de carregamento.

## Por que a carteira demorava tanto (a causa no servidor)

O número de mensagens, "dias desde o último toque" e a prévia de cada cliente ficam guardados num
cache por lead, e esse cache **vence por dia** — ou seja, **à meia-noite ele vence para a carteira
inteira de uma vez**. Na primeira carga depois disso, a listagem buscava a conversa de **todos** os
clientes numa única ida (megabytes, em fatias de 50, uma atrás da outra) e depois tentava regravar
o cache com um orçamento de tempo tão curto (1,5s) que **quase nada grudava**. Resultado: a carga
seguinte repetia o mesmo trabalho condenado. Ficava preso nesse ciclo.

Correções:

- **Teto de leituras por carga** (150, ajustável por variável de ambiente): cada carga faz um
  pedaço e **sempre responde rápido**; a carteira esquenta em algumas cargas.
- **Prioridade certa nesse pedaço**: (1) cliente sem cache nenhum — se ficasse de fora apareceria
  zerado; (2) cliente que mudou de verdade (números errados); (3) cliente cujo cache só é de outro
  dia — esse é o que espera a próxima carga, exibindo os números de ontem, que era exatamente o que
  a v1136 já considerava aceitável ("números de ontem na tela são melhores que zerar tudo").
- **Orçamento de gravação de 1,5s → 6s**: com o teto acima, o volume por carga é pequeno e
  conhecido, então o trabalho feito agora **gruda** — é isso que faz a próxima carga ser rápida.
  Continua sendo um teto: banco lento não segura a resposta pra sempre.
- A resposta passou a informar quanto ficou pendente (`statsPendentes`) e quanto foi recalculado,
  pra dar pra ver, num diagnóstico, se a carteira está esquentando ou parada.

## A opção copiada volta a ficar coral (e melhor que antes)

O coral que ele viu "antes" era só o efeito do botão pressionado. A **v1142** (minha, de hoje)
passou a redesenhar o cliente imediatamente após copiar — pra mostrar "Atendido" na hora — e esse
redesenho trocava o botão por um novo, apagando o efeito. Correção honesta: em vez de depender de
um efeito de toque, a marca agora é **de verdade**:

- a opção copiada fica com **borda e fundo coral** e o botão dela vira **"Copiado"** em coral cheio;
- a marca **sobrevive ao redesenho** (é reaplicada a cada desenho da tela);
- ela vale só para **aquele cliente** e só enquanto **o texto daquela opção for o mesmo** — análise
  nova troca as mensagens, e mensagem nova não herda marca de cópia antiga.

Detalhe que quase passou: no **tema claro** existem blocos antigos com `!important` que forçam
branco nesses mesmos elementos (a lição da v1078, registrada em `CLAUDE.md`). Sem a mesma força, o
coral não apareceria lá — a marca do tema claro foi escrita com `!important` por isso.

## Validação

| Verificação | Resultado |
|---|---|
| Suíte completa | 319 testes verdes |
| Teste novo | `v1146-carteira-nao-trava-e-copia-marcada` (teto e prioridade das leituras; orçamento de gravação ainda limitando com banco lento — provado com relógio de verdade; 2ª tentativa condicional; espera com relógio e sem depender da tela ativa; marca da cópia por cliente + texto, nos dois temas) |
| Testes ajustados | `v1140` (a espera da Home mudou de desenho), `v1087` (orçamento de gravação), `v1077` (o vigia reconhece as mensagens novas de espera) |
| `npm run build` | ok, versão 1146 |
| **Navegador de verdade** | Chromium headless, tema escuro E claro: a opção copiada mede borda `rgba(255,98,88,.75)` / fundo `rgba(255,98,88,.12)` e botão `rgb(255,98,88)` com o rótulo "Copiado"; a opção não copiada permanece neutra. Print conferido. |

## Arquivos alterados

**Código:** `app.js`, `styles.css`, `api/_persistence.js`

**Documentação:** `NOTAS-v1146.md` (novo)

**Versão:** `package.json`, `package-lock.json`

**Testes:** `tests/v1146-carteira-nao-trava-e-copia-marcada.test.mjs` (novo),
`tests/v1140-importacao-e-carteira-sem-estourar-tempo.test.mjs`,
`tests/v1087-primeira-abertura-do-dia-nao-trava.test.mjs`,
`tests/v1077-carregando-rodinha-coral.test.mjs`
