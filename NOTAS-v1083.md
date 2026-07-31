# NOTAS v1083 — Faxina pedida pelo dono: fora o "Apagar tudo" e o motor que não era usado

## Contexto

Depois da revisão geral da v1082, o dono pediu, em cima do que foi apresentado:

> *"que motor é esse que não é usado, me diga e analisamos juntos se podemos deletar"*
> *"se não é usado vamos excluir e liberar linhas do código"*
> *"retire então esse apagar tudo, nunca será usado mesmo, bem como apagar todas as linhas disso
> no código"*
> *"não vou criar nada novo no supabase, esquece"*

Esta versão executa exatamente isso.

---

## 1. O "motor" que não era usado: `analisar.js`

O plano gratuito da Vercel (onde o site fica hospedado) permite no máximo **12 "motores"** —
programinhas que rodam no servidor. O projeto estava **exatamente nos 12**, no talo. Isso já
travou publicação por dias antes (v1039): quando você chega no limite, qualquer coisa nova
simplesmente não sobe.

Um desses 12 era o `analisar.js`, um caminho antigo pra processar o ZIP do WhatsApp de uma vez
só, de antes do sistema passar a mandar o arquivo por partes. **Nenhum botão do app chamava ele**
— confirmei varrendo o projeto inteiro: as únicas menções eram comentários de outros arquivos
falando sobre ele.

Ele também tinha um defeito escondido que nunca apareceu justamente por não ser usado: era o
único motor sem o tempo maior de execução configurado, então qualquer chamada de verdade daria
erro por estouro de tempo **depois** de já ter pago a análise pra OpenAI.

**Removido.**

---

## 2. O "Apagar tudo" saiu inteiro

O botão vermelho **"Limpar tudo (zerar app)"**, na "Zona perigosa" da tela Menu, apagava todas as
conversas, leads e arquivos da conta de uma vez. Ele já vinha desligado por segurança (só
funcionava se uma chave especial fosse ligada nas configurações do servidor), e o dono decidiu
que nunca seria usado.

Saiu tudo: o botão, o card "Zona perigosa" da tela, o código que fazia a chamada, o motor
`limpar-tudo.js` no servidor e até o estilo visual que só ele usava.

Isso resolve de quebra uma pendência que estava anotada desde a v1068: aquele botão **não conferia
se quem clicou era o dono da conta** — qualquer pessoa com acesso podia disparar. Agora não existe
mais o que conferir.

**Apagar os dados de uma conta continua possível**, pelo caminho certo: o painel administrativo,
que já exige ser administrador da plataforma. Nada foi perdido em termos de capacidade.

Um detalhe técnico que exigiu cuidado: o painel administrativo **usava uma função que morava
dentro do arquivo do "Apagar tudo"** (a que apaga os arquivos guardados de uma conta). Se eu
simplesmente apagasse o arquivo, o painel quebraria. Essa função foi movida pro módulo
compartilhado antes da remoção.

---

## 3. O placar

- **De 12 motores para 10** — duas vagas livres na Vercel. Qualquer funcionalidade nova agora tem
  espaço pra subir sem travar a publicação.
- **320 linhas de código de servidor** removidas, mais o botão, o card da tela e o trecho do app
  que conversava com ele.
- **Dois testes** que só existiam pra cuidar dessas duas rotas foram apagados; outros quatro que
  as mencionavam foram ajustados. Dois deles viraram **travas de que isso não volte por engano** —
  se alguém recriar o botão "Apagar tudo" ou a chamada à rota removida, o teste acusa.

---

## 4. Sobre o ambiente de teste separado

O dono decidiu: **não vai criar nada novo no Supabase.** O plano de montar um banco de teste
separado (que estava anotado na seção 6 do `ESTADO-ATUAL.md`) fica registrado como decisão
tomada, não como pendência aberta. Segue valendo o cuidado de sempre: mudança de banco é sempre
um passo manual, revisado antes de aplicar.

---

## 5. Uma variável de ambiente virou lixo

`DIRECIONA_DANGER_LIMPAR_TUDO` era a chave que ligava/desligava o "Apagar tudo". Com a rota fora,
ela não faz mais nada. **Se estiver cadastrada nas configurações da Vercel, pode apagar** — não é
obrigatório, só limpeza.

## Testes

`npm test` verde, com o código de saída conferido de verdade. Além disso, o app publicado foi
aberto num navegador real (celular 390px e computador 1440px): as 9 telas navegam sem erro, a
tela Menu ficou com 6 cards (a "Zona perigosa" sumiu, como pedido), sem rolagem lateral e sem
nenhum erro de página.
