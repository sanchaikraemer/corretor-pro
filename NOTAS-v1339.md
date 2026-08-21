# v1339 — a trava da publicação nunca vai travar o site por culpa da máquina

Complemento imediato da 1338. A trava nova impede que app quebrado vá pro ar — mas eu precisava
garantir uma coisa antes de dormir tranquilo: **ela não pode repetir o estrago da 1325**, que foi
deixar o site preso numa versão velha por um motivo que não tinha nada a ver com o app.

Duas garantias:

1. **Problema de máquina não para a publicação.** Se a conferência não conseguir sequer rodar
   (faltou um pacote na máquina que publica, o Node não subiu), isso não é app quebrado. A trava
   avisa em letras garrafais no registro e **deixa passar** — a conferência de verdade continua
   acontecendo a cada envio, na máquina limpa do GitHub. Só teste realmente vermelho segura a
   publicação.

2. **O pacote que a conferência usa saiu da lista "só pra desenvolvimento"** e passou pra lista
   principal, pra nunca faltar na hora de publicar.

Tudo isso está conferido por teste — inclusive rodando a trava de verdade.
