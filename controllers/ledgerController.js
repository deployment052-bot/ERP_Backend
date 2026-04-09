import { LedgerEntry, Customer, sequelize } from "../models/index.js";

export const getLedger = async (req, res) => {
  try {
    const { store_code, page = 1, limit = 10 } = req.query;

    //  Pagination logic
    const offset = (page - 1) * limit;

    const data = await LedgerEntry.findAll({
      attributes: [
        "customer_id",

        //  TOTAL (DEBIT)
        [
          sequelize.fn(
            "SUM",
            sequelize.literal(
              `CASE WHEN "LedgerEntry"."type"='DEBIT' THEN "LedgerEntry"."amount" ELSE 0 END`
            )
          ),
          "total_debit",
        ],

        //  RECEIVED (CREDIT)
        [
          sequelize.fn(
            "SUM",
            sequelize.literal(
              `CASE WHEN "LedgerEntry"."type"='CREDIT' THEN "LedgerEntry"."amount" ELSE 0 END`
            )
          ),
          "total_credit",
        ],
      ],

      include: [
        {
          model: Customer,
          attributes: ["id", "name", "store_code"],
          where: store_code ? { store_code } : undefined, //  store filter
        },
      ],

      group: ["LedgerEntry.customer_id", "Customer.id"],

      limit: parseInt(limit),
      offset: parseInt(offset),

      subQuery: false, //  IMPORTANT for grouping + pagination
    });

    //  Final formatting
    const result = data.map((d) => {
      const debit = parseFloat(d.dataValues.total_debit || 0);
      const credit = parseFloat(d.dataValues.total_credit || 0);

      return {
        customer_id: d.customer_id,
        name: d.Customer?.name,
        store_code: d.Customer?.store_code,
        total: debit,
        received: credit,
        pending: debit - credit,
      };
    });

    res.json({
      count: result.length,
      data: result,
    });
  } catch (err) {
    console.error("Ledger Error:", err);
    res.status(500).json({
      error: err.message,
    });
  }
};