# Publicação da Canal

## Atualização no servidor existente

1. Use o repositório canalmarketplace2026-s/sitecanal, branch main. O vínculo do deploy automático precisa ser confirmado com a hospedagem; um push isolado não comprova publicação.
2. Preserve /home/dev/app.env e o banco existente. Não execute reset nem o seed novamente para atualizar banners ou layout.
3. Prepare a nova versão em uma pasta separada; mantenha o aplicativo atual atendendo durante a compilação. Use as mesmas dependências do package-lock.json e copie a configuração privada para .env com permissão 600.
4. Execute npm ci e npm run build. Se falhar, não troque a versão em execução.
5. Após compilar, ative a nova versão em /home/dev/app e reinicie somente os processos PM2 site e tiny-sync. Preserve a versão anterior para reversão. Execute pm2 save.
6. Confira os dois domínios, catálogo, imagens, checkout, conta e painel. Os testes automatizados usam provedores simulados; a compra de validação do responsável conclui a verificação do fluxo real.

## Credenciais e opções

O .env.example é um modelo bloqueado e sem segredos, adequado a instalações novas. Na loja existente a configuração de produção já foi habilitada por solicitação do usuário. Preserve os valores efetivos de CHECKOUT_ENABLED, TINY_ENVIAR_PEDIDOS e SHIPPING_PURCHASE_ENABLED em /home/dev/app.env. Nunca coloque esse arquivo no Git.

## Instalação nova

Somente em banco novo/vazio: configurar o ambiente, instalar dependências, executar prisma migrate deploy e o seed oficial do Tiny, compilar e iniciar ecosystem.config.cjs. Bancos com tabelas exigem revisão do histórico de migrations. Não utilizar prisma migrate reset em produção.

## Operação

Produtos são editados no Tiny. O saldo do site desconta reservas locais. Após o envio do pedido ao ERP, a baixa precisa ser confirmada administrativamente e seguida por uma sincronização antes da liberação da reserva. Etiquetas exigem NF-e válida; serviços que exigem agência/CNAE ou XML precisam dos dados correspondentes, ou devem ser tratados diretamente no Melhor Envio.
