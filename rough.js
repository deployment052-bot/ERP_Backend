export const createDailyAudit = async (req, res) => {
  const t = await sequelize.transaction();

  try {
    const user = req.user;
    const {
      audit_date,
      remark,
      category,
      items = [],
      submit = true,
    } = req.body;

    if (!Array.isArray(items)) {
      await t.rollback();
      return res.status(400).json({
        success: false,
        message: "Items must be an array",
      });
    }

    if (!category) {
      await t.rollback();
      return res.status(400).json({
        success: false,
        message: "Category is required",
      });
    }

    const scope = await getUserScope(user);
    const finalAuditDate = audit_date || getTodayDate();

    const existingAudit = await InventoryAudit.findOne({
      where: {
        organization_id: scope.organization_id,
        audit_date: finalAuditDate,
        audit_type: "daily",
        remark: { [Op.ne]: null },
      },
      transaction: t,
    });

    if (existingAudit) {
      // optional: same day duplicate audit block
      // category-wise audit chahiye to model/table me category field add karo
    }

    const itemWhere = {
      organization_id: scope.organization_id,
      category,
    };

    if (
      scope.organization_level === "retail" &&
      scope.store_code &&
      hasAttr(Item, "storeCode")
    ) {
      itemWhere.storeCode = scope.store_code;
    }

    const dbItems = await Item.findAll({
      where: itemWhere,
      include: [
        {
          model: Stock,
          as: "stocks",
          required: false,
          where: { organization_id: scope.organization_id },
          attributes: ["id", "item_id", "available_qty", "available_weight"],
        },
      ],
      transaction: t,
      order: [["id", "DESC"]],
    });

    if (!dbItems.length) {
      await t.rollback();
      return res.status(400).json({
        success: false,
        message: "No stock items found for this category audit",
      });
    }

    const submittedMap = new Map();

    for (const row of items) {
      const itemId = safeNum(row.item_id, null);
      if (itemId) {
        submittedMap.set(itemId, row);
      }
    }

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
        total_items: dbItems.length,
        checked_items: 0,
        present_items: 0,
        missing_items: 0,
        pending_items: 0,
        status: submit ? "submitted" : "draft",
        remark: remark || `${category} audit`,
        submitted_at: submit ? new Date() : null,
        created_by: user.id,
      },
      { transaction: t }
    );

    let checked = 0;
    let present = 0;
    let missing = 0;
    let pending = 0;

    for (const dbItem of dbItems) {
      const stock =
        Array.isArray(dbItem.stocks) && dbItem.stocks.length
          ? dbItem.stocks[0]
          : null;

      const submittedRow = submittedMap.get(safeNum(dbItem.id));

      const systemQty = safeNum(stock?.available_qty);
      const systemWeight = safeNum(stock?.available_weight);

      let finalResult = "pending";
      let physicalQty = 0;
      let physicalWeight = 0;
      let checklistNote = null;
      let missingReason = null;
      let isChecked = false;

      if (submittedRow && submittedRow.is_checked === true) {
        isChecked = true;

        const requestedResult = String(
          submittedRow.audit_result || ""
        ).toLowerCase();

        finalResult = ["present", "missing", "mismatch", "extra"].includes(
          requestedResult
        )
          ? requestedResult
          : "present";

        physicalQty =
          submittedRow.physical_qty !== undefined
            ? safeNum(submittedRow.physical_qty)
            : finalResult === "present"
            ? systemQty
            : 0;

        physicalWeight =
          submittedRow.physical_weight !== undefined
            ? safeNum(submittedRow.physical_weight)
            : finalResult === "present"
            ? systemWeight
            : 0;

        checklistNote = submittedRow.checklist_note || submittedRow.note || null;
        missingReason = submittedRow.missing_reason || null;
      } else {
        finalResult = "pending";
        isChecked = false;
        physicalQty = 0;
        physicalWeight = 0;
        checklistNote = "Audit not completed for this item";
      }

      if (isChecked) checked++;
      if (finalResult === "present") present++;
      if (finalResult === "missing") missing++;
      if (finalResult === "pending") pending++;

      const auditItem = await InventoryAuditItem.create(
        {
          audit_id: auditHeader.id,
          item_id: dbItem.id,
          article_code: dbItem.article_code || null,
          sku_code: dbItem.sku_code || null,
          item_name: dbItem.item_name || null,
          metal_type: dbItem.metal_type || null,
          category: dbItem.category || null,
          purity: dbItem.purity || null,

          system_qty: systemQty,
          system_weight: systemWeight,
          physical_qty: physicalQty,
          physical_weight: physicalWeight,

          audit_result: finalResult,
          is_checked: isChecked,
          is_available: finalResult === "present",
          is_matched:
            finalResult === "present" &&
            physicalQty === systemQty &&
            physicalWeight === systemWeight,
          is_missing: finalResult === "missing",
          is_extra: finalResult === "extra",

          variance_qty: Number((physicalQty - systemQty).toFixed(3)),
          variance_weight: Number((physicalWeight - systemWeight).toFixed(3)),

          checklist_note: checklistNote,
          missing_reason: missingReason,
          reason_submitted_at: missingReason ? new Date() : null,
          reason_submitted_by: missingReason ? user.id : null,

          escalation_status:
            finalResult === "missing"
              ? missingReason
                ? "under_review"
                : "reason_pending"
              : finalResult === "pending"
              ? "audit_pending"
              : "none",

          image_url: submittedRow?.image_url || null,
          attachment_url: submittedRow?.attachment_url || null,
        },
        { transaction: t }
      );

      if (finalResult === "missing" && !missingReason) {
        await InventoryAuditFollowup.create(
          {
            audit_id: auditHeader.id,
            audit_item_id: auditItem.id,
            item_id: dbItem.id,
            followup_date: finalAuditDate,
            followup_type: "reason_request",
            status: "open",
            note: "Item marked missing during audit. Reason required.",
            created_by: user.id,
          },
          { transaction: t }
        );
      }

      if (finalResult === "pending") {
        await InventoryAuditFollowup.create(
          {
            audit_id: auditHeader.id,
            audit_item_id: auditItem.id,
            item_id: dbItem.id,
            followup_date: finalAuditDate,
            followup_type: "audit_pending",
            status: "open",
            note: "This item was in stock but audit checkbox was not selected.",
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
        article_code: dbItem.article_code || null,
        sku_code: dbItem.sku_code || null,
        item_name: dbItem.item_name || null,
        reason: missingReason,
        remarks: checklistNote,
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
      remarks: remark || `${category} audit`,
      new_values: auditHeader.toJSON(),
      meta: {
        category,
        total_items: dbItems.length,
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
      data: {
        id: auditHeader.id,
        audit_no: auditHeader.audit_no,
        audit_date: auditHeader.audit_date,
        category,
        organization_id: auditHeader.organization_id,
        organization_level: auditHeader.organization_level,
        total_items: dbItems.length,
        checked_items: checked,
        present_items: present,
        missing_items: missing,
        pending_items: pending,
        status: auditHeader.status,
      },
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




// controllers/LedgerEntry.js

import Customer from "../model/Customer.js";
import LedgerEntry from "../model/LedgerEntry.js";
import Bill from "../model/Bill.js"
// import Customer from "../model/Customer.js";
import Store from "../model/Store.js";
import ExcelJS from "exceljs";
import { Op, fn, literal } from "sequelize";

/**
 * @desc    Get ledger dashboard summary + client wise ledger
 * @route   GET /api/ledger
 */
export const getLedger = async (req, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: "User not authenticated. req.user is missing.",
      });
    }

    const { organization_id } = req.user;
    const { search = "" } = req.query;

    if (!organization_id) {
      return res.status(400).json({
        success: false,
        message: "organization_id is missing in req.user",
      });
    }

    const ledgerWhere = {
      organization_id,
    };

    const customerWhere = {
      organization_id,
    };

    if (search?.trim()) {
      customerWhere[Op.or] = [
        { name: { [Op.iLike]: `%${search.trim()}%` } },
        { phone: { [Op.iLike]: `%${search.trim()}%` } },
      ];
    }

    // ===============================
    // SUMMARY CARDS
    // ===============================
    const summaryRaw = await LedgerEntry.findOne({
      where: ledgerWhere,
      attributes: [
        [
          fn(
            "COALESCE",
            fn(
              "SUM",
              literal(`CASE WHEN "LedgerEntry"."type" = 'DEBIT' THEN 1 ELSE 0 END`)
            ),
            0
          ),
          "total_sales",
        ],
        [
          fn(
            "COALESCE",
            fn(
              "SUM",
              literal(`CASE WHEN "LedgerEntry"."type" = 'CREDIT' THEN 1 ELSE 0 END`)
            ),
            0
          ),
          "goods_receipt",
        ],
      ],
      raw: true,
    });

    const summary = {
      total_sales: Number(summaryRaw?.total_sales || 0),
      loss: 0,
      goods_receipt: Number(summaryRaw?.goods_receipt || 0),
    };

    // ===============================
    // CLIENT WISE TABLE
    // ===============================
    const clientRows = await LedgerEntry.findAll({
      where: ledgerWhere,
      attributes: [
        "customer_id",
        [
          fn(
            "COUNT",
            literal(
              `DISTINCT CASE WHEN "LedgerEntry"."type" = 'DEBIT' THEN "LedgerEntry"."reference_id" END`
            )
          ),
          "total_deals",
        ],
        [
          fn(
            "COALESCE",
            fn(
              "SUM",
              literal(`CASE WHEN "LedgerEntry"."type" = 'DEBIT' THEN "LedgerEntry"."amount" ELSE 0 END`)
            ),
            0
          ),
          "total_amount",
        ],
        [
          fn(
            "COALESCE",
            fn(
              "SUM",
              literal(`CASE WHEN "LedgerEntry"."type" = 'CREDIT' THEN "LedgerEntry"."amount" ELSE 0 END`)
            ),
            0
          ),
          "received_amount",
        ],
        [
          literal(`
            COALESCE(SUM(CASE WHEN "LedgerEntry"."type" = 'DEBIT' THEN "LedgerEntry"."amount" ELSE 0 END), 0)
            -
            COALESCE(SUM(CASE WHEN "LedgerEntry"."type" = 'CREDIT' THEN "LedgerEntry"."amount" ELSE 0 END), 0)
          `),
          "pending_amount",
        ],
      ],
      include: [
        {
          model: Customer,
          as: "Customer",
          attributes: ["id", "name", "phone", "address", "store_code"],
          where: customerWhere,
          required: true,
        },
      ],
      group: ["LedgerEntry.customer_id", "Customer.id"],
      order: [[literal(`"pending_amount"`), "DESC"]],
    });

    const clients = clientRows.map((row) => ({
      customer_id: row.customer_id,
      client_name: row.Customer?.name || "",
      phone: row.Customer?.phone || "",
      address: row.Customer?.address || "",
      store_code: row.Customer?.store_code || "",
      total_deals: Number(row.get("total_deals") || 0),
      total_amount: Number(row.get("total_amount") || 0),
      received_amount: Number(row.get("received_amount") || 0),
      pending_amount: Number(row.get("pending_amount") || 0),
    }));

    return res.status(200).json({
      success: true,
      message: "Ledger dashboard fetched successfully",
      data: {
        summary,
        clients,
      },
    });
  } catch (error) {
    console.error("Ledger Error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch ledger",
      error: error.message,
    });
  }
};


export const downloadLedgerExcel = async (req, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: "User not authenticated. req.user is missing.",
      });
    }

    const { organization_id } = req.user;
    const { search = "" } = req.query;

    if (!organization_id) {
      return res.status(400).json({
        success: false,
        message: "organization_id is missing in req.user",
      });
    }

    const ledgerWhere = { organization_id };
    const customerWhere = { organization_id };

    if (search?.trim()) {
      customerWhere[Op.or] = [
        { name: { [Op.iLike]: `%${search.trim()}%` } },
        { phone: { [Op.iLike]: `%${search.trim()}%` } },
      ];
    }

    const clientRows = await LedgerEntry.findAll({
      where: ledgerWhere,
      attributes: [
        "customer_id",
        [
          fn(
            "COUNT",
            literal(
              `DISTINCT CASE WHEN "LedgerEntry"."type" = 'DEBIT' THEN "LedgerEntry"."reference_id" END`
            )
          ),
          "total_deals",
        ],
        [
          fn(
            "COALESCE",
            fn(
              "SUM",
              literal(`CASE WHEN "LedgerEntry"."type" = 'DEBIT' THEN "LedgerEntry"."amount" ELSE 0 END`)
            ),
            0
          ),
          "total_amount",
        ],
        [
          fn(
            "COALESCE",
            fn(
              "SUM",
              literal(`CASE WHEN "LedgerEntry"."type" = 'CREDIT' THEN "LedgerEntry"."amount" ELSE 0 END`)
            ),
            0
          ),
          "received_amount",
        ],
        [
          literal(`
            COALESCE(SUM(CASE WHEN "LedgerEntry"."type" = 'DEBIT' THEN "LedgerEntry"."amount" ELSE 0 END), 0)
            -
            COALESCE(SUM(CASE WHEN "LedgerEntry"."type" = 'CREDIT' THEN "LedgerEntry"."amount" ELSE 0 END), 0)
          `),
          "pending_amount",
        ],
      ],
      include: [
        {
          model: Customer,
          as: "Customer",
          attributes: ["id", "name", "phone", "address", "store_code"],
          where: customerWhere,
          required: true,
          include: [
            {
              model: Store,
              as: "organization",
              attributes: ["id", "store_name", "store_code"],
              required: false,
            },
          ],
        },
      ],
      group: [
        "LedgerEntry.customer_id",
        "Customer.id",
        "Customer->organization.id",
      ],
      order: [[literal(`"pending_amount"`), "DESC"]],
    });

    const data = clientRows.map((row) => ({
      store_name: row.Customer?.organization?.store_name || "",
      store_code: row.Customer?.store_code || "",
      client_name: row.Customer?.name || "",
      phone: row.Customer?.phone || "",
      address: row.Customer?.address || "",
      total_deals: Number(row.get("total_deals") || 0),
      total_amount: Number(row.get("total_amount") || 0),
      received_amount: Number(row.get("received_amount") || 0),
      pending_amount: Number(row.get("pending_amount") || 0),
      action: "View",
    }));

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet("Ledger Data");

    worksheet.mergeCells("A1:I1");
    worksheet.getCell("A1").value = "Ledger Data";
    worksheet.getCell("A1").font = { bold: true, size: 16 };
    worksheet.getCell("A1").alignment = { horizontal: "center" };

    worksheet.getRow(3).values = [
      "Store Name",
      "Store Code",
      "Client Name",
      "Phone",
      "Address",
      "Total Deals",
      "Total Amount",
      "Received Amount",
      "Pending Amount",
    ];
    worksheet.getRow(3).font = { bold: true };

    data.forEach((item) => {
      worksheet.addRow([
        item.store_name,
        item.store_code,
        item.client_name,
        item.phone,
        item.address,
        item.total_deals,
        item.total_amount,
        item.received_amount,
        item.pending_amount,
      ]);
    });

    worksheet.columns = [
      { width: 28 },
      { width: 15 },
      { width: 25 },
      { width: 18 },
      { width: 30 },
      { width: 15 },
      { width: 18 },
      { width: 18 },
      { width: 18 },
    ];

    const fileName = `ledger_data_${Date.now()}.xlsx`;

    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="${fileName}"`
    );

    await workbook.xlsx.write(res);
    return res.end();
  } catch (error) {
    console.error("Download Ledger Excel Error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to download ledger excel",
      error: error.message,
    });
  }
};
/**
 * @desc    Get detailed ledger for one customer
 * @route   GET /api/ledger/customer/:customer_id
 */

export const getCustomerLedgerDetail = async (req, res) => {
  try {
    const customer_id = Number(req.params.customer_id);

    if (isNaN(customer_id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid customer_id",
      });
    }

    const organization_id = req.user?.organization_id || null;

    const customerWhere = { id: customer_id };
    if (organization_id) {
      customerWhere.organization_id = organization_id;
    }

    const customer = await Customer.findOne({
      where: customerWhere,
    });

    if (!customer) {
      return res.status(404).json({
        success: false,
        message: "Customer not found",
      });
    }

    const ledgerWhere = { customer_id };
    if (organization_id) {
      ledgerWhere.organization_id = organization_id;
    }

    const entries = await LedgerEntry.findAll({
      where: ledgerWhere,
      order: [["createdAt", "ASC"]],
      raw: true,
    });

    const debitEntries = entries.filter((e) => e.type === "DEBIT");
    const creditEntries = entries.filter((e) => e.type === "CREDIT");

    let totalCreditPool = creditEntries.reduce(
      (sum, e) => sum + parseFloat(e.amount || 0),
      0
    );

    const rows = [];

    for (const entry of debitEntries) {
      const debitAmount = parseFloat(entry.amount || 0);

      let receivedAmount = 0;
      if (totalCreditPool > 0) {
        receivedAmount = Math.min(totalCreditPool, debitAmount);
        totalCreditPool -= receivedAmount;
      }

      const pendingAmount = debitAmount - receivedAmount;

      let invoiceNumber = entry.reference_id;
      if (entry.reference_type === "BILL" && entry.reference_id) {
        const billWhere = { id: entry.reference_id };
        if (organization_id) {
          billWhere.organization_id = organization_id;
        }

        const bill = await Bill.findOne({
          where: billWhere,
          attributes: ["id", "bill_number", "createdAt"],
          raw: true,
        });

        if (bill) {
          invoiceNumber = bill.bill_number;
        }
      }

      rows.push({
        ledger_id: entry.id,
        invoice_number: invoiceNumber || "-",
        date: entry.createdAt,
        total_amount: debitAmount,
        received_amount: receivedAmount,
        pending_amount: pendingAmount,
        reference_type: entry.reference_type,
        reference_id: entry.reference_id,
        action: "View",
      });
    }

    const totalAmount = debitEntries.reduce(
      (sum, e) => sum + parseFloat(e.amount || 0),
      0
    );

    const totalReceived = creditEntries.reduce(
      (sum, e) => sum + parseFloat(e.amount || 0),
      0
    );

    const totalPending = totalAmount - totalReceived;

    return res.status(200).json({
      success: true,
      message: "Customer ledger detail fetched successfully",
      data: {
        customer: {
          id: customer.id,
          name: customer.name,
          phone: customer.phone,
          address: customer.address,
          pan_card_number: customer.pan_card_number,
          store_code: customer.store_code,
        },
        summary: {
          total_amount: Number(totalAmount.toFixed(2)),
          received_amount: Number(totalReceived.toFixed(2)),
          pending_amount: Number(totalPending.toFixed(2)),
        },
        deals: rows.reverse(),
      },
    });
  } catch (err) {
    console.error("Ledger Detail Error:", err);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch customer ledger detail",
      error: err.message,
    });
  }
};