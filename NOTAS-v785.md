# v785 — Limpeza: tira o bloco de preparação da Home e as ferramentas de importação em massa

## O pedido

Com a carteira já em dia, o corretor pediu pra tirar o que não usa mais e enxugar.

## O que saiu

1. **Bloco "Preparação da carteira" da Home** — a barra de progresso no topo da Home. Os dois injetores (cp697 e cp702/703) pararam de desenhar o card; some também a busca da base inteira que ele disparava à toa na Home. CSS de segurança escondendo `#cp697HomeProgress`/`#cp702HomeProgress`.
2. **Ferramentas de importação em massa** (Mais → Configurações): os cards "Restaurar leads da base anterior", "Importar leads (CSV)" e "Importar conversas em lote (ZIP de ZIPs)". Serviram pra montar a carteira; não são mais necessários no dia a dia.

## O que NÃO foi mexido (de propósito)

Os handlers de JS por trás dos botões de importação continuam definidos, mas ficam **inertes** (os botões não existem mais; o código usa `?.` e não roda). Optei por NÃO apagar essas ~250 linhas agora: o app acabou de estabilizar depois de vários bugs, e uma remoção grande e cega é o tipo de mudança que reintroduz problema. Dá pra fazer essa faxina mais profunda depois, com calma e teste.

A rota de restauração automática no boot (`restaurarLeadsAntigos`, guardada por localStorage) foi mantida — já rodou uma vez e não roda de novo.

## Testes

- `npm test` e `npm run build` passaram.
- Falta validar em produção: abrir a Home (sem o bloco) e o menu Configurações (sem os cards).
