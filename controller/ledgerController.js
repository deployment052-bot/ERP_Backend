// controllers/LedgerEntry.js

import Customer from "../model/Customer.js";
import LedgerEntry from "../model/LedgerEntry.js";
import Bill from "../model/Bill.js"
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