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

- **Botão "‹ Voltar" repaginado**: o `.cp704-back` (o botão mais usado no lead) era só texto
  apagado (transparente, cor `--muted`, sem borda). Virou um pill: borda, fundo sutil, cantos
  arredondados, cor mais viva e hover com um toque coral. Mesmos tokens do app (dois temas).

- **Importação some entre aparelhos (Ctrl+Shift+R não resolve)**: importar uma conversa num
  aparelho atualizava nele, mas no PC não aparecia nem com hard refresh. Causa: `leads-recentes`
  tem cache de 30s por instância no backend; a carga fria da página buscava SEM `fresh=1` e
  aceitava o snapshot velho (e a Vercel pode ter várias instâncias warm, cada uma com seu
  snapshot). Correção: `_leadsForceFresh` começa `true`, então a PRIMEIRA busca após abrir/
  recarregar a página força `fresh=1` e ignora o cache do servidor. As buscas seguintes na
  sessão voltam a usar o cache normal. (Não deu pra validar em produção nesta sessão; se ainda
  falhar, a causa é mais profunda — ex.: a importação não commitou de fato no banco compartilhado.)

- **Desempenho sem painel duplicado**: a tela mostrava os mesmos números em dois painéis
  ("Visão geral da carteira" + "Ritmo comercial"). O de baixo (`#relatorioBody`, renderizado
  por `renderDesempenhoDash`) foi removido do HTML; `carregarRelatorio` vira no-op (o `qs`
  devolve null). Ficou só o painel completo de cima.
- **Menu (Configurações) sem repetir o menu lateral**: saíram os cards que apontavam pro mesmo
  destino de um item da barra lateral — Condução do atendimento (Condução), Agenda, Gerador de
  proposta (Propostas), Cérebro Comercial (Inteligência Comercial), Relatório (Desempenho) e
  Arquivados. Ficaram os que a lateral não tem: Importar conversa, Como usar, O que a IA
  aprendeu, Vendas registradas, Instalar app.
- **Reanalisar em destaque**: no topo do lead, o "Reanalisar" virou o PRIMEIRO botão e ganhou
  um realce ciano (cor de "análise/dados" do app), destacando-se dos demais (âmbar/verde).

## Verificação

- Novo teste `tests/v866-hero-acoes`: garante que o `.h-wa`/botão WhatsApp e o "Copiar
  mensagem" saíram do hero, e que sobraram "Ver histórico" e "Já falei".
- Novo teste `tests/v866-botao-voltar`: garante que o "‹ Voltar" virou pill (borda,
  border-radius, sem fundo transparente) e ganhou hover.
- Novo teste `tests/v866-cold-load-fresh`: carga fria força fresh=1.
- Novo teste `tests/v866-desempenho-legivel`: fontes do Desempenho >= legíveis.
- Novo teste `tests/v866-ui-limpeza`: painel duplicado removido, Menu sem repetir a lateral,
  Reanalisar em destaque e como primeiro botão. `v823-topo-acoes` atualizado pra nova ordem.
- `npm test`: suíte completa verde.
