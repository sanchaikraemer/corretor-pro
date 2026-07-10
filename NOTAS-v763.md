# v763 — Aviso do Cérebro deixa de parecer erro

## O que foi corrigido

- A linha rosa "Tabela direciona_config não existe..." que aparecia ao salvar o Cérebro não era um bug: a tabela `direciona_config` nunca foi criada no Supabase de produção, então o app salva a configuração só no navegador (localStorage) como já estava previsto no código.
- A mensagem mudou de vermelho/rosa (cor de erro) para amarelo (cor de atenção), e agora explica o que fazer em vez de só apontar o problema técnico.
- Foi adicionado um botão "Copiar SQL" na própria mensagem, que copia o `create table` necessário direto da resposta da API — sem precisar abrir notas ou pedir pro desenvolvedor.

## Causa raiz

A tabela nunca foi criada no banco do Supabase usado em produção. Isso não causa perda de dados (o Cérebro continua funcionando salvo no navegador), mas a configuração não sincronizava entre aparelhos/navegadores diferentes até a tabela existir.

## Status

A tabela `direciona_config` já foi criada em produção com o SQL abaixo, então o aviso deve parar de aparecer nas próximas gravações:

```sql
create table if not exists public.direciona_config (
  chave text primary key,
  valor jsonb,
  atualizado_em timestamptz default now()
);
```

## Testes

- `npm test` passou.
- `npm run build` passou após `npm install`.
