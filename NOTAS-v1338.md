# v1338 — teste vermelho volta a segurar a publicação (agora sem travar o site)

## O problema, contado direito

A auditoria apontou uma falha séria: **teste vermelho não impedia nada**. A conferência automática
dava um "x" na tela do GitHub e pronto — dava pra mesclar e publicar com o app quebrado.

Na versão 1325 eu tentei resolver e **piorei**: pus a conferência dentro da publicação. O problema é
que a publicação roda com as configurações reais da sua conta carregadas (chave da inteligência,
endereço do banco, os ajustes de limite), e boa parte da conferência testa justamente o **valor de
fábrica** dessas coisas. Com as suas configurações no meio, a conferência falhava sozinha, a
publicação parava junto — e o site ficou preso na versão 1324 com três versões prontas esperando.
Quem viu foi você: *"nao, esta na 1324 e nao atualiza"*.

Na 1328 eu tirei a trava pra destravar o site. Só que aí o buraco original voltou: da 1328 até a
1337, nada impedia publicar com o app quebrado.

## O que mudou agora

A trava voltou, atacando a causa em vez do sintoma. A conferência antes de publicar passou a rodar
**numa sala limpa**: nenhuma configuração da sua conta entra ali. É exatamente o mesmo ambiente da
máquina onde o trabalho é feito, então o resultado é o mesmo dos dois lados — sem surpresa na hora
de publicar.

Na prática:

- **app quebrado não vai pro ar.** A publicação para e a versão que já está funcionando continua
  funcionando, intacta;
- **o site não trava mais por causa das suas configurações** — foi exatamente o erro da 1325, e a
  sala limpa existe pra isso;
- **você não fica refém da trava.** Se um dia for preciso publicar mesmo com alguma conferência
  vermelha, basta criar a variável `DIRECIONA_PULAR_TESTES_NO_BUILD` com valor `1` nas
  configurações da Vercel. A publicação avisa em letras garrafais que passou sem conferência e
  segue.

## Provado, não prometido

Tem uma conferência nova que **cria um teste quebrado de propósito e roda a trava de verdade** pra
provar que ela fecha, e outra que prova que a válvula de emergência abre. Não é comentário
dizendo que funciona: é a coisa rodando.

## O clique que ainda é seu

Isso impede que o app quebrado chegue **ao ar**. Pra impedir que ele chegue antes disso — no momento
de juntar o trabalho —, ainda falta um ajuste que só você pode fazer, no GitHub:

1. GitHub → repositório `corretor-pro` → **Settings** → **Branches** (ou **Rules → Rulesets**)
2. **Add branch protection rule**, com o padrão `main`
3. marcar **Require status checks to pass before merging** e escolher o check chamado **`testes`**
4. Salvar

Depois disso o botão de juntar fica bloqueado enquanto a conferência estiver vermelha. É opcional —
a trava da publicação já protege o que está no ar.
