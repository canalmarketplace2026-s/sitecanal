# Canal Marketplace — publicação

Loja Next.js integrada ao Tiny/Olist, Asaas e Melhor Envio. O layout retoma a base aprovada em D:/@SITES/sp/canal, com os banners oficiais para computador e celular.

## Fonte oficial dos produtos

O catálogo, os preços, o saldo, as imagens e as medidas vêm do Tiny. Produtos fictícios não são usados pela aplicação. Itens sem disponibilidade ou medidas confirmadas não podem ser vendidos com saldo ou frete inventados. A sincronização automática roda a cada 15 minutos e preserva reservas de pedidos.

## Pagamento e envio

O checkout usa Pix e cartão hospedados no Asaas. O webhook autentica as notificações e consulta a cobrança antes de atualizar o pedido. Pedidos pagos são exportados ao Tiny quando TINY_ENVIAR_PEDIDOS está ativo. O administrador precisa confirmar a baixa efetiva no Tiny antes de reconciliar reservas locais; a criação do pedido no ERP não equivale à baixa física.

O Melhor Envio calcula o frete com a origem CEP 13059-640 e medidas reais. A compra de etiquetas exige conta administrativa, pedido pago, dados fiscais, chave da NF-e e confirmação do custo. O frete grátis está desativado. Os cupons antigos que existiam apenas no navegador foram removidos da sacola.

## Configuração privada

Nunca envie .env, private, senhas, chaves ou documentos de acesso ao GitHub. No servidor existente, /home/dev/app.env guarda a configuração persistente. O .env.example contém apenas um modelo sem credenciais; não substitua a configuração real por ele.

## Estado da entrega

O domínio principal e www estão ligados ao túnel site-canal. Produção foi habilitada por solicitação do responsável, que fará a compra de validação antes da divulgação. CHECKOUT_ENABLED, TINY_ENVIAR_PEDIDOS e SHIPPING_PURCHASE_ENABLED estão ativos no servidor. Isso não significa que um pagamento completo já foi homologado: nenhuma cobrança ou etiqueta foi comprada pelo assistente.

Leia DEPLOY.md para publicar e PENDENCIAS.md para os pontos que dependem da compra do responsável. BR e Drogaria não fazem parte desta entrega.
