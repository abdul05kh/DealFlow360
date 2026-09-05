-- CreateTable
CREATE TABLE "CustomerTier" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "maxOverallDiscount" REAL NOT NULL,
    "minMarginThreshold" REAL NOT NULL
);

-- CreateTable
CREATE TABLE "Customer" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "tierId" TEXT NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'INR',
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    CONSTRAINT "Customer_tierId_fkey" FOREIGN KEY ("tierId") REFERENCES "CustomerTier" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ProductCategory" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "maxCategoryDiscount" REAL NOT NULL
);

-- CreateTable
CREATE TABLE "Product" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "sku" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,
    "costPrice" REAL NOT NULL,
    "sellingPrice" REAL NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    CONSTRAINT "Product_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "ProductCategory" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "role" TEXT NOT NULL
);

-- CreateTable
CREATE TABLE "DiscountPolicy" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "tierId" TEXT,
    "categoryId" TEXT,
    "maxDiscountPercent" REAL NOT NULL,
    "riskSeverity" TEXT NOT NULL DEFAULT 'HIGH',
    "requiresApproval" BOOLEAN NOT NULL DEFAULT true,
    CONSTRAINT "DiscountPolicy_tierId_fkey" FOREIGN KEY ("tierId") REFERENCES "CustomerTier" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "DiscountPolicy_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "ProductCategory" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ApprovalRule" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "minRiskLevel" TEXT NOT NULL,
    "requiredRole" TEXT NOT NULL,
    "autoApproveEligible" BOOLEAN NOT NULL DEFAULT false
);

-- CreateTable
CREATE TABLE "Quote" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "quoteNumber" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "salesRepId" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "grossRevenue" REAL NOT NULL,
    "discountAmount" REAL NOT NULL,
    "netRevenue" REAL NOT NULL,
    "estimatedCost" REAL NOT NULL,
    "grossMargin" REAL NOT NULL,
    "marginPercentage" REAL NOT NULL,
    "riskLevel" TEXT NOT NULL,
    "riskScore" REAL NOT NULL,
    "riskReasonsJson" TEXT NOT NULL,
    "requiredApproverRole" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Quote_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Quote_salesRepId_fkey" FOREIGN KEY ("salesRepId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "QuoteLine" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "quoteId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "unitPrice" REAL NOT NULL,
    "unitCost" REAL NOT NULL,
    "discountPercent" REAL NOT NULL,
    "discountAmount" REAL NOT NULL,
    "subtotal" REAL NOT NULL,
    "netTotal" REAL NOT NULL,
    "lineCost" REAL NOT NULL,
    "lineMargin" REAL NOT NULL,
    CONSTRAINT "QuoteLine_quoteId_fkey" FOREIGN KEY ("quoteId") REFERENCES "Quote" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "QuoteLine_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ApprovalRequest" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "quoteId" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "requiredRole" TEXT NOT NULL,
    "assignedApproverId" TEXT,
    "actionedById" TEXT,
    "actionReason" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actionedAt" DATETIME,
    CONSTRAINT "ApprovalRequest_quoteId_fkey" FOREIGN KEY ("quoteId") REFERENCES "Quote" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ApprovalRequest_assignedApproverId_fkey" FOREIGN KEY ("assignedApproverId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "ApprovalRequest_actionedById_fkey" FOREIGN KEY ("actionedById") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "AuditEvent" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "actorId" TEXT NOT NULL,
    "actorName" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "previousStateJson" TEXT,
    "newStateJson" TEXT,
    "contextJson" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "CrossSellRule" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "triggerProductId" TEXT NOT NULL,
    "recommendedProductId" TEXT NOT NULL,
    "reasonTemplate" TEXT NOT NULL,
    "minMarginPercent" REAL NOT NULL DEFAULT 30.0,
    CONSTRAINT "CrossSellRule_triggerProductId_fkey" FOREIGN KEY ("triggerProductId") REFERENCES "Product" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "CrossSellRule_recommendedProductId_fkey" FOREIGN KEY ("recommendedProductId") REFERENCES "Product" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "CustomerTier_code_key" ON "CustomerTier"("code");

-- CreateIndex
CREATE UNIQUE INDEX "ProductCategory_code_key" ON "ProductCategory"("code");

-- CreateIndex
CREATE UNIQUE INDEX "Product_sku_key" ON "Product"("sku");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Quote_quoteNumber_key" ON "Quote"("quoteNumber");
