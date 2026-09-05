import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding DealFlow360 Master Data...');

  // 1. Clean existing records
  await prisma.auditEvent.deleteMany();
  await prisma.fulfillmentItem.deleteMany();
  await prisma.fulfillmentPlan.deleteMany();
  await prisma.approvalRequest.deleteMany();
  await prisma.quoteLine.deleteMany();
  await prisma.quote.deleteMany();
  await prisma.crossSellRule.deleteMany();
  await prisma.inventoryStock.deleteMany();
  await prisma.warehouse.deleteMany();
  await prisma.product.deleteMany();
  await prisma.productCategory.deleteMany();
  await prisma.discountPolicy.deleteMany();
  await prisma.customer.deleteMany();
  await prisma.customerTier.deleteMany();
  await prisma.approvalRule.deleteMany();
  await prisma.user.deleteMany();

  // 2. Customer Tiers
  const goldTier = await prisma.customerTier.create({
    data: {
      code: 'GOLD',
      name: 'Gold Tier Customer',
      maxOverallDiscount: 15.0,
      minMarginThreshold: 30.0,
    },
  });

  const silverTier = await prisma.customerTier.create({
    data: {
      code: 'SILVER',
      name: 'Silver Tier Customer',
      maxOverallDiscount: 10.0,
      minMarginThreshold: 35.0,
    },
  });

  const bronzeTier = await prisma.customerTier.create({
    data: {
      code: 'BRONZE',
      name: 'Bronze Tier Customer',
      maxOverallDiscount: 5.0,
      minMarginThreshold: 40.0,
    },
  });

  // 3. Customers
  const acme = await prisma.customer.create({
    data: {
      id: 'cust_acme_101',
      name: 'Acme Industries',
      tierId: goldTier.id,
      currency: 'INR',
      status: 'ACTIVE',
    },
  });

  const nova = await prisma.customer.create({
    data: {
      id: 'cust_nova_102',
      name: 'Nova Retail',
      tierId: silverTier.id,
      currency: 'INR',
      status: 'ACTIVE',
    },
  });

  const bluepeak = await prisma.customer.create({
    data: {
      id: 'cust_bluepeak_103',
      name: 'BluePeak Systems',
      tierId: bronzeTier.id,
      currency: 'INR',
      status: 'ACTIVE',
    },
  });

  // 4. Product Categories
  const hardware = await prisma.productCategory.create({
    data: {
      code: 'HARDWARE',
      name: 'Hardware Products',
      maxCategoryDiscount: 15.0,
    },
  });

  const services = await prisma.productCategory.create({
    data: {
      code: 'SERVICES',
      name: 'Services & Consulting',
      maxCategoryDiscount: 10.0,
    },
  });

  const software = await prisma.productCategory.create({
    data: {
      code: 'SOFTWARE',
      name: 'Software & Licenses',
      maxCategoryDiscount: 20.0,
    },
  });

  // 5. Products
  const serverProduct = await prisma.product.create({
    data: {
      id: 'prod_server_01',
      sku: 'HW-SRV-001',
      name: 'Enterprise Server',
      categoryId: hardware.id,
      sellingPrice: 150000.0,
      costPrice: 90000.0,
      isActive: true,
    },
  });

  const networkProduct = await prisma.product.create({
    data: {
      id: 'prod_network_02',
      sku: 'HW-NET-001',
      name: 'Network Appliance',
      categoryId: hardware.id,
      sellingPrice: 80000.0,
      costPrice: 50000.0,
      isActive: true,
    },
  });

  const serviceProduct = await prisma.product.create({
    data: {
      id: 'prod_service_01',
      sku: 'SV-IMP-001',
      name: 'Implementation Services',
      categoryId: services.id,
      sellingPrice: 50000.0,
      costPrice: 30000.0,
      isActive: true,
    },
  });

  const supportProduct = await prisma.product.create({
    data: {
      id: 'prod_support_02',
      sku: 'SV-SUP-001',
      name: 'Premium Support',
      categoryId: services.id,
      sellingPrice: 100000.0,
      costPrice: 40000.0,
      isActive: true,
    },
  });

  const analyticsProduct = await prisma.product.create({
    data: {
      id: 'prod_analytics_01',
      sku: 'SW-ANL-001',
      name: 'Analytics Suite',
      categoryId: software.id,
      sellingPrice: 200000.0,
      costPrice: 60000.0,
      isActive: true,
    },
  });

  const warrantyProduct = await prisma.product.create({
    data: {
      id: 'prod_warranty_01',
      sku: 'SW-WRN-001',
      name: 'Extended Warranty',
      categoryId: software.id,
      sellingPrice: 25000.0,
      costPrice: 5000.0,
      isActive: true,
    },
  });

  // 6. Discount Policies
  await prisma.discountPolicy.createMany({
    data: [
      {
        name: 'Gold Customer Overall Discount Limit',
        tierId: goldTier.id,
        maxDiscountPercent: 15.0,
        riskSeverity: 'HIGH',
        requiresApproval: true,
      },
      {
        name: 'Silver Customer Overall Discount Limit',
        tierId: silverTier.id,
        maxDiscountPercent: 10.0,
        riskSeverity: 'HIGH',
        requiresApproval: true,
      },
      {
        name: 'Bronze Customer Overall Discount Limit',
        tierId: bronzeTier.id,
        maxDiscountPercent: 5.0,
        riskSeverity: 'HIGH',
        requiresApproval: true,
      },
      {
        name: 'Services Category Maximum Discount Limit',
        categoryId: services.id,
        maxDiscountPercent: 10.0,
        riskSeverity: 'HIGH',
        requiresApproval: true,
      },
      {
        name: 'Hardware Category Maximum Discount Limit',
        categoryId: hardware.id,
        maxDiscountPercent: 15.0,
        riskSeverity: 'MEDIUM',
        requiresApproval: true,
      },
    ],
  });

  // 7. Approval Rules
  await prisma.approvalRule.createMany({
    data: [
      {
        name: 'Medium Deal Risk Manager Approval',
        minRiskLevel: 'MEDIUM',
        requiredRole: 'SALES_MANAGER',
        autoApproveEligible: false,
      },
      {
        name: 'High Deal Risk Manager Approval',
        minRiskLevel: 'HIGH',
        requiredRole: 'SALES_MANAGER',
        autoApproveEligible: false,
      },
    ],
  });

  // 8. Demo Users
  const salesRep = await prisma.user.create({
    data: {
      id: 'rep_1',
      name: 'Alex Sales Rep',
      email: 'alex.rep@dealflow360.com',
      role: 'SALES_REP',
    },
  });

  const salesManager = await prisma.user.create({
    data: {
      id: 'mgr_1',
      name: 'Morgan Sales Manager',
      email: 'morgan.manager@dealflow360.com',
      role: 'SALES_MANAGER',
    },
  });

  // 9. Cross-Sell Rule
  await prisma.crossSellRule.create({
    data: {
      triggerProductId: serverProduct.id,
      recommendedProductId: warrantyProduct.id,
      reasonTemplate: 'Customers purchasing Enterprise Server commonly add Extended Warranty to protect hardware investments.',
      minMarginPercent: 30.0,
    },
  });

  // 10. Warehouses
  const bomWarehouse = await prisma.warehouse.create({
    data: {
      id: 'wh_bom_01',
      code: 'BOM-01',
      name: 'Mumbai Central Hub',
      location: 'Mumbai, MH',
      baseShippingCost: 500.0,
      priority: 1,
    },
  });

  const delWarehouse = await prisma.warehouse.create({
    data: {
      id: 'wh_del_02',
      code: 'DEL-02',
      name: 'Delhi North Hub',
      location: 'Delhi, NCR',
      baseShippingCost: 750.0,
      priority: 2,
    },
  });

  const blrWarehouse = await prisma.warehouse.create({
    data: {
      id: 'wh_blr_03',
      code: 'BLR-03',
      name: 'Bengaluru Tech Depot',
      location: 'Bengaluru, KA',
      baseShippingCost: 600.0,
      priority: 3,
    },
  });

  // 11. Inventory Stock Levels
  // Enterprise Server (prod_server_01): BOM-01=5, DEL-02=3, BLR-03=0 (Total=8)
  await prisma.inventoryStock.createMany({
    data: [
      { warehouseId: bomWarehouse.id, productId: serverProduct.id, quantityOnHand: 5, quantityReserved: 0 },
      { warehouseId: delWarehouse.id, productId: serverProduct.id, quantityOnHand: 3, quantityReserved: 0 },
      { warehouseId: blrWarehouse.id, productId: serverProduct.id, quantityOnHand: 0, quantityReserved: 0 },

      // Network Appliance (prod_network_02): BOM-01=2, DEL-02=8, BLR-03=10
      { warehouseId: bomWarehouse.id, productId: networkProduct.id, quantityOnHand: 2, quantityReserved: 0 },
      { warehouseId: delWarehouse.id, productId: networkProduct.id, quantityOnHand: 8, quantityReserved: 0 },
      { warehouseId: blrWarehouse.id, productId: networkProduct.id, quantityOnHand: 10, quantityReserved: 0 },

      // Implementation Services (prod_service_01): BOM-01=100 (Digital/service stock)
      { warehouseId: bomWarehouse.id, productId: serviceProduct.id, quantityOnHand: 100, quantityReserved: 0 },

      // Premium Support (prod_support_02): BOM-01=100
      { warehouseId: bomWarehouse.id, productId: supportProduct.id, quantityOnHand: 100, quantityReserved: 0 },

      // Analytics Suite (prod_analytics_01): BLR-03=15
      { warehouseId: blrWarehouse.id, productId: analyticsProduct.id, quantityOnHand: 15, quantityReserved: 0 },

      // Extended Warranty (prod_warranty_01): BOM-01=50
      { warehouseId: bomWarehouse.id, productId: warrantyProduct.id, quantityOnHand: 50, quantityReserved: 0 },
    ],
  });

  console.log('Seed completed successfully!');
  console.log(`Seeded: 3 Customer Tiers, 3 Customers, 3 Product Categories, 6 Products, 2 Users (${salesRep.name}, ${salesManager.name}), 3 Warehouses (BOM-01, DEL-02, BLR-03)`);
}

main()
  .catch((e) => {
    console.error('Error during seed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
