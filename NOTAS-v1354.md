# v1354 — dava certo e não aparecia na tela

Erro meu, da versão anterior. Quando você mandava o arquivo pela linha vermelha, o servidor gravava
a transcrição certinho na mensagem — e a tela continuava mostrando a mesma linha vermelha, como se
nada tivesse acontecido.

O motivo: existe no app uma proteção antiga que, ao recarregar o cliente, compara a conversa que
está na tela com a que volta do servidor. A lista de clientes só devolve um pedaço das mensagens
(4), enquanto na tela está o histórico inteiro (16). Pra não fazer a conversa "encolher" na sua
frente, a proteção manda ficar com a versão da tela. Só que aí ela ficava com o texto VELHO — e
jogava fora justamente a linha que o servidor tinha acabado de gravar.

Agora a linha nova é colocada na tela na hora, antes de recarregar. Você manda o arquivo e vê o
texto aparecer no lugar do botão vermelho, na mesma hora.
