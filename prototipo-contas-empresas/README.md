# Protótipo — conta individual + parede entre empresas

Isso é uma maquete pra você ver e clicar antes de a gente aplicar isso de verdade no Corretor
Pro. **Não está ligado ao banco de dados real, não mexe em nenhum cliente de verdade e não faz
parte do site que está no ar.** É um servidor pequeno, isolado, com dados de mentira, só pra
mostrar como o login por empresa e a "cerca" entre os dados vão se comportar.

## Como rodar

```
cd prototipo-contas-empresas
node server.js
```

Abre em `http://localhost:4300`.

## Contas de teste já prontas

| E-mail | Senha | Empresa |
|---|---|---|
| `sanchai@teste.com` | `123456` | Imobiliária Sanchai (exemplo) — 3 clientes de mentira |
| `ana@teste.com` | `123456` | Imobiliária Concorrente (exemplo) — 2 clientes de mentira |

Entre com uma das duas contas e veja que só aparecem os clientes daquela empresa. No painel tem
um botão pra tentar espiar os dados da outra empresa direto pela mesma conta — e o servidor
recusa, provando a cerca.

Também dá pra clicar em "Criar uma empresa nova" e ver que uma empresa recém-criada nasce vazia,
sem herdar nada de ninguém.

## O que isso prova

- Login individual por e-mail/senha em vez da chave única de hoje.
- Cada empresa só enxerga os próprios clientes, mesmo tentando forçar de propósito.
- Empresa nova nasce isolada.

## O que isso NÃO é

Não é a versão final. A versão de verdade vai usar o Supabase (o banco de dados que o Corretor
Pro já usa) com essa mesma trava aplicada dentro do próprio banco — aqui é só uma simulação em
memória pra validar a ideia antes de mexer no sistema real.
