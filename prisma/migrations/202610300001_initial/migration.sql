-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "cpf" TEXT,
    "phone" TEXT,
    "role" TEXT NOT NULL DEFAULT 'CUSTOMER',
    "termsAcceptedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "privacyAcceptedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "addresses" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "cep" TEXT NOT NULL,
    "street" TEXT NOT NULL,
    "number" TEXT NOT NULL,
    "complement" TEXT,
    "district" TEXT NOT NULL,
    "city" TEXT NOT NULL,
    "state" TEXT NOT NULL,
    "isDefault" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "addresses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "products" (
    "id" TEXT NOT NULL,
    "tinyId" TEXT,
    "sku" TEXT,
    "gtin" TEXT,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "shortDesc" TEXT,
    "category" TEXT NOT NULL DEFAULT 'Geral',
    "brand" TEXT NOT NULL DEFAULT 'Canal Distribuidora',
    "price" DOUBLE PRECISION NOT NULL,
    "oldPrice" DOUBLE PRECISION,
    "discountPercent" INTEGER NOT NULL DEFAULT 0,
    "stock" INTEGER NOT NULL DEFAULT 0,
    "reservedStock" INTEGER NOT NULL DEFAULT 0,
    "stockSyncedAt" TIMESTAMP(3),
    "detailsSyncedAt" TIMESTAMP(3),
    "freteGratis" BOOLEAN NOT NULL DEFAULT false,
    "badge" TEXT,
    "rating" DOUBLE PRECISION NOT NULL DEFAULT 4.9,
    "reviewsCount" INTEGER NOT NULL DEFAULT 120,
    "image" TEXT NOT NULL,
    "gallery" TEXT[],
    "active" BOOLEAN NOT NULL DEFAULT true,
    "weight" DOUBLE PRECISION,
    "height" DOUBLE PRECISION,
    "width" DOUBLE PRECISION,
    "length" DOUBLE PRECISION,
    "meliLink" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "products_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "orders" (
    "id" TEXT NOT NULL,
    "orderNumber" TEXT NOT NULL,
    "checkoutKey" TEXT,
    "checkoutFingerprint" TEXT,
    "invoiceUrl" TEXT,
    "paymentCreateState" TEXT NOT NULL DEFAULT 'NOT_STARTED',
    "paymentCreateAttemptedAt" TIMESTAMP(3),
    "paymentLastCheckedAt" TIMESTAMP(3),
    "paymentError" TEXT,
    "asaasCustomerId" TEXT,
    "asaasInstallmentId" TEXT,
    "paymentDueDate" TIMESTAMP(3),
    "paymentReview" BOOLEAN NOT NULL DEFAULT false,
    "tinyOrderId" TEXT,
    "tinyExportStatus" TEXT NOT NULL DEFAULT 'PENDING',
    "tinyExportAttemptedAt" TIMESTAMP(3),
    "tinyExportError" TEXT,
    "tinyExportedAt" TIMESTAMP(3),
    "tinyStockAcknowledgedAt" TIMESTAMP(3),
    "tinyStockAcknowledgement" TEXT,
    "tinyStockReconciledAt" TIMESTAMP(3),
    "shippingQuote" JSONB,
    "shippingCartCost" DOUBLE PRECISION,
    "shippingProviderData" JSONB,
    "shippingIntegrationStatus" TEXT NOT NULL DEFAULT 'NONE',
    "melhorEnvioIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "shippingLastError" TEXT,
    "shippingAttemptedAt" TIMESTAMP(3),
    "shippingInvoiceKey" TEXT,
    "shippingPrintUrl" TEXT,
    "stockReleased" BOOLEAN NOT NULL DEFAULT false,
    "userId" TEXT,
    "customerName" TEXT NOT NULL,
    "customerEmail" TEXT NOT NULL,
    "customerPhone" TEXT NOT NULL,
    "customerCpf" TEXT NOT NULL,
    "shippingCep" TEXT NOT NULL,
    "shippingStreet" TEXT NOT NULL,
    "shippingNum" TEXT NOT NULL,
    "shippingComp" TEXT,
    "shippingDist" TEXT NOT NULL,
    "shippingCity" TEXT NOT NULL,
    "shippingState" TEXT NOT NULL,
    "subtotal" DOUBLE PRECISION NOT NULL,
    "shippingCost" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "shippingMethod" TEXT,
    "discount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "total" DOUBLE PRECISION NOT NULL,
    "paymentMethod" TEXT NOT NULL,
    "paymentStatus" TEXT NOT NULL DEFAULT 'PENDING',
    "asaasPaymentId" TEXT,
    "pixQrCode" TEXT,
    "pixCopiaECola" TEXT,
    "pixExpiresAt" TIMESTAMP(3),
    "cardLastFour" TEXT,
    "cardBrand" TEXT,
    "installments" INTEGER NOT NULL DEFAULT 1,
    "trackingCode" TEXT,
    "trackingUrl" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "orders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "order_items" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "productId" TEXT,
    "sku" TEXT,
    "tinyId" TEXT,
    "name" TEXT NOT NULL,
    "price" DOUBLE PRECISION NOT NULL,
    "quantity" INTEGER NOT NULL,
    "image" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "order_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "webhook_logs" (
    "id" TEXT NOT NULL,
    "event" TEXT NOT NULL,
    "payload" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "message" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "webhook_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sync_logs" (
    "id" TEXT NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'TINY',
    "status" TEXT NOT NULL,
    "itemsSynced" INTEGER NOT NULL DEFAULT 0,
    "itemsFailed" INTEGER NOT NULL DEFAULT 0,
    "message" TEXT,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "sync_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "settings" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "settings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "products_tinyId_key" ON "products"("tinyId");

-- CreateIndex
CREATE UNIQUE INDEX "products_sku_key" ON "products"("sku");

-- CreateIndex
CREATE UNIQUE INDEX "products_slug_key" ON "products"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "orders_orderNumber_key" ON "orders"("orderNumber");

-- CreateIndex
CREATE UNIQUE INDEX "orders_checkoutKey_key" ON "orders"("checkoutKey");

-- CreateIndex
CREATE UNIQUE INDEX "orders_asaasInstallmentId_key" ON "orders"("asaasInstallmentId");

-- CreateIndex
CREATE UNIQUE INDEX "orders_tinyOrderId_key" ON "orders"("tinyOrderId");

-- CreateIndex
CREATE UNIQUE INDEX "orders_asaasPaymentId_key" ON "orders"("asaasPaymentId");

-- CreateIndex
CREATE UNIQUE INDEX "settings_key_key" ON "settings"("key");

-- AddForeignKey
ALTER TABLE "addresses" ADD CONSTRAINT "addresses_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE SET NULL ON UPDATE CASCADE;

