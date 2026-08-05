# v1148 — juntar cadastros do mesmo cliente + agendar marca atendimento

Dois pedidos do dono na sequência (05/08/2026).

## 1. "sim, mesma pessoa" — agora dá pra JUNTAR, não só apagar

Ele atendeu um cliente e a lista "Sem atender 30d+" seguia mostrando a MESMA pessoa num segundo
cadastro, com outro nome. Isso nasce quando o arquivo exportado do WhatsApp vem com nome diferente
em cada importação. Até aqui o app só sabia **apagar** duplicata — e apagar **perde a conversa** de
um dos dois.

Agora, no cliente → **Gestão → "Juntar cliente duplicado"**: ele escolhe (com busca) o cadastro que
é a mesma pessoa, confirma, e:

- as **duas conversas viram uma só**, sem repetir mensagem (a mesma mesclagem que a reimportação
  usa);
- a análise mais recente prevalece, mas o que é **decisão dele no cadastro que fica** — etapa,
  lembrete, memória escrita à mão — nunca é sobrescrito pelo que sai;
- o duplicado é apagado **somente depois** de a fusão estar gravada (se a gravação falhasse, nada
  se perderia), com a mesma faxina completa do "apagar" (arquivos, aprendizado, vínculos);
- se o duplicado não puder ser apagado na hora, a conversa já está junta e ele é avisado — nunca
  fica um sumiço silencioso;
- fica registrado no cadastro o que foi juntado e quando (`_clientesJuntados`).

## 2. "se for feito agendamento, tem que marcar como atendido também"

Palavras dele: *"como se copiasse sugestão de msg, entendeu?"*. Faz sentido — agendar um retorno é
uma ação real com aquele cliente naquele dia. Agora **Agendar grava o mesmo evento de atendimento**
que a cópia de mensagem e o botão "Marcar" já gravavam:

- um agendamento por dia = um atendimento (agendar de novo no mesmo dia atualiza a hora, não conta
  dois);
- a tela marca na hora, sem esperar a carteira recarregar, e o aviso diz "Agendado para DD/MM — e
  marcado como atendido hoje";
- consequência prática: o cliente que ele acabou de agendar **sai da fila do dia** e do "sem
  atender", como já acontecia ao copiar uma mensagem.

## Validação

| Verificação | Resultado |
|---|---|
| Suíte completa | 321 testes verdes |
| Teste novo | `v1148-juntar-clientes-e-agendar-marca-atendido` (fusão usa as mesmas mesclagens; presa à empresa; grava ANTES de apagar; decisões do cadastro que fica prevalecem; aviso se o duplicado não sair; botão + confirmação nomeando os dois; agendar grava contato_manual, um por dia, e a tela marca na hora) |
| `npm run build` | ok, versão 1148 |

## Arquivos alterados

**Código:** `api/lead-update.js`, `api/reanalisar-lead.js`, `api/_persistence.js` (exporta a
mesclagem de análise), `app.js`

**Documentação:** `NOTAS-v1148.md` (novo), `ESTADO-ATUAL.md` (rota nova citada)

**Versão:** `package.json`, `package-lock.json`

**Testes:** `tests/v1148-juntar-clientes-e-agendar-marca-atendido.test.mjs` (novo),
`tests/v956-atualizar-usa-mescla-v900.test.mjs` (lista de importados cresceu)
