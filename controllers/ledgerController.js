// controllers/LedgerEntry.js
import { LedgerEntry, Customer, sequelize } from "../models/index.js";
import { Op } from "sequelize";

/**
 * @desc    Get ledger summary for all customers
 * @route   GET /api/ledger
 */
export const getLedger = async (req, res) => {
  try {
    const { store_code, page = 1, limit = 10, search } = req.query;

   
    const organization_id = req.user?.organization_id || 
                           req.user?.id || 
                           req.auth?.organization_id ||
                           req.auth?.id ||
                           1; // Default fallback

    const pageNum = Number(page);
    const limitNum = Number(limit);
    const offset = (pageNum - 1) * limitNum;

    
    const customerWhere = { organization_id };

    if (store_code) customerWhere.store_code = store_code;

    if (search) {
      customerWhere.name = { [Op.like]: `%${search}%` };
    }

   
    const countQuery = await Customer.findAll({
      where: customerWhere,
      include: [
        {
          model: LedgerEntry,
          as: "ledger_entries",
          where: { organization_id },
          required: true,
          attributes: [],
        },
      ],
      attributes: ["id"],
      group: ["Customer.id"],
    });

    const totalCount = countQuery.length;

    
    const data = await LedgerEntry.findAll({
      attributes: [
        "customer_id",
        [
          sequelize.fn(
            "SUM",
            sequelize.literal(
              `CASE WHEN "LedgerEntry"."type"='DEBIT' THEN "LedgerEntry"."amount" ELSE 0 END`
            )
          ),
          "total_debit",
        ],
        [
          sequelize.fn(
            "SUM",
            sequelize.literal(
              `CASE WHEN "LedgerEntry"."type"='CREDIT' THEN "LedgerEntry"."amount" ELSE 0 END`
            )
          ),
          "total_credit",
        ],
        [
          sequelize.fn("MAX", sequelize.col("LedgerEntry.createdAt")),
          "last_transaction",
        ],
        [
          sequelize.fn("COUNT", sequelize.col("LedgerEntry.id")),
          "transaction_count",
        ],
      ],
      include: [
        {
          model: Customer,
          where: customerWhere,
          attributes: ["id", "name", "phone", "store_code"],
          required: true,
        },
      ],
      where: { organization_id },
      group: ["LedgerEntry.customer_id", "Customer.id"],
      limit: limitNum,
      offset: offset,
      subQuery: false,
      order: [[sequelize.literal("last_transaction"), "DESC"]],
    });

    
    const result = data.map((d) => {
      const debit = parseFloat(d.dataValues.total_debit || 0);
      const credit = parseFloat(d.dataValues.total_credit || 0);
      const pending = debit - credit;

      return {
        customer_id: d.customer_id,
        name: d.Customer?.name,
        phone: d.Customer?.phone,
        store_code: d.Customer?.store_code,
        total_deals: Math.floor(parseInt(d.dataValues.transaction_count) / 2),
        total_amount: debit.toFixed(2),
        received_amount: credit.toFixed(2),
        pending_amount: pending.toFixed(2),
        last_transaction: d.dataValues.last_transaction,
      };
    });

    res.json({
      success: true,
      total: totalCount,
      page: pageNum,
      limit: limitNum,
      totalPages: Math.ceil(totalCount / limitNum),
      data: result,
    });
  } catch (err) {
    console.error("Ledger Error:", err);
    res.status(500).json({
      success: false,
      error: err.message,
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
    
    
    const organization_id = req.user?.organization_id || 
                           req.user?.id || 
                           req.auth?.organization_id ||
                           req.auth?.id ||
                           1; // Default fallback

    if (isNaN(customer_id)) {
      return res.status(400).json({
        success: false,
        error: "Invalid customer_id",
      });
    }

    //  Customer check
    const customer = await Customer.findOne({
      where: { id: customer_id, organization_id },
    });

    if (!customer) {
      return res.status(404).json({
        success: false,
        message: "Customer not found",
      });
    }

    //  Ledger entries
    const entries = await LedgerEntry.findAll({
      where: { customer_id, organization_id },
      order: [["createdAt", "ASC"]],
    });

    let balance = 0;

    const detailed = entries.map((entry) => {
      const amount = parseFloat(entry.amount);

      if (entry.type === "DEBIT") {
        balance += amount;
      } else {
        balance -= amount;
      }

      return {
        id: entry.id,
        date: entry.createdAt,
        type: entry.type,
        amount: amount.toFixed(2),
        description: entry.description,
        reference_type: entry.reference_type,
        reference_id: entry.reference_id,
        running_balance: balance.toFixed(2),
      };
    });

    detailed.reverse();

    //  Summary
    const totalDebit = entries
      .filter((e) => e.type === "DEBIT")
      .reduce((sum, e) => sum + parseFloat(e.amount), 0);

    const totalCredit = entries
      .filter((e) => e.type === "CREDIT")
      .reduce((sum, e) => sum + parseFloat(e.amount), 0);

    res.json({
      success: true,
      customer: {
        id: customer.id,
        name: customer.name,
        phone: customer.phone,
        address: customer.address,
        pan_card_number: customer.pan_card_number,
      },
      summary: {
        total_amount: totalDebit.toFixed(2),
        received_amount: totalCredit.toFixed(2),
        pending_amount: (totalDebit - totalCredit).toFixed(2),
      },
      entries: detailed,
    });
  } catch (err) {
    console.error("Ledger Detail Error:", err);
    res.status(500).json({
      success: false,
      error: err.message,
    });
  }
};