# Atualização 662

## Importação de leads mais simples e sem duplicar

- O importador de leads (Configurações → "Importar leads (CSV)") ficou mais tolerante:
  - Só a coluna **Nome** é obrigatória. **Telefone** e **Interesse** são opcionais.
  - A coluna **id** não é mais exigida. Quando o arquivo não traz `id`, o sistema gera um código
    estável a partir do nome + telefone — então reimportar o mesmo arquivo **não duplica**.
  - O interesse do lead pode vir na coluna **Interesse** ou **Empreendimento** (aceita as duas).
  - O cabeçalho não diferencia maiúsculas/minúsculas (`Nome`, `NOME`, `nome` funcionam igual).
- Correção de deduplicação: o marcador gravado na importação era `[CSV …]`, mas a verificação de
  "já importado" só procurava `[CRM …]`. Com isso, reimportar podia recriar leads sem telefone.
  Agora a verificação reconhece `[CSV …]` e `[CRM …]`.
- Cache PWA isolado na versão 662 (`service-worker.js`) para forçar a atualização do app.
