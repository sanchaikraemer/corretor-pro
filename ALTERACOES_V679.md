# Corretor Pro v679 — Segurança e Backup

## Objetivo
Primeiro pacote do novo roadmap: reduzir risco real antes de evoluir inteligência comercial.

## Alterações

- Proteção de todas as rotas públicas do servidor com chave secreta.
- Todas as chamadas do app para `/api/*` agora enviam `X-Corretor-Pro-Key`.
- No primeiro acesso, o app solicita a chave e salva somente no navegador do aparelho.
- A API exige a variável de ambiente `CORRETOR_PRO_API_KEY` na Vercel.
- Foi adicionado botão **Backup** na tela de Atendimentos.
- O backup baixa um JSON completo com os dados brutos da tabela `whatsapp_processamentos` e, quando existirem, tabelas auxiliares encontradas.
- O backup usa a rota já existente `leads-recentes?export=full`, sem criar nova Serverless Function.

## Variável obrigatória na Vercel

```
CORRETOR_PRO_API_KEY=sua-chave-forte-aqui
```

A mesma chave deve ser informada no app quando ele pedir.

## Observação

Esta versão não altera ranking, IA comercial, fluxo de atendimento ou visual além do botão de backup. O foco é proteger dados e reduzir risco de gasto indevido com API.
