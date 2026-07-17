# v866 — limpeza do hero "Prioridade agora" (em andamento)

Versão que agrupa ajustes pedidos depois da v865. **Ainda não publicada** — juntando
mudanças até o dono mandar subir.

## Mudanças

- **Botão verde grande do WhatsApp removido do hero**: no card "Prioridade agora" da Home,
  o botão `WhatsApp` (`.h-wa`) foi retirado — o dono achou "feio e gigante". Restam
  "Copiar mensagem" (quando há mensagem), "Ver histórico" e "✓ Já falei". Abrir o lead pelo
  card continua funcionando; o WhatsApp segue disponível dentro do lead e nas linhas de
  "Próximos atendimentos".

- **"Copiar mensagem" removido do hero**: não fazia sentido — no hero a mensagem nem é
  exibida, então copiar "às cegas" (ainda por cima às vezes vazia) confundia. O botão saiu do
  hero; sobraram "Ver histórico" e "✓ Já falei". Pra ver/copiar mensagem, é dentro do lead.
  (A guarda defensiva em `copiarMensagemLead` — avisar em vez de copiar vazio — ficou, mas a
  função não é mais chamada pelo hero.)

## Verificação

- Novo teste `tests/v866-hero-acoes`: garante que o `.h-wa`/botão WhatsApp e o "Copiar
  mensagem" saíram do hero, e que sobraram "Ver histórico" e "Já falei".
- `npm test`: suíte completa verde.
