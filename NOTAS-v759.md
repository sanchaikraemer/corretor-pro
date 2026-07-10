# Corretor Pro — v759

Correção do Cérebro Comercial e uso real do prompt mínimo.

## O que foi corrigido

- A análise agora recebe o Cérebro salvo no navegador quando a tabela `direciona_config` não existe no Supabase.
- Importação ZIP envia `cerebroConfig` local para o backend na etapa de análise.
- Reanálise manual envia `cerebroConfig` local para o backend.
- Reanálise em massa/segundo plano também passa o Cérebro local quando aplicável.
- Backend aceita `cerebroConfigOverride` e usa ele antes de tentar carregar o banco.
- Se houver Cérebro salvo no banco, segue usando banco; se não houver, usa o que está no app/localStorage.

## Por que isso importa

Antes, a tela do Cérebro podia mostrar o prompt salvo localmente, mas a API não recebia esse prompt quando a tabela do banco não existia. Agora a análise não depende mais da tabela existir para usar o prompt configurado no app.

## Observação importante

A tabela `direciona_config` ainda é recomendada para persistir entre aparelhos/navegadores. Sem ela, o app usa o Cérebro salvo no navegador atual.

SQL sugerido no Supabase:

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
- Build gerou Atualização #759.
