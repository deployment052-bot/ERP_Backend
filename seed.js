import "dotenv/config";
import bcrypt from "bcryptjs";
import sequelize from "./config/db.js";

import User from "./model/user.js";
import State from "./model/State.js";
import District from "./model/District.js";
import Store from "./model/Store.js";
import Item from "./model/item.js";
import Stock from "./model/stockrecord.js";
import StockMovement from "./model/stockmovement.js";
import StockRequest from "./model/StockRequest.js";
import StockRequestItem from "./model/stockRequestItem.js";
import StockTransfer from "./model/stockTransfer.js";
import StockTransferItem from "./model/stockTransferItem.js";
import AuditTrail from "./model/audittrail.js";
import ActivityLog from "./model/activityLog.js";

const SALT_ROUNDS = 10;

const rand = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
const nowSuffix = () => `${Date.now()}${Math.floor(Math.random() * 1000)}`;

const slug = (str) =>
  String(str)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");

const daysAgo = (n) => {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d;
};

const buildRequestNo = (stateCode, districtCode, storeCode, n) =>
  `REQ-${stateCode}-${districtCode}-${storeCode}-${String(n).padStart(5, "0")}-${nowSuffix()}`;

const buildTransferNo = (stateCode, districtCode, storeCode, n) =>
  `TRF-${stateCode}-${districtCode}-${storeCode}-${String(n).padStart(5, "0")}-${nowSuffix()}`;

const hasAttr = (model, attrName) => !!model?.rawAttributes?.[attrName];

function pickAttr(model, ...names) {
  for (const name of names) {
    if (hasAttr(model, name)) return name;
  }
  return null;
}

function addIfSupported(model, payload, attrNames, value) {
  if (value === undefined) return;
  const key = pickAttr(model, ...(Array.isArray(attrNames) ? attrNames : [attrNames]));
  if (key) payload[key] = value;
}

function normalizeOrgLevel(value) {
  const v = String(value || "").toLowerCase();

  // Store model enum ke hisaab se map
  if (v === "head_office") return "head_office";

  const orgKey = pickAttr(Store, "organizationlevel", "organization_level");
  if (orgKey) {
    const attr = Store.rawAttributes[orgKey];
    const allowed = attr?.values || [];
    if (allowed.includes("state")) return "state";
    if (allowed.includes("district")) return "district";
    if (allowed.includes("retail")) return "retail";
    if (allowed.includes("State") && v === "state") return "State";
    if (allowed.includes("District") && v === "district") return "District";
    if (allowed.includes("Retail") && v === "retail") return "Retail";
  }

  if (v === "state") return "State";
  if (v === "district") return "District";
  if (v === "retail") return "Retail";
  return value;
}

async function safeCreate(model, payload, transaction) {
  try {
    return await model.create(payload, { transaction });
  } catch (error) {
    console.log(`⚠️ ${model.name} create failed:`, error.message);
    console.log(`🧾 ${model.name} payload:`, payload);
    throw error;
  }
}

function getValue(obj, ...keys) {
  for (const key of keys) {
    if (obj?.[key] !== undefined && obj?.[key] !== null) return obj[key];
    if (obj?.dataValues?.[key] !== undefined && obj?.dataValues?.[key] !== null) {
      return obj.dataValues[key];
    }
  }
  return null;
}

function getStoreCode(store) {
  return getValue(store, "storeCode", "store_code");
}

function getStoreName(store) {
  return getValue(store, "storeName", "store_name");
}

function getOrganizationLevel(store) {
  return getValue(store, "organizationlevel", "organization_level");
}

function getDistrictId(store) {
  return getValue(store, "district_id", "districtId");
}

function setVirtualOrgCodes(instance, stateCode, districtCode) {
  if (!instance) return;
  instance.setDataValue("state_code", stateCode);
  instance.setDataValue("district_code", districtCode);
}

function buildStorePayload(data) {
  const payload = {};

  const storeCode = data.storeCode ?? data.store_code;
  const storeName = data.storeName ?? data.store_name;

  if (!storeCode) throw new Error("storeCode missing");
  if (!storeName) throw new Error("storeName missing");

  addIfSupported(Store, payload, ["storeCode", "store_code"], String(storeCode));
  addIfSupported(Store, payload, ["storeName", "store_name"], String(storeName));
  addIfSupported(
    Store,
    payload,
    ["organizationlevel", "organization_level"],
    normalizeOrgLevel(data.organizationLevel ?? data.organizationlevel ?? data.organization_level ?? "retail")
  );
  addIfSupported(Store, payload, ["district_id", "districtId"], data.district_id ?? null);
  addIfSupported(Store, payload, ["address"], data.address ?? null);
  addIfSupported(Store, payload, ["phoneNumber", "phone_number"], data.phoneNumber ?? data.phone_number ?? null);
  addIfSupported(Store, payload, ["isActive", "is_active"], data.isActive ?? data.is_active ?? true);

  return payload;
}

function buildStatePayload(data) {
  const payload = {};
  addIfSupported(State, payload, ["stateName", "state_name"], data.state_name);
  addIfSupported(State, payload, ["stateCode", "state_code"], data.state_code);
  addIfSupported(State, payload, ["isActive", "is_active"], data.is_active ?? true);
  return payload;
}

function buildDistrictPayload(data) {
  const payload = {};
  addIfSupported(District, payload, ["districtName", "district_name"], data.district_name);
  addIfSupported(District, payload, ["districtCode", "district_code"], data.district_code);
  addIfSupported(District, payload, ["state_id", "stateId"], data.state_id);
  addIfSupported(District, payload, ["isActive", "is_active"], data.is_active ?? true);
  return payload;
}

function getOrgUserPayload({
  name,
  email,
  role,
  org,
  passwordHash,
  phoneSuffix,
}) {
  const orgCode = getStoreCode(org);
  const orgName = getStoreName(org);
  const orgLevel = getOrganizationLevel(org);

  const payload = {
    name,
    email,
    username: slug(email),
    role,
    password: passwordHash,
    user_code: `${orgCode}-${role.toUpperCase().replace(/\s+/g, "_")}-${nowSuffix()}`,
  };

  addIfSupported(User, payload, ["phone_number", "phoneNumber"], `9${String(phoneSuffix).padStart(9, "0")}`.slice(0, 10));
  addIfSupported(User, payload, ["organization_id", "organizationId"], org.id);
  addIfSupported(User, payload, ["store_code", "storeCode"], orgCode);
  addIfSupported(User, payload, ["store_name", "storeName"], orgName);
  addIfSupported(User, payload, ["district_code", "districtCode"], org.dataValues?.district_code || null);
  addIfSupported(User, payload, ["state_code", "stateCode"], org.dataValues?.state_code || null);
  addIfSupported(User, payload, ["organization_level", "organizationlevel"], orgLevel);
  addIfSupported(User, payload, ["is_police_verified", "isPoliceVerified"], true);
  addIfSupported(User, payload, ["is_active", "isActive"], true);

  return payload;
}

async function createAudit({
  transaction,
  module,
  entity_type,
  entity_id = null,
  action,
  organization_id = null,
  user_id = null,
  reference_no = null,
  title = null,
  old_values = null,
  new_values = null,
  meta = null,
  remarks = null,
  created_at = null,
}) {
  if (!AuditTrail) return null;

  const payload = {
    module,
    entity_type,
    entity_id,
    action,
    organization_id,
    user_id,
    reference_no,
    title,
    old_values,
    new_values,
    meta,
    remarks,
    ip_address: "127.0.0.1",
    user_agent: "Seeder Script",
  };

  if (hasAttr(AuditTrail, "created_at") && created_at) payload.created_at = created_at;
  if (hasAttr(AuditTrail, "createdAt") && created_at) payload.createdAt = created_at;

  return safeCreate(AuditTrail, payload, transaction);
}

async function createActivity({
  transaction,
  branch_id = null,
  user_id = null,
  action,
  title,
  description = null,
  meta = null,
  icon = "activity",
  color = "blue",
  createdAt = null,
  updatedAt = null,
}) {
  if (!ActivityLog) return null;

  const payload = {
    action,
    title,
    description,
    meta,
    icon,
    color,
  };

  addIfSupported(ActivityLog, payload, ["branch_id", "branchId"], branch_id);
  addIfSupported(ActivityLog, payload, ["user_id", "userId"], user_id);

  if (hasAttr(ActivityLog, "createdAt") && createdAt) payload.createdAt = createdAt;
  if (hasAttr(ActivityLog, "updatedAt") && updatedAt) payload.updatedAt = updatedAt;
  if (hasAttr(ActivityLog, "created_at") && createdAt) payload.created_at = createdAt;
  if (hasAttr(ActivityLog, "updated_at") && updatedAt) payload.updated_at = updatedAt;

  return safeCreate(ActivityLog, payload, transaction);
}

async function createMovement({
  transaction,
  organization_id,
  item_id,
  movement_type,
  reference_type = null,
  reference_id = null,
  qty = 0,
  weight = 0,
  stockBefore,
  stockAfter,
  remarks = null,
  created_at = null,
}) {
  if (!StockMovement) return null;

  const payload = {
    organization_id,
    item_id,
    movement_type,
    reference_type,
    reference_id,
    qty,
    weight,

    opening_available_qty: Number(stockBefore.available_qty || 0),
    closing_available_qty: Number(stockAfter.available_qty || 0),

    opening_reserved_qty: Number(stockBefore.reserved_qty || 0),
    closing_reserved_qty: Number(stockAfter.reserved_qty || 0),

    opening_transit_qty: Number(stockBefore.transit_qty || 0),
    closing_transit_qty: Number(stockAfter.transit_qty || 0),

    opening_damaged_qty: Number(stockBefore.damaged_qty || 0),
    closing_damaged_qty: Number(stockAfter.damaged_qty || 0),

    opening_available_weight: Number(stockBefore.available_weight || 0),
    closing_available_weight: Number(stockAfter.available_weight || 0),

    opening_reserved_weight: Number(stockBefore.reserved_weight || 0),
    closing_reserved_weight: Number(stockAfter.reserved_weight || 0),

    opening_transit_weight: Number(stockBefore.transit_weight || 0),
    closing_transit_weight: Number(stockAfter.transit_weight || 0),

    opening_damaged_weight: Number(stockBefore.damaged_weight || 0),
    closing_damaged_weight: Number(stockAfter.damaged_weight || 0),

    remarks,
  };

  if (hasAttr(StockMovement, "created_at") && created_at) payload.created_at = created_at;
  if (hasAttr(StockMovement, "createdAt") && created_at) payload.createdAt = created_at;

  return safeCreate(StockMovement, payload, transaction);
}

async function createUser({ transaction, defaults }) {
  return await safeCreate(User, defaults, transaction);
}

async function createOrgUsers({ transaction, org, passwordHash, counterRef }) {
  const users = [];
  const orgLevel = String(getOrganizationLevel(org) || "").toLowerCase();
  const orgCode = getStoreCode(org);
  const orgName = getStoreName(org);

  if (orgLevel === "head_office") {
    users.push(
      await createUser({
        transaction,
        defaults: getOrgUserPayload({
          name: "Head Super Admin",
          email: `super_admin_${slug(orgCode)}_${nowSuffix()}@demo.com`,
          role: "super_admin",
          org,
          passwordHash,
          phoneSuffix: counterRef.value++,
        }),
      })
    );

    users.push(
      await createUser({
        transaction,
        defaults: getOrgUserPayload({
          name: "Head Store Manager",
          email: `store_manager_${slug(orgCode)}_${nowSuffix()}@demo.com`,
          role: "store_manager",
          org,
          passwordHash,
          phoneSuffix: counterRef.value++,
        }),
      })
    );

    users.push(
      await createUser({
        transaction,
        defaults: getOrgUserPayload({
          name: "Head Inventory Manager",
          email: `inventory_manager_${slug(orgCode)}_${nowSuffix()}@demo.com`,
          role: "inventory_manager",
          org,
          passwordHash,
          phoneSuffix: counterRef.value++,
        }),
      })
    );
  }

  users.push(
    await createUser({
      transaction,
      defaults: getOrgUserPayload({
        name: `${orgName} Manager`,
        email: `${slug(orgCode)}_manager_${nowSuffix()}@demo.com`,
        role: "manager",
        org,
        passwordHash,
        phoneSuffix: counterRef.value++,
      }),
    })
  );

  users.push(
    await createUser({
      transaction,
      defaults: getOrgUserPayload({
        name: `${orgName} TL`,
        email: `${slug(orgCode)}_tl_${nowSuffix()}@demo.com`,
        role: "tl",
        org,
        passwordHash,
        phoneSuffix: counterRef.value++,
      }),
    })
  );

  users.push(
    await createUser({
      transaction,
      defaults: getOrgUserPayload({
        name: `${orgName} Sales Girl`,
        email: `${slug(orgCode)}_salesgirl_${nowSuffix()}@demo.com`,
        role: "sales_girl",
        org,
        passwordHash,
        phoneSuffix: counterRef.value++,
      }),
    })
  );

  return users;
}

function getItemTemplate(metal, idx) {
  const goldCats = ["Ring", "Chain", "Bangle", "Pendant", "Earring", "Necklace", "Coin", "Bracelet"];
  const silverCats = ["Payal", "Coin", "Glass", "Bowl", "Pooja Item", "Ring", "Chain", "Bracelet"];
  const goldPurities = ["22K", "24K", "18K"];
  const silverPurities = ["999", "925"];

  const category = metal === "Gold" ? pick(goldCats) : pick(silverCats);
  const purity = metal === "Gold" ? pick(goldPurities) : pick(silverPurities);
  const gross = metal === "Gold" ? rand(4, 35) : rand(8, 80);
  const net = Math.max(1, gross - rand(0, 3));
  const stoneWeight = metal === "Gold" ? rand(0, 3) : 0;
  const stoneAmount = stoneWeight > 0 ? rand(800, 6000) : 0;

  return {
    metal,
    category,
    purity,
    gross_weight: gross,
    net_weight: net,
    stone_weight: stoneWeight,
    stone_amount: stoneAmount,
    making_charge: metal === "Gold" ? rand(300, 2500) : rand(100, 1200),
    purchase_rate: metal === "Gold" ? rand(5200, 7200) : rand(60, 110),
    sale_rate: metal === "Gold" ? rand(6000, 8500) : rand(80, 140),
    unit: "gram",
    hsn_code: metal === "Gold" ? "7113" : "7114",
    item_name: `${metal} ${category} ${idx}`,
    details: `${metal} ${category} seeded item`,
  };
}

async function createItemsAndStocksForOrg({
  transaction,
  org,
  createdByUser,
}) {
  const createdItems = [];
  const orgCode = getStoreCode(org);

  for (const metal of ["Gold", "Silver"]) {
    for (let i = 1; i <= 25; i++) {
      const t = getItemTemplate(metal, i);

      const uniq = nowSuffix();
      const articleCode = `${orgCode}-${metal === "Gold" ? "GLD" : "SLV"}-${String(i).padStart(3, "0")}-${uniq}`;
      const skuCode = `SKU-${articleCode}`;

      const item = await safeCreate(
        Item,
        {
          article_code: articleCode,
          sku_code: skuCode,
          item_name: t.item_name,
          metal_type: metal,
          category: t.category,
          details: t.details,
          purity: t.purity,
          gross_weight: t.gross_weight,
          net_weight: t.net_weight,
          stone_weight: t.stone_weight,
          stone_amount: t.stone_amount,
          making_charge: t.making_charge,
          purchase_rate: t.purchase_rate,
          sale_rate: t.sale_rate,
          hsn_code: t.hsn_code,
          unit: t.unit,
          current_status: "in_stock",
          organization_id: org.id,
        },
        transaction
      );

      const qty = rand(1, 8);
      const weight = Number((qty * Number(t.gross_weight)).toFixed(3));

      const stock = await safeCreate(
        Stock,
        {
          organization_id: org.id,
          item_id: item.id,
          available_qty: qty,
          available_weight: weight,
          reserved_qty: 0,
          reserved_weight: 0,
          transit_qty: 0,
          transit_weight: 0,
          damaged_qty: 0,
          damaged_weight: 0,
        },
        transaction
      );

      await createMovement({
        transaction,
        organization_id: org.id,
        item_id: item.id,
        movement_type: "opening",
        reference_type: "seed",
        reference_id: item.id,
        qty,
        weight,
        stockBefore: {
          available_qty: 0,
          reserved_qty: 0,
          transit_qty: 0,
          damaged_qty: 0,
          available_weight: 0,
          reserved_weight: 0,
          transit_weight: 0,
          damaged_weight: 0,
        },
        stockAfter: {
          available_qty: Number(stock.available_qty || qty),
          reserved_qty: Number(stock.reserved_qty || 0),
          transit_qty: Number(stock.transit_qty || 0),
          damaged_qty: Number(stock.damaged_qty || 0),
          available_weight: Number(stock.available_weight || weight),
          reserved_weight: Number(stock.reserved_weight || 0),
          transit_weight: Number(stock.transit_weight || 0),
          damaged_weight: Number(stock.damaged_weight || 0),
        },
        remarks: "Opening seeded stock",
        created_at: daysAgo(rand(20, 40)),
      });

      await createAudit({
        transaction,
        module: "stock",
        entity_type: "item",
        entity_id: item.id,
        action: "create",
        organization_id: org.id,
        user_id: createdByUser?.id || null,
        reference_no: articleCode,
        title: `Item seeded - ${item.item_name}`,
        new_values: item.toJSON(),
        remarks: "Seeded initial item/stock",
        created_at: daysAgo(rand(20, 40)),
      });

      await createActivity({
        transaction,
        branch_id: org.id,
        user_id: createdByUser?.id || null,
        action: "item_seeded",
        title: `Item ${item.article_code} ready`,
        description: `${item.item_name} available in stock`,
        meta: {
          item_id: item.id,
          article_code: item.article_code,
          stock_id: stock.id,
        },
        icon: "package",
        color: metal === "Gold" ? "yellow" : "gray",
        createdAt: daysAgo(rand(20, 40)),
        updatedAt: daysAgo(rand(20, 40)),
      });

      createdItems.push({ item, stock });
    }
  }

  return createdItems;
}

async function createStore({ transaction, payload, stateCode, districtCode }) {
  const store = await safeCreate(Store, payload, transaction);
  setVirtualOrgCodes(store, stateCode, districtCode);
  return store;
}

async function createRequestAndTransferFlow({
  transaction,
  requestCounterRef,
  transferCounterRef,
  fromStore,
  toDistrictStore,
  fromUsers,
  toUsers,
  candidateItems,
}) {
  const requester =
    fromUsers.find((u) => u.role === "manager") ||
    fromUsers.find((u) => u.role === "tl") ||
    fromUsers[0];

  const approver =
    toUsers.find((u) => u.role === "manager") ||
    toUsers.find((u) => u.role === "tl") ||
    toUsers[0];

  const receiver =
    fromUsers.find((u) => u.role === "tl") ||
    fromUsers.find((u) => u.role === "manager") ||
    fromUsers[0];

  const selected = candidateItems.slice(0, 3);
  if (!selected.length) return null;

  const reqDate = daysAgo(rand(2, 8));
  const approveDate = daysAgo(rand(1, 4));
  const dispatchDate = daysAgo(rand(1, 3));
  const receiveDate = daysAgo(rand(0, 2));

  const fromStoreCode = getStoreCode(fromStore);
  const fromStoreName = getStoreName(fromStore);
  const toDistrictStoreCode = getStoreCode(toDistrictStore);
  const toDistrictStoreName = getStoreName(toDistrictStore);

  const requestPayload = {
    request_no: buildRequestNo(
      fromStore.dataValues?.state_code || "ST",
      fromStore.dataValues?.district_code || "DT",
      fromStoreCode,
      requestCounterRef.value++
    ),
    from_store_code: fromStoreCode,
    from_store_name: fromStoreName,
    to_district_code: toDistrictStore.dataValues?.district_code || toDistrictStoreCode,
    priority: pick(["medium", "high", "critical"]),
    category: "store_replenishment",
    notes: `Auto seeded request from ${fromStoreName} to ${toDistrictStoreName}`,
    status: "completed",
    created_by: requester?.id || null,
    approved_by: approver?.id || null,
    approved_at: approveDate,
  };

  if (hasAttr(StockRequest, "from_organization_id")) {
    requestPayload.from_organization_id = fromStore.id;
  }
  if (hasAttr(StockRequest, "to_organization_id")) {
    requestPayload.to_organization_id = toDistrictStore.id;
  }

  const request = await safeCreate(StockRequest, requestPayload, transaction);

  for (const { item, stock } of selected) {
    const reqQty = Math.min(Number(stock.available_qty || 0), rand(1, 2));
    if (reqQty <= 0) continue;

    const reqWeight = Number((reqQty * Number(item.gross_weight)).toFixed(3));

    await safeCreate(
      StockRequestItem,
      {
        request_id: request.id,
        item_id: item.id,
        qty: reqQty,
        weight: reqWeight,
        rate: Number(item.sale_rate || 0),
        approved_qty: reqQty,
        approved_weight: reqWeight,
        remarks: "Approved in seeded flow",
      },
      transaction
    );
  }

  const transfer = await safeCreate(
    StockTransfer,
    {
      transfer_no: buildTransferNo(
        fromStore.dataValues?.state_code || "ST",
        fromStore.dataValues?.district_code || "DT",
        fromStoreCode,
        transferCounterRef.value++
      ),
      request_id: request.id,
      from_organization_id: toDistrictStore.id,
      to_organization_id: fromStore.id,
      transfer_date: reqDate,
      dispatch_date: dispatchDate,
      receive_date: receiveDate,
      status: "received",
      remarks: `Seeded transfer against ${request.request_no}`,
      approved_by: approver?.id || null,
      dispatched_by: approver?.id || null,
      received_by: receiver?.id || null,
      created_by: approver?.id || null,
    },
    transaction
  );

  const requestItems = await StockRequestItem.findAll({
    where: { request_id: request.id },
    transaction,
  });

  for (const reqItem of requestItems) {
    const item = selected.find((x) => x.item.id === reqItem.item_id)?.item;
    if (!item) continue;

    await safeCreate(
      StockTransferItem,
      {
        transfer_id: transfer.id,
        item_id: reqItem.item_id,
        qty: reqItem.qty,
        weight: reqItem.weight,
        rate: Number(item.sale_rate || 0),
        remarks: "Seeded transfer item",
      },
      transaction
    );
  }

  await createAudit({
    transaction,
    module: "stock_request",
    entity_type: "request",
    entity_id: request.id,
    action: "create",
    organization_id: fromStore.id,
    user_id: requester?.id || null,
    reference_no: request.request_no,
    title: "Stock request created",
    new_values: request.toJSON(),
    remarks: `Seeded request from ${fromStoreName} to ${toDistrictStoreName}`,
    created_at: reqDate,
  });

  await createActivity({
    transaction,
    branch_id: fromStore.id,
    user_id: requester?.id || null,
    action: "request_created",
    title: `Request ${request.request_no} created`,
    description: `${fromStoreName} requested stock from ${toDistrictStoreName}`,
    meta: { request_id: request.id, transfer_id: transfer.id },
    icon: "clipboard-list",
    color: "orange",
    createdAt: reqDate,
    updatedAt: reqDate,
  });

  return { request, transfer };
}

export async function seedInventoryHierarchyData() {
  const transaction = await sequelize.transaction();

  try {
    console.log("🚀 insert-only seedInventoryHierarchyData started");

    const passwordHash = await bcrypt.hash("Admin@123", SALT_ROUNDS);

    const userCounterRef = { value: 1 };
    const requestCounterRef = { value: 1 };
    const transferCounterRef = { value: 1 };

    const statesMaster = [
      { state_name: "Uttar Pradesh", state_code: "UP" },
      { state_name: "Madhya Pradesh", state_code: "MP" },
      { state_name: "Rajasthan", state_code: "RJ" },
    ];

    const seedRun = nowSuffix();

    const headOffice = await createStore({
      transaction,
      payload: buildStorePayload({
        storeCode: `HO-001-${seedRun}`,
        storeName: "Head Office",
        organizationLevel: "head_office",
        district_id: null,
        phoneNumber: "9999999999",
        isActive: true,
      }),
      stateCode: "HO",
      districtCode: "HO",
    });

    const allOrgUsers = new Map();
    const allOrgItems = new Map();
    const districtStores = [];
    const retailStores = [];

    const headUsers = await createOrgUsers({
      transaction,
      org: headOffice,
      passwordHash,
      counterRef: userCounterRef,
    });
    allOrgUsers.set(headOffice.id, headUsers);

    await createActivity({
      transaction,
      branch_id: headOffice.id,
      user_id: headUsers[0]?.id || null,
      action: "head_office_created",
      title: "Head office seeded",
      description: "Head office and primary roles created",
      meta: { store_id: headOffice.id },
      icon: "building",
      color: "blue",
      createdAt: daysAgo(45),
      updatedAt: daysAgo(45),
    });

    for (let s = 0; s < statesMaster.length; s++) {
      const st = statesMaster[s];

      const state = await safeCreate(
        State,
        buildStatePayload({
          state_name: st.state_name,
          state_code: `${st.state_code}-${seedRun}-${s + 1}`,
          is_active: true,
        }),
        transaction
      );

      const stateStore = await createStore({
        transaction,
        payload: buildStorePayload({
          storeCode: `ST-${st.state_code}-${seedRun}`,
          storeName: `${st.state_name} State Office`,
          organizationLevel: "state",
          district_id: null,
          phoneNumber: `98${String(10000000 + s).slice(-8)}`,
          isActive: true,
        }),
        stateCode: st.state_code,
        districtCode: `${st.state_code}HQ`,
      });

      const stateUsers = await createOrgUsers({
        transaction,
        org: stateStore,
        passwordHash,
        counterRef: userCounterRef,
      });
      allOrgUsers.set(stateStore.id, stateUsers);

      const stateItems = await createItemsAndStocksForOrg({
        transaction,
        org: stateStore,
        createdByUser: stateUsers[0],
      });
      allOrgItems.set(stateStore.id, stateItems);

      for (let d = 1; d <= 5; d++) {
        const districtCode = `${st.state_code}D${String(d).padStart(2, "0")}-${seedRun}`;

        const district = await safeCreate(
          District,
          buildDistrictPayload({
            district_name: `${st.state_name} District ${d}`,
            district_code: districtCode,
            state_id: state.id,
            is_active: true,
          }),
          transaction
        );

        const districtName = getValue(district, "districtName", "district_name") || `${st.state_name} District ${d}`;

        const districtStore = await createStore({
          transaction,
          payload: buildStorePayload({
            storeCode: `DT-${districtCode}`,
            storeName: `${districtName} Office`,
            organizationLevel: "district",
            district_id: district.id,
            phoneNumber: `97${String(10000000 + d + s * 10).slice(-8)}`,
            isActive: true,
          }),
          stateCode: st.state_code,
          districtCode,
        });

        districtStores.push(districtStore);

        const districtUsers = await createOrgUsers({
          transaction,
          org: districtStore,
          passwordHash,
          counterRef: userCounterRef,
        });
        allOrgUsers.set(districtStore.id, districtUsers);

        const districtItems = await createItemsAndStocksForOrg({
          transaction,
          org: districtStore,
          createdByUser: districtUsers[0],
        });
        allOrgItems.set(districtStore.id, districtItems);

        for (let r = 1; r <= 10; r++) {
          const retailCode = `RT-${districtCode}-${String(r).padStart(2, "0")}`;

          const retailStore = await createStore({
            transaction,
            payload: buildStorePayload({
              storeCode: retailCode,
              storeName: `${districtName} Retail Store ${r}`,
              organizationLevel: "retail",
              district_id: district.id,
              phoneNumber: `96${String(10000000 + r + d * 100 + s * 1000).slice(-8)}`,
              isActive: true,
            }),
            stateCode: st.state_code,
            districtCode,
          });

          retailStores.push(retailStore);

          const retailUsers = await createOrgUsers({
            transaction,
            org: retailStore,
            passwordHash,
            counterRef: userCounterRef,
          });
          allOrgUsers.set(retailStore.id, retailUsers);

          const retailItems = await createItemsAndStocksForOrg({
            transaction,
            org: retailStore,
            createdByUser: retailUsers[0],
          });
          allOrgItems.set(retailStore.id, retailItems);
        }
      }
    }

    for (const districtStore of districtStores) {
      const districtRetails = retailStores.filter(
        (r) => getDistrictId(r) === getDistrictId(districtStore)
      );

      const chosenRetails = districtRetails.slice(0, 2);

      for (const retail of chosenRetails) {
        const retailUsers = allOrgUsers.get(retail.id) || [];
        const districtUsers = allOrgUsers.get(districtStore.id) || [];
        const retailItems = allOrgItems.get(retail.id) || [];

        await createRequestAndTransferFlow({
          transaction,
          requestCounterRef,
          transferCounterRef,
          fromStore: retail,
          toDistrictStore: districtStore,
          fromUsers: retailUsers,
          toUsers: districtUsers,
          candidateItems: retailItems,
        });
      }
    }

    await transaction.commit();

    return {
      success: true,
      message: "Insert-only inventory hierarchy pushed successfully",
      summary: {
        head_office: 1,
        states: 3,
        districts: 15,
        retail_stores: 150,
        total_stores: 169,
        password_for_all_users: "Admin@123",
      },
    };
  } catch (error) {
    await transaction.rollback();
    console.error("seedInventoryHierarchyData error:", error);
    throw error;
  }
}