# NOTAS v1043 — Testes rodando sozinhos a cada atualização (GitHub Actions)

## O problema

A auditoria apontou: "não foi identificada uma configuração clara de integração contínua... os
testes aparentam depender de execução manual antes da publicação." Verdade — até esta versão,
`npm test` só rodava quando alguém (eu, numa sessão) lembrava de rodar na mão. Nada impedia uma
alteração quebrada de ir parar direto no `main` sem ninguém ter percebido.

## A correção

Criei `.github/workflows/ci.yml`: a partir de agora, toda vez que alguém enviar uma alteração pro
GitHub (seja direto no `main`, seja um Pull Request), o GitHub roda a suíte inteira de testes
sozinho — os mesmos `npm test` que eu já rodava manualmente antes de cada publicação. Se algo
quebrar, aparece um "x" vermelho no commit/Pull Request, visível pra qualquer um antes de mesclar.

Isso **não muda o jeito como o site é publicado** — a Vercel continua publicando sozinha a cada
atualização no `main`, exatamente como já funciona hoje. O GitHub Actions só é mais um aviso,
rodando em paralelo, garantindo que ninguém publique com teste quebrado sem perceber.

## Verificação

- Novo teste `tests/v1043-ci-github-actions.test.mjs`: confirma que o arquivo do workflow existe
  e está configurado pra rodar em toda alteração relevante (push no main e Pull Request), instalar
  as dependências de forma reproduzível (`npm ci`) e rodar a suíte completa (`npm test`).
- `npm test`: suíte inteira verde.
- `npm run build`: build limpo.
- **Só vou saber que o workflow em si funciona de verdade depois que esta alteração for mesclada**
  e o GitHub rodar ele pela primeira vez — vou conferir isso depois do merge.

## Arquivos

`.github/workflows/ci.yml` (novo), `tests/v1043-ci-github-actions.test.mjs` (novo),
`package.json`/`package-lock.json` (versão + script `test`), `NOTAS-v1043.md`, versão
**1042 → 1043**.
