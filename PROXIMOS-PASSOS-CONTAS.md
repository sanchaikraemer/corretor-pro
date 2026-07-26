# Contas individuais + parede entre empresas — status pra quando você acordar

## O que eu fiz enquanto você dormia

1. **Protótipo visual** (`prototipo-contas-empresas/`) — já aprovado por você, com a cara real
   do Corretor Pro. Continua isolado, não afeta o site no ar.
2. **A receita real do banco de dados** (`supabase/migrations/`) — duas migrações prontas:
   - `0001_contas_e_empresas.sql`: cria as tabelas de empresa/usuário e a cerca automática.
   - `0002_migrar_dados_existentes.sql`: encaixa sua carteira de hoje dentro da "Empresa 1",
     sem perder nada.
   - **Testei as duas rodando de verdade** num banco igual ao seu, simulando duas empresas —
     confirmei que uma nunca enxerga nem consegue forçar ver os dados da outra. Detalhes em
     `supabase/migrations/README.md`.

Nada disso foi publicado. Nada do site que está no ar foi tocado.

## O que falta — e por que eu parei aqui

Pra continuar (fazer o sistema realmente logar com conta individual, e não mais com a chave
única), eu preciso de uma de duas coisas, porque não tenho acesso ao seu Supabase real nesta
sessão:

- **Opção A** — você aplica as duas migrações (é copiar e colar, 2 cliques, o passo a passo tá
  no README) e me avisa. Eu sigo o resto sem precisar de mais nada seu além disso.
- **Opção B** — você me dá acesso ao projeto Supabase (URL + chave), e eu aplico e sigo direto.

Depois disso, o que falta é: trocar a tela de "digite a chave" pela tela de entrar de verdade, e
fazer o sistema consultar o banco "como você", não mais "como administrador" — essa parte eu
quero testar com uma conta real antes de publicar, não às cegas.

## Se você não fizer nada ainda

Sem problema — o sistema continua funcionando exatamente como hoje, do jeito que você está
acostumado. Essa mudança só acontece quando você decidir seguir.
