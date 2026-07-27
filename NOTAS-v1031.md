# NOTAS v1031 — lead atendido continuava aparecendo em "Oportunidades esquecidas"

## O relato

O dono marcou "Wilson" como atendido (confirmado na tela de Atendimentos, aparecendo certinho no
"16/10" de hoje), mas ele continuou aparecendo em "Oportunidades esquecidas" com "158d parado".

## O que estava acontecendo

Achei a causa exata. Quando você marca "atendido" copiando a mensagem sugerida (o jeito mais
comum de atender por aqui), o sistema marca isso "na hora" em duas frentes: guarda no banco de
dados (pra sempre) e, ao mesmo tempo, atualiza a cópia que já está na memória do celular — pra
tela responder na hora, sem esperar o servidor.

O problema era exatamente essa segunda parte, a cópia em memória: quando você copia a mensagem
**de dentro do próprio lead aberto**, o sistema só atualizava a cópia "do lead que você está
vendo na tela" — mas essa cópia é tecnicamente diferente da cópia usada pra montar a lista da
Home ("Oportunidades esquecidas" inclusa). Ao fechar o lead (clicar Voltar), aquela cópia
atualizada era descartada, e a cópia real (a da lista) nunca tinha sido tocada — continuando com
os dados antigos, "158 dias parado", até você atualizar a página inteira (F5).

O banco de dados sempre esteve certo — o problema era só a "memória rápida" do celular não avisar
todo mundo que precisava saber.

## O que mudou

Agora, ao marcar atendido copiando a mensagem, o sistema atualiza TODAS as cópias em memória (a
do lead aberto e a da lista da Home), do mesmo jeito que o botão "Marcar atendimento" já fazia
certo. Wilson (e qualquer lead atendido dessa forma) some de "Oportunidades esquecidas" na hora,
sem precisar de F5.

## Testes novos

`tests/v1031-copiar-mensagem-marca-atendido-em-toda-copia.test.mjs` — confirma que a marcação
atualiza todas as cópias em memória do lead, e que a segurança contra recarregamento "atrasado" do
banco também foi adicionada aqui (mesma proteção que o botão "Marcar atendimento" já tinha).

## `npm test`

Suíte inteira verde.
