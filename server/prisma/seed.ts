import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding DealFlow360 Master Data (230 Products, 6 Customers)...');
  const defaultPasswordHash = bcrypt.hashSync('Password123!', 10);

  // 1. Clean existing records
  await prisma.auditEvent.deleteMany();
  await prisma.quoteNegotiationLine.deleteMany();
  await prisma.quoteNegotiation.deleteMany();
  await prisma.fulfillmentItem.deleteMany();
  await prisma.fulfillmentPlan.deleteMany();
  await prisma.approvalRequest.deleteMany();
  await prisma.invoiceLine.deleteMany();
  await prisma.invoice.deleteMany();
  await prisma.subscriptionLine.deleteMany();
  await prisma.subscription.deleteMany();
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

  // 3. Customers (6 Realistic Customers)
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

  const apex = await prisma.customer.create({
    data: {
      id: 'cust_apex_104',
      name: 'Apex Global Logistics',
      tierId: goldTier.id,
      currency: 'INR',
      status: 'ACTIVE',
    },
  });

  const zenith = await prisma.customer.create({
    data: {
      id: 'cust_zenith_105',
      name: 'Zenith Financial Group',
      tierId: silverTier.id,
      currency: 'USD',
      status: 'ACTIVE',
    },
  });

  const vanguard = await prisma.customer.create({
    data: {
      id: 'cust_vanguard_106',
      name: 'Vanguard Retail Systems',
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

  // 5. Baseline Core Products (Preserved exactly for tests and demos)
  const serverProduct = await prisma.product.create({
    data: {
      id: 'prod_server_01',
      sku: 'HW-SRV-001',
      name: 'Enterprise Server',
      categoryId: hardware.id,
      sellingPrice: 150000.0,
      costPrice: 90000.0,
      billingType: 'ONE_TIME',
      billingInterval: null,
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
      billingType: 'ONE_TIME',
      billingInterval: null,
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
      billingType: 'ONE_TIME',
      billingInterval: null,
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
      billingType: 'RECURRING',
      billingInterval: 'MONTHLY',
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
      billingType: 'RECURRING',
      billingInterval: 'MONTHLY',
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
      billingType: 'RECURRING',
      billingInterval: 'YEARLY',
      isActive: true,
    },
  });

  // 6. Programmatically Generate 224 Enterprise Catalog Products (Total 230 Products)
  const additionalProductsData: Array<{
    id: string;
    sku: string;
    name: string;
    categoryId: string;
    sellingPrice: number;
    costPrice: number;
    billingType: string;
    billingInterval: string | null;
    isActive: boolean;
  }> = [];

  const hwTemplates = [
    'Rack Server R740-X', 'Blade Node B200-V', 'NVMe Storage Array SAN-500',
    'Core Switch CS-9500', 'Next-Gen Firewall FW-600', 'Edge Router ER-8000',
    'SAN Director Switch DS-6620', 'UPS Backup System 15kVA', 'Workstation Pro W7900',
    'High-Density Storage 4U', 'GPU Compute Node 8xH100', 'Load Balancer LB-400',
    'Fibre Channel HBA Dual', '100GbE Optical Transceiver', 'Tape Library TS4500'
  ];

  const swTemplates = [
    'Cloud Management Suite v5', 'Kubernetes Enterprise Platform', 'DB Cluster License Pro',
    'AI Inference Engine', 'Zero Trust Access Gateway', 'SIEM Enterprise Analytics',
    'Endpoint Protection Platform', 'DevOps Automation Hub', 'Vector Search Engine',
    'API Gateway Manager', 'Identity Governance Pro', 'Log Management Suite',
    'Data Pipeline Integrator', 'Container Security Scanner', 'Low-Code App Studio'
  ];

  const svTemplates = [
    'Cloud Architecture Assessment', 'Disaster Recovery Consulting', 'Managed SOC 24/7',
    'DevOps Staff Augmentation', 'Incident Response Guarantee', 'Performance Audit Drill',
    'Compliance Readiness Audit', 'High-Availability SLA 99.99%', 'Database Tuning Service',
    'Network Penetration Test', 'Data Migration Specialist', 'Kubernetes Cluster Setup',
    'Executive Security Briefing', 'Custom API Integration', 'Continuous Monitoring Retainer'
  ];

  // 75 Hardware items
  for (let i = 2; i <= 76; i++) {
    const tpl = hwTemplates[(i - 2) % hwTemplates.length];
    const itemNum = String(i).padStart(3, '0');
    additionalProductsData.push({
      id: `prod_hw_${itemNum}`,
      sku: `HW-ITM-${itemNum}`,
      name: `${tpl} (Gen ${Math.floor(i / 10) + 1}.${i % 10})`,
      categoryId: hardware.id,
      sellingPrice: Math.round(40000 + ((i * 3700) % 210000)),
      costPrice: Math.round(25000 + ((i * 2300) % 130000)),
      billingType: 'ONE_TIME',
      billingInterval: null,
      isActive: true,
    });
  }

  // 75 Software items
  for (let i = 2; i <= 76; i++) {
    const tpl = swTemplates[(i - 2) % swTemplates.length];
    const itemNum = String(i).padStart(3, '0');
    const isRecurring = i % 2 === 0;
    additionalProductsData.push({
      id: `prod_sw_${itemNum}`,
      sku: `SW-ITM-${itemNum}`,
      name: `${tpl} (v${Math.floor(i / 5) + 1}.${i % 5})`,
      categoryId: software.id,
      sellingPrice: Math.round(30000 + ((i * 4100) % 180000)),
      costPrice: Math.round(10000 + ((i * 1500) % 60000)),
      billingType: isRecurring ? 'RECURRING' : 'ONE_TIME',
      billingInterval: isRecurring ? (i % 4 === 0 ? 'YEARLY' : 'MONTHLY') : null,
      isActive: true,
    });
  }

  // 74 Services items
  for (let i = 2; i <= 75; i++) {
    const tpl = svTemplates[(i - 2) % svTemplates.length];
    const itemNum = String(i).padStart(3, '0');
    const isRecurring = i % 3 === 0;
    additionalProductsData.push({
      id: `prod_sv_${itemNum}`,
      sku: `SV-ITM-${itemNum}`,
      name: `${tpl} Level ${Math.floor(i / 8) + 1}`,
      categoryId: services.id,
      sellingPrice: Math.round(25000 + ((i * 2900) % 150000)),
      costPrice: Math.round(15000 + ((i * 1800) % 80000)),
      billingType: isRecurring ? 'RECURRING' : 'ONE_TIME',
      billingInterval: isRecurring ? 'MONTHLY' : null,
      isActive: true,
    });
  }

  await prisma.product.createMany({
    data: additionalProductsData,
  });

  // 7. Discount Policies
  await prisma.discountPolicy.createMany({
    data: [
      {
        name: 'Gold Hardware Policy',
        tierId: goldTier.id,
        categoryId: hardware.id,
        maxDiscountPercent: 15.0,
      },
      {
        name: 'Gold Software Policy',
        tierId: goldTier.id,
        categoryId: software.id,
        maxDiscountPercent: 20.0,
      },
      {
        name: 'Silver Hardware Policy',
        tierId: silverTier.id,
        categoryId: hardware.id,
        maxDiscountPercent: 10.0,
      },
      {
        name: 'Bronze Hardware Policy',
        tierId: bronzeTier.id,
        categoryId: hardware.id,
        maxDiscountPercent: 5.0,
      },
    ],
  });

  // 8. Approval Rules
  await prisma.approvalRule.createMany({
    data: [
      {
        name: 'High Discount Manager Approval',
        minRiskLevel: 'MEDIUM',
        requiredRole: 'SALES_MANAGER',
        autoApproveEligible: true,
      },
      {
        name: 'High Deal Risk Manager Approval',
        minRiskLevel: 'HIGH',
        requiredRole: 'SALES_MANAGER',
        autoApproveEligible: false,
      },
    ],
  });

  // 9. Demo & Auth Users
  const salesRep = await prisma.user.create({
    data: {
      id: 'rep_1',
      firebaseUid: 'uid_rep_1',
      name: 'Alex Sales Rep',
      email: 'salesrep@example.com',
      passwordHash: defaultPasswordHash,
      role: 'SALES_REP',
      isActive: true,
    },
  });

  const salesManager = await prisma.user.create({
    data: {
      id: 'mgr_1',
      firebaseUid: 'uid_mgr_1',
      name: 'Morgan Sales Manager',
      email: 'salesmanager@example.com',
      passwordHash: defaultPasswordHash,
      role: 'SALES_MANAGER',
      isActive: true,
    },
  });

  const opsManager = await prisma.user.create({
    data: {
      id: 'ops_1',
      firebaseUid: 'uid_ops_1',
      name: 'Sam Operations Manager',
      email: 'operations@example.com',
      passwordHash: defaultPasswordHash,
      role: 'OPERATIONS_MANAGER',
      isActive: true,
    },
  });

  const adminUser = await prisma.user.create({
    data: {
      id: 'admin_1',
      firebaseUid: 'uid_admin_1',
      name: 'System Admin',
      email: 'admin@example.com',
      passwordHash: defaultPasswordHash,
      role: 'ADMIN',
      isActive: true,
    },
  });

  const customerUser = await prisma.user.create({
    data: {
      id: 'cust_user_1',
      firebaseUid: 'uid_cust_user_1',
      name: 'Acme Customer User',
      email: 'customer@example.com',
      passwordHash: defaultPasswordHash,
      role: 'CUSTOMER',
      customerId: acme.id,
      isActive: true,
    },
  });

  // 10. Cross-Sell Rule
  await prisma.crossSellRule.create({
    data: {
      triggerProductId: serverProduct.id,
      recommendedProductId: warrantyProduct.id,
      reasonTemplate: 'Customers purchasing Enterprise Server commonly add Extended Warranty to protect hardware investments.',
      minMarginPercent: 30.0,
    },
  });

  // 11. Warehouses
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

  // 12. Inventory Stock Levels for core & catalog products
  const stockEntries: Array<{
    warehouseId: string;
    productId: string;
    quantityOnHand: number;
    quantityReserved: number;
  }> = [
    { warehouseId: bomWarehouse.id, productId: serverProduct.id, quantityOnHand: 5, quantityReserved: 0 },
    { warehouseId: delWarehouse.id, productId: serverProduct.id, quantityOnHand: 3, quantityReserved: 0 },
    { warehouseId: blrWarehouse.id, productId: serverProduct.id, quantityOnHand: 0, quantityReserved: 0 },

    { warehouseId: bomWarehouse.id, productId: networkProduct.id, quantityOnHand: 2, quantityReserved: 0 },
    { warehouseId: delWarehouse.id, productId: networkProduct.id, quantityOnHand: 8, quantityReserved: 0 },
    { warehouseId: blrWarehouse.id, productId: networkProduct.id, quantityOnHand: 10, quantityReserved: 0 },

    { warehouseId: bomWarehouse.id, productId: serviceProduct.id, quantityOnHand: 100, quantityReserved: 0 },
    { warehouseId: bomWarehouse.id, productId: supportProduct.id, quantityOnHand: 100, quantityReserved: 0 },
    { warehouseId: blrWarehouse.id, productId: analyticsProduct.id, quantityOnHand: 15, quantityReserved: 0 },
    { warehouseId: bomWarehouse.id, productId: warrantyProduct.id, quantityOnHand: 50, quantityReserved: 0 },
  ];

  // Seed inventory stock for all additional catalog products
  for (const item of additionalProductsData) {
    stockEntries.push(
      { warehouseId: bomWarehouse.id, productId: item.id, quantityOnHand: 50, quantityReserved: 0 },
      { warehouseId: delWarehouse.id, productId: item.id, quantityOnHand: 50, quantityReserved: 0 },
      { warehouseId: blrWarehouse.id, productId: item.id, quantityOnHand: 50, quantityReserved: 0 }
    );
  }

  await prisma.inventoryStock.createMany({
    data: stockEntries,
  });

  console.log('Seed completed successfully!');
  console.log(`Seeded: 3 Customer Tiers, 6 Customers (${acme.name}, ${nova.name}, ${bluepeak.name}, ${apex.name}, ${zenith.name}, ${vanguard.name}), 3 Categories, 230 Products, 5 Users, 3 Warehouses.`);
}

main()
  .catch((e) => {
    console.error('Error during seed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
