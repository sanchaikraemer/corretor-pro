# Corretor Pro — Atualização v746

## Revisão geral da inteligência comercial

Esta versão reorganiza as regras do prompt em uma hierarquia única de raciocínio, para evitar que novas regras apaguem regras anteriores.

### Hierarquia aplicada

1. Compromisso pendente do corretor
2. Ação já autorizada pelo cliente
3. Material ou informação já enviados
4. Perguntas já respondidas
5. Pendência financeira ou de escolha
6. Direcionamento comercial feito pelo corretor
7. Mudança real de jornada causada pelo cliente
8. Retomada por tempo parado
9. Avanço natural do funil

### Ajustes práticos

- Tempo parado agora altera o tom da mensagem, mas não substitui pendência concreta.
- Mudança de jornada não pode apagar simulação pendente, pergunta respondida ou material já enviado.
- Compromisso pendente do corretor tem prioridade máxima.
- Fallbacks agora obedecem um cenário principal, em vez de várias regras competirem entre si.
- Ajustada a linguagem de simulação pendente para ficar mais humana: “ficou pendente da minha parte...”

### Testes

- npm test
- npm run build
