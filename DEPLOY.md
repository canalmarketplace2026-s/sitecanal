# Canal — catálogo oficial do Tiny

Esta versão substitui o catálogo fictício. Envie o CONTEÚDO desta pasta à raiz do repositório sitecanal. Não envie senhas, .env, pasta private, documentos de acesso, node_modules ou .next.

## Catálogo e estoque

- A base inicial contém 2.872 registros reais consultados no Tiny da Canal, sem custos de compra ou dados internos de fornecedor. O Tiny passa a ser o único cadastro oficial.
- O seed desativa os produtos do catálogo anterior e importa registros identificados por tinyId, sem apagar pedidos. Se produtos antigos tiverem reservas, a migração é interrompida para conciliação.
- Produtos-pai de variações não são vendidos como itens individuais. As variações com ID próprio são importadas separadamente. Produtos inativos, excluídos, sem preço válido ou ausentes numa consulta completa deixam de ser vendidos.
- O preço promocional do Tiny é usado somente quando é positivo e menor que o preço normal. Não se inventam promoções, avaliações ou quantidades.
- O catálogo inteiro é consultado em todas as páginas. Detalhes, fotos, marca, categoria e medidas reais são atualizados em lotes. O lote padrão é 75 produtos por ciclo de 15 min, respeitando cerca de 30 consultas/min. Na primeira carga, enriquecer milhares de registros pode levar várias horas.
- Saldos não vêm da lista geral de produtos: exigem consulta específica. O site começa com saldo zero até obter uma resposta válida; não usa as quantidades fictícias antigas. Durante cotação/checkout, consulta os itens do carrinho quando necessário. Se o ERP estiver indisponível ou ocupado com a sincronização, pede nova tentativa sem inventar saldo.
- Os campos de reserva local nunca são sobrescritos pela importação. A reserva após exportação ao Tiny depende de confirmação administrativa da baixa e sincronização posterior.
- Fotos ausentes aparecem como imagem não cadastrada. Medidas/peso ausentes impedem cotação do item até serem preenchidos no Tiny. Essa configuração cadastral precisa existir no ERP.
- Edite produtos diretamente no Tiny. A página /admin/catalogo consulta o espelho; não substitui o cadastro oficial.

## Instalação no servidor

O endereço anterior respondeu 404; confirmar acesso com a equipe. O proprietário envia ao GitHub. A equipe precisa conferir o remoto/branch no servidor, copiar a configuração privada ao .env, instalar dependências, aplicar migrations, importar o catálogo e iniciar o site e worker.

Para banco VAZIO:

```sh
cd /home/dev/app
npm ci
npm run prisma:deploy
npm run seed
npm test
npm run build
pm2 start ecosystem.config.cjs
pm2 save
```

Se o banco já possuir tabelas, NÃO aplicar a migration inicial sem revisar o histórico/schema e preparar baseline. Não executar reset. O comando seed é responsável por trocar o catálogo anterior pelo oficial, preservando registros de pedidos.

Configure as variáveis do .env.example no servidor. A configuração privada preparada fica FORA do pacote público, em Canal-publicacao/private/canal-servidor.env. Nunca enviá-la ao GitHub. Ajuste TINY_DETAIL_BATCH_SIZE apenas se precisar diminuir o lote (limite máximo 100); a aplicação mantém o intervalo de API.

## Pagamento e envio

Asaas Pix/cartão hospedado e parcelamento, webhook autenticado e recuperação de respostas ambíguas estão implementados. Falta a chave Asaas e homologar no ambiente correto. Manter CHECKOUT_ENABLED=false enquanto isso.

Melhor Envio cota os produtos reais com medidas vindas do Tiny. O painel administrativo permite preparar/comprar/gerar/imprimir etiquetas e consultar rastreio. Exige remetente fiscal completo e NF-e; compra depende de confirmação explícita e SHIPPING_PURCHASE_ENABLED.

TINY_ENVIAR_PEDIDOS fica false até a homologação. Quando habilitado, o worker exporta pedidos pagos com referência persistida; resposta ambígua exige recuperação/conferência, nunca repetição cega. Nenhuma alteração foi feita no estoque do Tiny durante a preparação; somente consultas de leitura.

## Validação e limites

64 testes locais passaram com banco/provedores simulados. A compilação precisa passar antes da entrega. Não houve execução de migration nem importação no banco do servidor, cobrança real ou compra de etiqueta. Essa etapa exige acesso ao servidor e testes com as contas correspondentes. BR e Drogaria não foram alteradas.
