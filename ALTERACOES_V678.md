# Alterações v678

## O que foi ajustado

- move o botão **Incluir manual** para o centro da barra inferior no mobile, usando o espaço entre Atendimentos e Propostas;
- remove o botão manual duplicado do topo das telas Hoje e Atendimentos;
- corrige a visibilidade do FAB central, que estava ocupando espaço mas sem aparecer;
- adiciona leitura determinística para casos em que a conversa muda de contexto (ex.: começou em assunto de trabalho e depois virou interesse em imóvel);
- nesses casos, prioriza o interesse imobiliário mais recente para oportunidade, relacionamento, próxima ação e impedimento principal.

## Arquivos principais alterados

- `app.js`
- `index.html`
- `styles.css`
- `service-worker.js`
- `package.json`
- `RESTORE_POINTS.md`
