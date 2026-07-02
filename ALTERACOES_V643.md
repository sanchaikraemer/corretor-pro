# Alterações V643 — Home estratégica menos poluída

## O que foi ajustado

- Cards superiores alterados para: Prioridade hoje, Muito quentes, Retornos prometidos e Visitas agendadas.
- Bloco compacto "O sistema percebeu" adicionado acima da lista de leads.
- Lista de prioridades agora mostra ranking, produto, status comercial, motivo objetivo e CTA "Ver diagnóstico".
- Removido o conceito de CTA genérico "Retomar agora/Retomar hoje" na Home.
- CSS mobile ajustado para manter a tela mais limpa e legível.
- Versão elevada para #643 e cache bust atualizado para evitar exibir versão antiga.

## Validação feita

- `node --check app.js`
- `node --check public/app.js`
- `node --check service-worker.js`
- Conferência por busca das labels novas e remoção dos CTAs antigos na Home.
