# v770 — Permuta/terreno oferecido pelo cliente não aparecia na análise

## O problema (relatado pelo usuário com a conversa real da Janaína)

Em setembro/2025, bem no início de uma conversa de 151 mensagens (que depois mudou de assunto e de produto várias vezes até junho/2026), a cliente perguntou explicitamente se a construtora aceitava um terreno (450m², bairro Braganholo) como parte do pagamento. Isso nunca apareceu em nenhum lugar da análise do lead.

## Duas causas, as duas corrigidas

1. **A IA não estava carregando esse fato pra frente.** Numa conversa longa com meses de intervalo e troca de produto no meio, o modelo tendia a focar só no trecho mais recente. O prompt de análise agora instrui explicitamente a ler a conversa inteira do início ao fim e tratar fatos importantes (como uma permuta oferecida) como válidos até o cliente dizer o contrário — mesmo que tenham sido ditos uma vez só, há meses. O campo `pendenciaFinanceira` do diagnóstico agora pede explicitamente esse tipo de informação (permuta/entrada com imóvel próprio, com os detalhes dados).

2. **Mesmo quando a IA identificava isso, a tela não mostrava.** A seção "Detalhes comerciais" do lead nunca tinha uma linha pra esse campo — o dado podia estar certo no banco e simplesmente não aparecia em lugar nenhum da interface. Adicionada a linha "Pendência financeira" nos detalhes comerciais do lead.

## Testes

- `npm test` e `npm run build` passaram.
- Validar reanalisando o lead da Janaína em produção e conferindo se "Pendência financeira" aparece com o terreno.
