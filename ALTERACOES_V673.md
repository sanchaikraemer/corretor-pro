# Atualização 673

## Correções

- O botão **Atualizar análise comercial** deixou de acionar um botão antigo escondido e agora chama diretamente a API de reanálise.
- Após a reanálise, o aplicativo invalida os caches e busca novamente a base e o histórico completo do lead.
- Erros e demora excessiva passam a ser informados ao usuário, e o botão volta a ficar disponível para nova tentativa.
- A identificação de oportunidade encerrada também considera todo o conteúdo comercial já salvo. Frases como “cliente final comprou outro imóvel” deixam de manter a oportunidade em descoberta ou negociação.
- Contatos classificados como **sem ação urgente** não aparecem na lista chamada “Leads prioritários”.
- O relacionamento com o corretor parceiro continua ativo; a oportunidade encerrada não é movida automaticamente para Perdidos ou Geladeira.
