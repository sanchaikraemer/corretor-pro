# v780 — Lead importado ficava com o NOME DO ARQUIVO (e duplicava)

## O problema (lead Elisandro)

Ao importar a conversa, o app criava um card chamado "Conversa do com Elisandro Altmann Altan-enxuto.zip" em vez de "Elisandro Altman". Como o nome saía diferente do cadastro que já existia (da planilha), virava um SEGUNDO card — parecia que a importação "não salvava".

## Causa

A limpeza do nome do arquivo só reconhecia o formato "Conversa do WhatsApp com Fulano". Quando o arquivo vinha como "Conversa do com Fulano" (sem a palavra "WhatsApp"), nada era removido e o nome do arquivo inteiro virava o nome do lead. Com o nome errado, o reconhecimento de lead existente também não casava → duplicava.

## Correção (`api/_persistence.js` + `app.js`)

O padrão agora aceita "Conversa do WhatsApp com…", "Conversa do com…" e "Conversa com…" — a palavra "WhatsApp" e o "do" viraram opcionais. Assim o card mostra o nome do cliente e a reimportação reconhece o lead certo.

## Limitação (segue valendo)

Isso corrige os próximos imports. Um lead que JÁ duplicou (como o Elisandro) precisa ser resolvido na mão: apagar o cadastro vazio e manter o card com a conversa (ou renomear). E se o nome do contato no WhatsApp for bem diferente do nome salvo na planilha (ex.: "Altmann Altan" x "Altman"), ainda pode duplicar — melhorar esse reconhecimento é um passo à parte.

## Testes

- `npm test` e `npm run build` passaram.
- Falta validar em produção com um import novo.
