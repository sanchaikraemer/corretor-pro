# Arquitetura atual das análises e mensagens

**Versão operacional:** 618  
**Identificador da arquitetura:** `gpt55-unificado-v2` (carimbo de versão; **é opaco** — não descreve o modelo)  
**Modelo real:** `gpt-4.1` via Chat Completions (`DIRECIONA_MAIN_MODEL`, default `gpt-4.1`).

> O identificador histórico `gpt55-unificado-v2` é mantido só para comparar análises antigas. O modelo em uso é o `gpt-4.1` — não existe GPT-5.5 no caminho atual.

Este arquivo é a fonte única da arquitetura de análise comercial do Direciona.

## Fluxo ativo

1. O ZIP do WhatsApp é lido e os áudios são transcritos.
2. A linha do tempo cronológica completa é montada.
3. Primeira chamada do modelo (gpt-4.1) gera o diagnóstico completo:
   - diagnóstico;
   - pendência aberta;
   - próxima ação;
   - prioridade e leitura comercial.
4. Segunda chamada do modelo, com base no diagnóstico acima, gera as três sugestões de mensagem (a/b/c).
5. O backend aplica uma limpeza cosmética determinística (remove emoji e espaços/quebras repetidos, sem reescrever palavras) e então valida defeitos objetivos, sem escrever frases.
6. Quando uma sugestão é reprovada, o mesmo modelo recebe a conversa completa, o diagnóstico e os defeitos encontrados e faz uma única revisão.
7. Se a revisão continuar reprovada, nenhuma mensagem comercial é inventada. O lead fica marcado para reanálise.
8. O front-end exibe exatamente as mensagens aprovadas pelo backend.

## São sempre 3 mensagens (a/b/c)

- **a — Direta:** vai direto ao ponto e propõe o próximo passo. É a recomendada para mandar agora.
- **b — Consultiva:** tira dúvida / traz informação de valor.
- **c — Retomada:** reabre uma conversa parada sem soar genérico.

As regras de geração e de validação das três mensagens vêm de uma **fonte única** no código (`REGRAS_MSG`/`REGRAS_MSG_PROMPT` em `api/_pipeline.js`), para o prompt e o validador nunca divergirem.

## O que não existe no fluxo comercial

- Claude ou Anthropic;
- segunda IA escrevendo as mensagens;
- template por palavra-chave;
- fallback contextual escrito em JavaScript;
- complemento automático de saudação;
- reescrita, corte ou resumo de palavras da mensagem (a limpeza só remove emoji/espaços, nunca altera o texto);
- validação comercial duplicada no navegador;
- reaproveitamento de sugestões de outro lead;
- exibição de mensagem antiga sem a marca da arquitetura atual.

## Validação permitida

O backend pode somente aprovar ou reprovar por critérios objetivos, por exemplo:

- mensagem vazia ou curta demais;
- mensagem duplicada;
- mais de uma pergunta principal;
- termo expressamente proibido;
- saudação sem conteúdo;
- tratamento do corretor parceiro como comprador;
- repetição de pergunta financeira já respondida;
- rótulo vazio, genérico ou inadequado.

A validação nunca produz uma nova frase. Uma nova frase só pode vir do modelo (gpt-4.1).

## Compatibilidade com análises antigas

Análises anteriores a `gpt55-unificado-v2` não são reutilizadas como sugestões atuais. A tela pede reanálise. Isso impede que mensagens geradas por arquiteturas antigas reapareçam depois da atualização.

## Aprendizado automático

Por padrão, nenhum conhecimento ou estilo extraído automaticamente de outros leads entra na análise atual.

Só é habilitado de forma explícita:

- `DIRECIONA_USAR_APRENDIZADO_AUTO=1`
- `DIRECIONA_USAR_CONHECIMENTO_AUTO=1`
- `DIRECIONA_USAR_ESTILO_AUTO=1`

Sem essas variáveis, a análise usa a conversa atual, a memória manual confirmada, o catálogo e as regras manuais do Cérebro.

## Outros fallbacks técnicos

Podem existir fallbacks técnicos fora da escrita comercial, como leitura de visão ou catálogo indisponível. Eles não podem criar nem substituir mensagens de WhatsApp.
