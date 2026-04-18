// controllers/LedgerEntry.js

import Customer from "../model/Customer.js";
import LedgerEntry from "../model/LedgerEntry.js";
import Bill from "../model/Bill.js"
// import Customer from "../model/Customer.js";
import Store from "../model/Store.js";
import Invoice from "../model/invoices.js"; // if available in your project
import ExcelJS from "exceljs";
import { resolveDistrictOrganization } from "../utils/resolveDistrictOrganization.js"
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

    // same logic as working getLedger API
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

    // store info for header
    const store = await Store.findOne({
      where: { id: organization_id },
      attributes: ["id", "store_name", "store_code", "organization_level"],
      raw: true,
    });

    // client-wise data
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
              literal(
                `CASE WHEN "LedgerEntry"."type" = 'DEBIT' THEN "LedgerEntry"."amount" ELSE 0 END`
              )
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
              literal(
                `CASE WHEN "LedgerEntry"."type" = 'CREDIT' THEN "LedgerEntry"."amount" ELSE 0 END`
              )
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

    const data = clientRows.map((row) => ({
      customer_id: row.customer_id,
      client_name: row.Customer?.name || "",
      phone: row.Customer?.phone || "",
      address: row.Customer?.address || "",
      customer_store_code: row.Customer?.store_code || "",
      total_deals: Number(row.get("total_deals") || 0),
      total_amount: Number(row.get("total_amount") || 0),
      received_amount: Number(row.get("received_amount") || 0),
      pending_amount: Number(row.get("pending_amount") || 0),
      action: "View",
    }));

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet("Ledger Data");

    // title
    worksheet.mergeCells("A1:I1");
    worksheet.getCell("A1").value = "Ledger Dashboard Report";
    worksheet.getCell("A1").font = { bold: true, size: 16 };
    worksheet.getCell("A1").alignment = {
      horizontal: "center",
      vertical: "middle",
    };

    // store/org info
    worksheet.getCell("A3").value = "Store Name";
    worksheet.getCell("B3").value = store?.store_name || "";

    worksheet.getCell("A4").value = "Store Code";
    worksheet.getCell("B4").value = store?.store_code || req.user?.store_code || "";

    worksheet.getCell("A5").value = "Organization ID";
    worksheet.getCell("B5").value = organization_id;

    worksheet.getCell("A6").value = "Organization Level";
    worksheet.getCell("B6").value = store?.organization_level || "";

    worksheet.getCell("A7").value = "Generated At";
    worksheet.getCell("B7").value = new Date().toLocaleString();

    // make header labels bold
    ["A3", "A4", "A5", "A6", "A7"].forEach((cell) => {
      worksheet.getCell(cell).font = { bold: true };
    });

    // blank row then table
    const headerRowIndex = 9;

    worksheet.getRow(headerRowIndex).values = [
      "Customer ID",
      "Client Name",
      "Phone",
      "Address",
      "Customer Store Code",
      "Total Deals",
      "Total Amount",
      "Received Amount",
      "Pending Amount",
    ];

    worksheet.getRow(headerRowIndex).font = { bold: true };

    data.forEach((item) => {
      worksheet.addRow([
        item.customer_id,
        item.client_name,
        item.phone,
        item.address,
        item.customer_store_code,
        item.total_deals,
        item.total_amount,
        item.received_amount,
        item.pending_amount,
      ]);
    });

    // widths
    worksheet.columns = [
      { width: 15 }, // Customer ID
      { width: 25 }, // Client Name
      { width: 18 }, // Phone
      { width: 30 }, // Address
      { width: 20 }, // Customer Store Code
      { width: 15 }, // Total Deals
      { width: 18 }, // Total Amount
      { width: 18 }, // Received Amount
      { width: 18 }, // Pending Amount
    ];

    // alignment for numeric columns
    worksheet.eachRow((row, rowNumber) => {
      if (rowNumber >= headerRowIndex) {
        row.getCell(6).alignment = { horizontal: "center" };
        row.getCell(7).alignment = { horizontal: "right" };
        row.getCell(8).alignment = { horizontal: "right" };
        row.getCell(9).alignment = { horizontal: "right" };
      }
    });

    const fileName = `ledger_data_${store?.store_code || organization_id}_${Date.now()}.xlsx`;

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



const DISTRICT_LEVELS = ["district", "District", "DISTRICT"];

const getStoreNameField = () => {
  if (Store.rawAttributes?.store_name) return "store_name";
  if (Store.rawAttributes?.name) return "name";
  return "store_name";
};

const getStoreCodeField = () => {
  if (Store.rawAttributes?.store_code) return "store_code";
  if (Store.rawAttributes?.code) return "code";
  return "store_code";
};

const getInvoiceNoField = () => {
  if (Invoice?.rawAttributes?.invoice_number) return "invoice_number";
  if (Invoice?.rawAttributes?.invoice_no) return "invoice_no";
  if (Invoice?.rawAttributes?.bill_no) return "bill_no";
  return null;
};

const getInvoiceDateField = () => {
  if (Invoice?.rawAttributes?.invoice_date) return "invoice_date";
  if (Invoice?.rawAttributes?.date) return "date";
  if (Invoice?.rawAttributes?.createdAt) return "createdAt";
  return null;
};

const getCustomerScopeOrganizationIds = async (districtId) => {
  const storeNameField = getStoreNameField();
  const storeCodeField = getStoreCodeField();

  const stores = await Store.findAll({
    where: {
      district_id: districtId,
    },
    attributes: ["id", storeNameField, storeCodeField],
    raw: true,
  });

  const storeIds = stores.map((s) => s.id);

  return {
    stores,
    organizationIds: [districtId, ...storeIds],
  };
};

export const getDistrictLedgerDashboard = async (req, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: "User not authenticated",
      });
    }

    const { search = "" } = req.query;

    const districtOrg = await resolveDistrictOrganization(req.user);

    const customerWhere = {
      organization_id: districtOrg.id,
    };

    if (search.trim()) {
      customerWhere[Op.or] = [
        { name: { [Op.iLike]: `%${search.trim()}%` } },
        { phone: { [Op.iLike]: `%${search.trim()}%` } },
      ];
    }

    const customers = await Customer.findAll({
      where: customerWhere,
      attributes: ["id", "name", "phone", "address", "store_code", "organization_id"],
      raw: true,
    });

    const customerIds = customers.map((c) => c.id);

    if (!customerIds.length) {
      return res.status(200).json({
        success: true,
        message: "District ledger fetched successfully",
        data: {
          district: {
            organization_id: districtOrg.id,
            district_id: districtOrg.district_id,
            store_code: districtOrg.store_code,
            store_name: districtOrg.store_name,
          },
          summary: {
            total_clients: 0,
            total_deals: 0,
            total_amount: 0,
            received_amount: 0,
            pending_amount: 0,
          },
          clients: [],
        },
      });
    }

    const invoiceRows = await Invoice.findAll({
      where: {
        organization_id: districtOrg.id,
        customer_id: {
          [Op.in]: customerIds,
        },
      },
      attributes: [
        "customer_id",
        [fn("COUNT", literal(`DISTINCT "Invoice"."id"`)), "total_deals"],
        [fn("COALESCE", fn("SUM", literal(`"Invoice"."total_amount"`)), 0), "total_amount"],
        [fn("COALESCE", fn("SUM", literal(`"Invoice"."received_amount"`)), 0), "received_amount"],
        [fn("COALESCE", fn("SUM", literal(`"Invoice"."pending_amount"`)), 0), "pending_amount"],
      ],
      group: ["customer_id"],
      raw: true,
    });

    const invoiceMap = new Map(
      invoiceRows.map((row) => [Number(row.customer_id), row])
    );

    const clients = customers
      .map((customer) => {
        const agg = invoiceMap.get(Number(customer.id)) || {};

        return {
          customer_id: customer.id,
          client_name: customer.name || "",
          phone: customer.phone || "",
          address: customer.address || "",
          total_deals: Number(agg.total_deals || 0),
          total_amount: Number(agg.total_amount || 0),
          received_amount: Number(agg.received_amount || 0),
          pending_amount: Number(agg.pending_amount || 0),
        };
      })
      .sort((a, b) => b.pending_amount - a.pending_amount);

    const summary = {
      total_clients: clients.length,
      total_deals: clients.reduce((sum, item) => sum + item.total_deals, 0),
      total_amount: clients.reduce((sum, item) => sum + item.total_amount, 0),
      received_amount: clients.reduce((sum, item) => sum + item.received_amount, 0),
      pending_amount: clients.reduce((sum, item) => sum + item.pending_amount, 0),
    };

    return res.status(200).json({
      success: true,
      message: "District ledger fetched successfully",
      data: {
        district: {
          organization_id: districtOrg.id,
          district_id: districtOrg.district_id,
          store_code: districtOrg.store_code,
          store_name: districtOrg.store_name,
        },
        summary,
        clients,
      },
    });
  } catch (error) {
    console.error("getDistrictLedgerDashboard error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch district ledger",
      error: error.message,
    });
  }
};

export const getDistrictLedgerClientDetail = async (req, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: "User not authenticated. req.user is missing.",
      });
    }

    const { organization_id, organization_level } = req.user;
    const { customerId } = req.params;

    if (!organization_id) {
      return res.status(400).json({
        success: false,
        message: "organization_id is missing in req.user",
      });
    }

    if (!DISTRICT_LEVELS.includes(organization_level)) {
      return res.status(403).json({
        success: false,
        message: "Only district users can access this ledger detail",
      });
    }

    if (!customerId) {
      return res.status(400).json({
        success: false,
        message: "customerId is required",
      });
    }

    const { stores, organizationIds } =
      await getCustomerScopeOrganizationIds(organization_id);

    const customer = await Customer.findOne({
      where: {
        id: customerId,
        organization_id: {
          [Op.in]: organizationIds,
        },
      },
      raw: true,
    });

    if (!customer) {
      return res.status(404).json({
        success: false,
        message: "Client not found in your district scope",
      });
    }

    const invoiceNoField = getInvoiceNoField();
    const invoiceDateField = getInvoiceDateField();

    const referenceRows = await LedgerEntry.findAll({
      where: {
        customer_id: customerId,
        organization_id: {
          [Op.in]: organizationIds,
        },
      },
      attributes: [
        "reference_id",
        [
          fn(
            "MIN",
            col(`LedgerEntry.createdAt`)
          ),
          "entry_date",
        ],
        [
          fn(
            "COALESCE",
            fn(
              "SUM",
              literal(
                `CASE WHEN "LedgerEntry"."type" = 'DEBIT' THEN "LedgerEntry"."amount" ELSE 0 END`
              )
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
              literal(
                `CASE WHEN "LedgerEntry"."type" = 'CREDIT' THEN "LedgerEntry"."amount" ELSE 0 END`
              )
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
      group: ["LedgerEntry.reference_id"],
      order: [[literal(`"entry_date"`), "DESC"]],
      raw: true,
    });

    let invoiceMap = {};
    if (Invoice && referenceRows.length) {
      const referenceIds = referenceRows
        .map((r) => r.reference_id)
        .filter(Boolean);

      if (referenceIds.length) {
        const invoices = await Invoice.findAll({
          where: {
            id: {
              [Op.in]: referenceIds,
            },
          },
          attributes: [
            "id",
            ...(invoiceNoField ? [invoiceNoField] : []),
            ...(invoiceDateField ? [invoiceDateField] : []),
          ],
          raw: true,
        });

        invoiceMap = invoices.reduce((acc, item) => {
          acc[item.id] = item;
          return acc;
        }, {});
      }
    }

    const detailRows = referenceRows.map((row) => {
      const invoice = invoiceMap[row.reference_id] || {};
      const invoiceNumber =
        (invoiceNoField && invoice?.[invoiceNoField]) ||
        `REF-${row.reference_id}`;
      const invoiceDate =
        (invoiceDateField && invoice?.[invoiceDateField]) || row.entry_date;

      return {
        reference_id: row.reference_id,
        invoice_number: invoiceNumber,
        date: invoiceDate,
        total_amount: Number(row.total_amount || 0),
        received_amount: Number(row.received_amount || 0),
        pending_amount: Number(row.pending_amount || 0),
        action: "View",
      };
    });

    const sourceStore = stores.find(
      (s) => Number(s.id) === Number(customer.organization_id)
    );

    return res.status(200).json({
      success: true,
      message: "District client ledger detail fetched successfully",
      data: {
        client: {
          id: customer.id,
          name: customer.name || "",
          phone: customer.phone || "",
          address: customer.address || "",
          store_code: customer.store_code || "",
          source_type:
            Number(customer.organization_id) === Number(organization_id)
              ? "district"
              : "store",
          source_name:
            Number(customer.organization_id) === Number(organization_id)
              ? "District Office"
              : sourceStore?.[getStoreNameField()] || "",
        },
        summary: {
          total_deals: detailRows.length,
          total_amount: detailRows.reduce((sum, item) => sum + item.total_amount, 0),
          received_amount: detailRows.reduce((sum, item) => sum + item.received_amount, 0),
          pending_amount: detailRows.reduce((sum, item) => sum + item.pending_amount, 0),
        },
        rows: detailRows,
      },
    });
  } catch (error) {
    console.error("District Ledger Client Detail Error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch district client ledger detail",
      error: error.message,
    });
  }
};
