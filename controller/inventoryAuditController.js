import { Op } from "sequelize";
import sequelize from "../config/db.js";

import Item from "../model/item.js";
import Stock from "../model/stockrecord.js";
import Store from "../model/Store.js";

import InventoryAudit from "../model/inventoryAudit.js";
import InventoryAuditItem from "../model/inventoryAuditItem.js";
import InventoryAuditFollowup from "../model/inventoryAuditFollowup.js";
import AuditTrail from "../model/audittrail.js";

/* =========================================================
   HELPERS
========================================================= */

const hasAttr = (model, attr) => !!model?.rawAttributes?.[attr];

const pickAttr = (model, attrs = []) => {
  for (const attr of attrs) {
    if (hasAttr(model, attr)) return attr;
  }
  return null;
};

const getCreatedKey = (model) =>
  pickAttr(model, ["created_at", "createdAt"]) || "id";

const safeNum = (val, def = 0) => {
  const n = Number(val);
  return Number.isFinite(n) ? n : def;
};

const normalizeRole = (role) => String(role || "").toLowerCase();
const normalizeLevel = (level) => String(level || "").toLowerCase();

const getRequestIP = (req) =>
  req.headers["x-forwarded-for"]?.split(",")[0]?.trim() ||
  req.socket?.remoteAddress ||
  req.ip ||
  null;

const getUserAgent = (req) => req.headers["user-agent"] || null;

const getTodayDate = () => new Date().toISOString().slice(0, 10);

const generateAuditNo = (orgId) => {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  const hh = String(now.getHours()).padStart(2, "0");
  const mm = String(now.getMinutes()).padStart(2, "0");
  const ss = String(now.getSeconds()).padStart(2, "0");
  return `AUD-${orgId}-${y}${m}${d}${hh}${mm}${ss}`;
};

/* =========================================================
   USER SCOPE
========================================================= */

const getUserScope = async (user) => {
  const role = normalizeRole(user?.role);
  const level = normalizeLevel(user?.organization_level);

  const organizationId = safeNum(user?.organization_id, null);
  const storeCode = user?.store_code || user?.storeCode || null;

  if (!user?.id || !role) {
    throw new Error("Unauthorized user");
  }

  // SUPER ADMIN
  if (role === "super_admin") {
    return {
      role,
      level: level || "head",
      organization_id: organizationId,
      organization_level: level || "head",
      store_id: null,
      store_code: storeCode,
      store_name: null,
      district_id: null,
      district_code: null,
      district_name: null,
      parent_organization_id: null,
      visible_to_organization_id: null,
    };
  }

  // RETAIL / STORE
  if (level === "retail" || level === "store") {
    if (!organizationId) {
      throw new Error("Store organization_id not found");
    }

    if (!storeCode) {
      throw new Error("Store code not found for this user");
    }

    const store = await Store.findOne({
      where: {
        [Op.or]: [{ id: organizationId }, { store_code: storeCode }],
      },
      attributes: [
        "id",
        "store_code",
        "store_name",
        "district_id",
        "district_code",
        "district_name",
      ],
    });

    if (!store) {
      throw new Error("Store record not found");
    }

    return {
      role,
      level: "retail",
      organization_id: safeNum(store.id),
      organization_level: "retail",
      store_id: safeNum(store.id),
      store_code: store.store_code || storeCode,
      store_name: store.store_name || null,
      district_id: safeNum(store.district_id, null),
      district_code: store.district_code || null,
      district_name: store.district_name || null,
      parent_organization_id: safeNum(store.district_id, null),
      visible_to_organization_id: safeNum(store.district_id, null),
    };
  }

  // DISTRICT
  if (level === "district") {
    return {
      role,
      level: "district",
      organization_id: organizationId,
      organization_level: "district",
      store_id: null,
      store_code: user?.store_code || user?.storeCode || null,
      store_name: null,
      district_id: organizationId,
      district_code: user?.store_code || user?.storeCode || null,
      district_name: null,
      parent_organization_id: null,
      visible_to_organization_id: null,
    };
  }

  throw new Error("Invalid user level");
};

/* =========================================================
   AUDIT LOG
========================================================= */

const createAuditLog = async ({
  t,
  req,
  module,
  entity_type,
  entity_id = null,
  parent_entity_type = null,
  parent_entity_id = null,
  action,
  status = null,
  reference_no = null,
  title = null,
  audit_date = null,
  item_id = null,
  article_code = null,
  sku_code = null,
  item_name = null,
  reason = null,
  remarks = null,
  old_values = null,
  new_values = null,
  meta = null,
  context = {},
}) => {
  await AuditTrail.create(
    {
      module,
      entity_type,
      entity_id,
      parent_entity_type,
      parent_entity_id,
      action,
      status,

      organization_id: context.organization_id || null,
      organization_level: context.organization_level || null,
      parent_organization_id: context.parent_organization_id || null,
      visible_to_organization_id: context.visible_to_organization_id || null,
      store_id: context.store_id || null,
      store_code: context.store_code || null,
      district_id: context.district_id || null,
      district_code: context.district_code || null,

      user_id: context.user_id || null,

      reference_no,
      title,
      audit_date,
      item_id,
      article_code,
      sku_code,
      item_name,

      old_values,
      new_values,
      meta,
      remarks,
      reason,

      ip_address: getRequestIP(req),
      user_agent: getUserAgent(req),
      event_time: new Date(),
    },
    { transaction: t }
  );
};

/* =========================================================
   1) GET TODAY AUDIT ITEMS
========================================================= */

export const getTodayAuditItems = async (req, res) => {
  try {
    const user = req.user;
    const { search, category, metal_type } = req.query;

    const scope = await getUserScope(user);

    const itemWhere = {};
    const stockWhere = {};

    if (
      scope.organization_level === "retail" ||
      scope.organization_level === "district"
    ) {
      itemWhere.organization_id = scope.organization_id;
      stockWhere.organization_id = scope.organization_id;

      if (scope.store_code && hasAttr(Item, "storeCode")) {
        itemWhere.storeCode = scope.store_code;
      }
    } else {
      return res.status(403).json({
        success: false,
        message: "Only retail or district users can access audit items",
      });
    }

    if (category) itemWhere.category = category;
    if (metal_type) itemWhere.metal_type = metal_type;

    if (search) {
      itemWhere[Op.or] = [
        { article_code: { [Op.iLike]: `%${search}%` } },
        { sku_code: { [Op.iLike]: `%${search}%` } },
        { item_name: { [Op.iLike]: `%${search}%` } },
        { category: { [Op.iLike]: `%${search}%` } },
        { purity: { [Op.iLike]: `%${search}%` } },
      ];
    }

    const items = await Item.findAll({
      attributes: [
        "id",
        "article_code",
        "sku_code",
        "item_name",
        "metal_type",
        "category",
        "purity",
        "gross_weight",
        "net_weight",
        "stone_weight",
        "making_charge",
        "purchase_rate",
        "sale_rate",
        "unit",
        "current_status",
        "organization_id",
      ],
      where: itemWhere,
      include: [
        {
          model: Stock,
          as: "stocks",
          required: false,
          where: stockWhere,
          attributes: [
            "id",
            "available_qty",
            "available_weight",
            "reserved_qty",
            "reserved_weight",
            "transit_qty",
            "transit_weight",
            "damaged_qty",
            "damaged_weight",
            "dead_qty",
            "dead_weight",
          ],
        },
      ],
      order: [["id", "DESC"]],
    });

    const data = items.map((item, index) => {
      const stock =
        Array.isArray(item.stocks) && item.stocks.length
          ? item.stocks[0]
          : null;

      return {
        idx: index + 1,
        item_id: safeNum(item.id),
        article_code: item.article_code || "",
        sku_code: item.sku_code || "",
        item_name: item.item_name || "",
        metal_type: item.metal_type || "",
        category: item.category || "",
        purity: item.purity || "",
        gross_weight: safeNum(item.gross_weight),
        net_weight: safeNum(item.net_weight),
        stone_weight: safeNum(item.stone_weight),
        making_charge: safeNum(item.making_charge),
        purchase_rate: safeNum(item.purchase_rate),
        sale_rate: safeNum(item.sale_rate),
        unit: item.unit || "",
        current_status: item.current_status || "",
        system_qty: safeNum(stock?.available_qty),
        system_weight: safeNum(stock?.available_weight),
        stock_id: stock?.id || null,
      };
    });

    return res.status(200).json({
      success: true,
      message: "Audit items fetched successfully",
      audit_date: getTodayDate(),
      organization_id: scope.organization_id,
      organization_level: scope.organization_level,
      store_code: scope.store_code,
      district_code: scope.district_code,
      count: data.length,
      data,
    });
  } catch (error) {
    console.error("getTodayAuditItems error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch audit items",
      error: error.message,
    });
  }
};

/* =========================================================
   2) CREATE DAILY AUDIT
========================================================= */

export const createDailyAudit = async (req, res) => {
  const t = await sequelize.transaction();

  try {
    const user = req.user;
    const { audit_date, remark, items = [], submit = true } = req.body;

    if (!Array.isArray(items) || items.length === 0) {
      await t.rollback();
      return res.status(400).json({
        success: false,
        message: "Audit items are required",
      });
    }

    const scope = await getUserScope(user);
    const finalAuditDate = audit_date || getTodayDate();

    const existingAudit = await InventoryAudit.findOne({
      where: {
        organization_id: scope.organization_id,
        audit_date: finalAuditDate,
        audit_type: "daily",
      },
      transaction: t,
    });

    if (existingAudit) {
      await t.rollback();
      return res.status(400).json({
        success: false,
        message: "Audit already submitted for this date",
      });
    }

    const itemIds = [
      ...new Set(items.map((x) => safeNum(x.item_id)).filter(Boolean)),
    ];

    const dbItems = await Item.findAll({
      where: {
        id: { [Op.in]: itemIds },
        organization_id: scope.organization_id,
      },
      include: [
        {
          model: Stock,
          as: "stocks",
          required: false,
          where: { organization_id: scope.organization_id },
          attributes: ["id", "available_qty", "available_weight"],
        },
      ],
      transaction: t,
    });

    const itemMap = new Map();
    dbItems.forEach((row) => itemMap.set(safeNum(row.id), row));

    const auditHeader = await InventoryAudit.create(
      {
        audit_no: generateAuditNo(scope.organization_id),
        organization_id: scope.organization_id,
        organization_level: scope.organization_level,
        audit_scope: "self",
        audit_date: finalAuditDate,
        audit_type: "daily",
        parent_organization_id: scope.parent_organization_id,
        visible_to_organization_id: scope.visible_to_organization_id,
        store_id: scope.store_id,
        store_code: scope.store_code,
        store_name: scope.store_name,
        district_id: scope.district_id,
        district_code: scope.district_code,
        district_name: scope.district_name,
        total_items: itemIds.length,
        status: submit ? "submitted" : "draft",
        remark: remark || null,
        submitted_at: submit ? new Date() : null,
        created_by: user.id,
      },
      { transaction: t }
    );

    let checked = 0;
    let present = 0;
    let missing = 0;
    let pending = 0;

    for (const row of items) {
      const itemId = safeNum(row.item_id);
      const dbItem = itemMap.get(itemId);
      if (!dbItem) continue;

      const stock =
        Array.isArray(dbItem.stocks) && dbItem.stocks.length
          ? dbItem.stocks[0]
          : null;

      const requestedResult = String(
        row.audit_result || ""
      ).toLowerCase();

      const finalResult = [
        "present",
        "missing",
        "pending",
        "mismatch",
        "extra",
      ].includes(requestedResult)
        ? requestedResult
        : "pending";

      if (finalResult !== "pending") checked++;
      if (finalResult === "present") present++;
      if (finalResult === "missing") missing++;
      if (finalResult === "pending") pending++;

      const systemQty = safeNum(stock?.available_qty);
      const systemWeight = safeNum(stock?.available_weight);

      const physicalQty =
        row.physical_qty !== undefined
          ? safeNum(row.physical_qty)
          : finalResult === "present"
          ? systemQty
          : 0;

      const physicalWeight =
        row.physical_weight !== undefined
          ? safeNum(row.physical_weight)
          : finalResult === "present"
          ? systemWeight
          : 0;

      const auditItem = await InventoryAuditItem.create(
        {
          audit_id: auditHeader.id,
          item_id: dbItem.id,
          article_code: dbItem.article_code,
          sku_code: dbItem.sku_code,
          item_name: dbItem.item_name,
          metal_type: dbItem.metal_type,
          category: dbItem.category,
          purity: dbItem.purity,

          system_qty: systemQty,
          system_weight: systemWeight,
          physical_qty: physicalQty,
          physical_weight: physicalWeight,

          audit_result: finalResult,
          is_checked: finalResult !== "pending",
          is_available: finalResult === "present",
          is_matched:
            finalResult === "present" &&
            physicalQty === systemQty &&
            physicalWeight === systemWeight,
          is_missing: finalResult === "missing",
          is_extra: finalResult === "extra",

          variance_qty: Number((physicalQty - systemQty).toFixed(3)),
          variance_weight: Number(
            (physicalWeight - systemWeight).toFixed(3)
          ),

          checklist_note: row.checklist_note || row.note || null,
          missing_reason: row.missing_reason || null,
          reason_submitted_at: row.missing_reason ? new Date() : null,
          reason_submitted_by: row.missing_reason ? user.id : null,

          escalation_status:
            finalResult === "missing"
              ? row.missing_reason
                ? "under_review"
                : "reason_pending"
              : "none",
        },
        { transaction: t }
      );

      if (finalResult === "missing" && !row.missing_reason) {
        await InventoryAuditFollowup.create(
          {
            audit_id: auditHeader.id,
            audit_item_id: auditItem.id,
            item_id: dbItem.id,
            followup_date: finalAuditDate,
            followup_type: "reason_request",
            status: "open",
            note: "Item marked missing during daily audit. Reason required.",
            created_by: user.id,
          },
          { transaction: t }
        );
      }

      await createAuditLog({
        t,
        req,
        module: "inventory_audit_item",
        entity_type: "audit_item",
        entity_id: auditItem.id,
        parent_entity_type: "audit",
        parent_entity_id: auditHeader.id,
        action:
          finalResult === "missing"
            ? "mark_missing"
            : finalResult === "present"
            ? "mark_present"
            : "mark_pending",
        status: finalResult,
        reference_no: auditHeader.audit_no,
        title: "Audit item updated",
        audit_date: finalAuditDate,
        item_id: dbItem.id,
        article_code: dbItem.article_code,
        sku_code: dbItem.sku_code,
        item_name: dbItem.item_name,
        reason: row.missing_reason || null,
        remarks: row.checklist_note || row.note || null,
        new_values: auditItem.toJSON(),
        context: {
          ...scope,
          user_id: user.id,
        },
      });
    }

    await auditHeader.update(
      {
        checked_items: checked,
        present_items: present,
        missing_items: missing,
        pending_items: pending,
      },
      { transaction: t }
    );

    await createAuditLog({
      t,
      req,
      module: "inventory_audit",
      entity_type: "audit",
      entity_id: auditHeader.id,
      action: submit ? "submit" : "create",
      status: auditHeader.status,
      reference_no: auditHeader.audit_no,
      title: "Daily inventory audit created",
      audit_date: finalAuditDate,
      remarks: remark || null,
      new_values: auditHeader.toJSON(),
      meta: {
        checked,
        present,
        missing,
        pending,
      },
      context: {
        ...scope,
        user_id: user.id,
      },
    });

    await t.commit();

    return res.status(201).json({
      success: true,
      message: "Daily audit submitted successfully",
      data: auditHeader,
    });
  } catch (error) {
    await t.rollback();
    console.error("createDailyAudit error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to create daily audit",
      error: error.message,
    });
  }
};

/* =========================================================
   3) MY AUDIT HISTORY
========================================================= */

export const getMyAuditHistory = async (req, res) => {
  try {
    const scope = await getUserScope(req.user);
    const { date_from, date_to, status } = req.query;

    const whereClause = {
      organization_id: scope.organization_id,
    };

    if (status) whereClause.status = status;

    if (date_from || date_to) {
      whereClause.audit_date = {};
      if (date_from) whereClause.audit_date[Op.gte] = date_from;
      if (date_to) whereClause.audit_date[Op.lte] = date_to;
    }

    const data = await InventoryAudit.findAll({
      where: whereClause,
      order: [["audit_date", "DESC"], [getCreatedKey(InventoryAudit), "DESC"]],
    });

    return res.status(200).json({
      success: true,
      message: "Audit history fetched successfully",
      count: data.length,
      data,
    });
  } catch (error) {
    console.error("getMyAuditHistory error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch audit history",
      error: error.message,
    });
  }
};

/* =========================================================
   4) AUDIT DETAILS
========================================================= */

export const getAuditDetails = async (req, res) => {
  try {
    const user = req.user;
    const scope = await getUserScope(user);
    const { id } = req.params;

    const whereClause = { id: safeNum(id) };

    if (
      normalizeRole(user.role) !== "super_admin" &&
      scope.organization_level !== "head"
    ) {
      whereClause[Op.or] = [
        { organization_id: scope.organization_id },
        { visible_to_organization_id: scope.organization_id },
      ];
    }

    const audit = await InventoryAudit.findOne({
      where: whereClause,
      include: [
        {
          model: InventoryAuditItem,
          as: "audit_items",
          required: false,
        },
      ],
    });

    if (!audit) {
      return res.status(404).json({
        success: false,
        message: "Audit not found",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Audit details fetched successfully",
      data: audit,
    });
  } catch (error) {
    console.error("getAuditDetails error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch audit details",
      error: error.message,
    });
  }
};

/* =========================================================
   5) PENDING REMINDERS
========================================================= */

export const getPendingAuditReminders = async (req, res) => {
  try {
    const scope = await getUserScope(req.user);

    const rows = await InventoryAuditFollowup.findAll({
      where: { status: "open" },
      include: [
        {
          model: InventoryAudit,
          as: "audit",
          required: true,
          where: { organization_id: scope.organization_id },
          attributes: ["id", "audit_no", "audit_date", "status"],
        },
        {
          model: InventoryAuditItem,
          as: "audit_item",
          required: true,
          attributes: [
            "id",
            "item_id",
            "article_code",
            "sku_code",
            "item_name",
            "audit_result",
            "escalation_status",
          ],
        },
      ],
      order: [["followup_date", "ASC"]],
    });

    const data = rows.map((row) => ({
      followup_id: row.id,
      audit_id: row.audit_id,
      audit_no: row.audit?.audit_no,
      audit_date: row.audit?.audit_date,
      audit_item_id: row.audit_item_id,
      item_id: row.audit_item?.item_id,
      article_code: row.audit_item?.article_code,
      sku_code: row.audit_item?.sku_code,
      item_name: row.audit_item?.item_name,
      followup_type: row.followup_type,
      status: row.status,
      note: row.note,
      escalation_status: row.audit_item?.escalation_status,
      message: "This item was marked missing. Please submit reason.",
    }));

    return res.status(200).json({
      success: true,
      message: "Pending reminders fetched successfully",
      count: data.length,
      data,
    });
  } catch (error) {
    console.error("getPendingAuditReminders error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch reminders",
      error: error.message,
    });
  }
};

/* =========================================================
   6) SUBMIT MISSING ITEM REASON
========================================================= */

export const submitMissingItemReason = async (req, res) => {
  const t = await sequelize.transaction();

  try {
    const user = req.user;
    const scope = await getUserScope(user);

    const { audit_item_id } = req.params;
    const { reason, response_note } = req.body;

    if (!reason) {
      await t.rollback();
      return res.status(400).json({
        success: false,
        message: "Reason is required",
      });
    }

    const auditItem = await InventoryAuditItem.findOne({
      where: { id: safeNum(audit_item_id) },
      include: [
        {
          model: InventoryAudit,
          as: "audit",
          required: true,
        },
      ],
      transaction: t,
    });

    if (!auditItem) {
      await t.rollback();
      return res.status(404).json({
        success: false,
        message: "Audit item not found",
      });
    }

    if (
      safeNum(auditItem.audit.organization_id) !==
      safeNum(scope.organization_id)
    ) {
      await t.rollback();
      return res.status(403).json({
        success: false,
        message: "You can update only your own audit items",
      });
    }

    const oldValues = auditItem.toJSON();

    await auditItem.update(
      {
        missing_reason: reason,
        reason_submitted_at: new Date(),
        reason_submitted_by: user.id,
        escalation_status: "under_review",
        checklist_note: response_note || auditItem.checklist_note,
      },
      { transaction: t }
    );

    await InventoryAuditFollowup.update(
      {
        status: "responded",
        response_note: response_note || reason,
        responded_by: user.id,
        responded_at: new Date(),
      },
      {
        where: {
          audit_item_id: auditItem.id,
          status: "open",
        },
        transaction: t,
      }
    );

    await createAuditLog({
      t,
      req,
      module: "inventory_followup",
      entity_type: "followup",
      entity_id: auditItem.id,
      parent_entity_type: "audit",
      parent_entity_id: auditItem.audit_id,
      action: "reason_submitted",
      status: "under_review",
      reference_no: auditItem.audit.audit_no,
      title: "Missing item reason submitted",
      audit_date: auditItem.audit.audit_date,
      item_id: auditItem.item_id,
      article_code: auditItem.article_code,
      sku_code: auditItem.sku_code,
      item_name: auditItem.item_name,
      reason,
      remarks: response_note || null,
      old_values: oldValues,
      new_values: auditItem.toJSON(),
      context: {
        ...scope,
        user_id: user.id,
      },
    });

    await t.commit();

    return res.status(200).json({
      success: true,
      message: "Reason submitted successfully",
      data: auditItem,
    });
  } catch (error) {
    await t.rollback();
    console.error("submitMissingItemReason error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to submit reason",
      error: error.message,
    });
  }
};

/* =========================================================
   7) REVIEW LIST
========================================================= */

export const getReviewAudits = async (req, res) => {
  try {
    const user = req.user;
    const role = normalizeRole(user?.role);
    const level = normalizeLevel(user?.organization_level);
    const orgId = safeNum(user?.organization_id, null);

    const { date_from, date_to, status, organization_level } = req.query;

    const whereClause = {};

    if (level === "district") {
      whereClause.visible_to_organization_id = orgId;
    } else if (role === "super_admin" || level === "head") {
      // all access
    } else {
      return res.status(403).json({
        success: false,
        message: "Unauthorized to review audits",
      });
    }

    if (status) whereClause.status = status;
    if (organization_level) {
      whereClause.organization_level = organization_level;
    }

    if (date_from || date_to) {
      whereClause.audit_date = {};
      if (date_from) whereClause.audit_date[Op.gte] = date_from;
      if (date_to) whereClause.audit_date[Op.lte] = date_to;
    }

    const data = await InventoryAudit.findAll({
      where: whereClause,
      order: [["audit_date", "DESC"], [getCreatedKey(InventoryAudit), "DESC"]],
    });

    return res.status(200).json({
      success: true,
      message: "Review audits fetched successfully",
      count: data.length,
      data,
    });
  } catch (error) {
    console.error("getReviewAudits error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch review audits",
      error: error.message,
    });
  }
};

/* =========================================================
   8) REVIEW AUDIT
========================================================= */

export const reviewAudit = async (req, res) => {
  const t = await sequelize.transaction();

  try {
    const user = req.user;
    const role = normalizeRole(user?.role);
    const level = normalizeLevel(user?.organization_level);
    const orgId = safeNum(user?.organization_id, null);

    const { id } = req.params;
    const { status = "reviewed", remark } = req.body;

    const allowed = ["reviewed", "closed", "escalated"];

    if (!allowed.includes(status)) {
      await t.rollback();
      return res.status(400).json({
        success: false,
        message: "Invalid status",
      });
    }

    const audit = await InventoryAudit.findOne({
      where: { id: safeNum(id) },
      transaction: t,
    });

    if (!audit) {
      await t.rollback();
      return res.status(404).json({
        success: false,
        message: "Audit not found",
      });
    }

    if (level === "district") {
      if (safeNum(audit.visible_to_organization_id) !== orgId) {
        await t.rollback();
        return res.status(403).json({
          success: false,
          message: "This audit is not assigned to your district",
        });
      }
    } else if (!(role === "super_admin" || level === "head")) {
      await t.rollback();
      return res.status(403).json({
        success: false,
        message: "Unauthorized",
      });
    }

    const oldValues = audit.toJSON();

    await audit.update(
      {
        status,
        reviewed_at: new Date(),
        reviewed_by: user.id,
        closed_at: status === "closed" ? new Date() : null,
        closed_by: status === "closed" ? user.id : null,
        remark: remark || audit.remark,
      },
      { transaction: t }
    );

    await createAuditLog({
      t,
      req,
      module: "inventory_audit",
      entity_type: "audit",
      entity_id: audit.id,
      action: status,
      status,
      reference_no: audit.audit_no,
      title: `Audit ${status}`,
      audit_date: audit.audit_date,
      remarks: remark || null,
      old_values: oldValues,
      new_values: audit.toJSON(),
      context: {
        organization_id: audit.organization_id,
        organization_level: audit.organization_level,
        parent_organization_id: audit.parent_organization_id,
        visible_to_organization_id: audit.visible_to_organization_id,
        store_id: audit.store_id,
        store_code: audit.store_code,
        district_id: audit.district_id,
        district_code: audit.district_code,
        user_id: user.id,
      },
    });

    await t.commit();

    return res.status(200).json({
      success: true,
      message: `Audit ${status} successfully`,
      data: audit,
    });
  } catch (error) {
    await t.rollback();
    console.error("reviewAudit error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to review audit",
      error: error.message,
    });
  }
};