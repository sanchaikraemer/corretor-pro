# v866 — limpeza do hero "Prioridade agora" (em andamento)

Versão que agrupa ajustes pedidos depois da v865. **Ainda não publicada** — juntando
mudanças até o dono mandar subir.

## Mudanças

- **Botão verde grande do WhatsApp removido do hero**: no card "Prioridade agora" da Home,
  o botão `WhatsApp` (`.h-wa`) foi retirado — o dono achou "feio e gigante". Restam
  "Copiar mensagem" (quando há mensagem), "Ver histórico" e "✓ Já falei". Abrir o lead pelo
  card continua funcionando; o WhatsApp segue disponível dentro do lead e nas linhas de
  "Próximos atendimentos".

- **"Copiar mensagem" só aparece quando há mensagem pronta**: o botão era mostrado sempre e,
  quando o lead não tinha mensagem gerada, copiava string vazia e ainda dava o toast
  "Mensagem copiada". Agora o hero calcula `msgHero` e só mostra o botão se existir mensagem.
  Como reforço, `copiarMensagemLead` passou a avisar ("Sem mensagem pronta pra este lead.
  Abra o lead e reanalise pra gerar.") em vez de fingir que copiou.

## Verificação

- Novo teste `tests/v866-hero-acoes`: garante que o `.h-wa`/botão WhatsApp saiu do hero, que
  "Copiar mensagem" é condicionado a `msgHero` e que `copiarMensagemLead` avisa quando não há
  mensagem.
- `npm test`: suíte completa verde.
