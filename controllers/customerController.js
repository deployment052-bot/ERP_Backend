import { Customer, Invoice, LedgerEntry, sequelize } from "../models/index.js";
import { Op } from "sequelize";

/**
 * @desc    Create new customer 
 * @route   POST /api/customer
 * @access  Private
 */
export const createCustomer = async (req, res) => {
  try {
    const organization_id = req.user?.organization_id || 1;
    const store_code = req.user?.store_code;

    const {
      name,
      phone,
      address,
      pan_card_number,
      pincode,
    } = req.body;

    // Validation
    if (!name) {
      return res.status(400).json({ error: "Name is required" });
    }

    const customer = await Customer.create({
      name,
      phone,
      address,
      pan_card_number,
      pincode,
      organization_id,
      store_code,
    });

    res.status(201).json({
      success: true,
      message: "Customer created successfully",
      data: {
        id: customer.id,
        name: customer.name,
        phone: customer.phone,
        pan_card_number: customer.pan_card_number,
      },
    });
  } catch (err) {
    console.error("Create Customer Error:", err);
    res.status(500).json({ error: err.message });
  }
};

/**
 * @desc    Search customers with optional balance (Screenshot 3, 4)
 * @route   GET /api/customer/search?q=Johan&with_balance=true
 * @access  Private
 */
export const searchCustomers = async (req, res) => {
  try {
    const { q, with_balance } = req.query;
    const organization_id = req.user?.organization_id || 1;

    const whereClause = { organization_id };

    if (q) {
      whereClause[Op.or] = [
        { name: { [Op.like]: `%${q}%` } },
        { phone: { [Op.like]: `%${q}%` } },
        { pan_card_number: { [Op.like]: `%${q}%` } },
      ];
    }

    const customers = await Customer.findAll({
      where: whereClause,
      attributes: ["id", "name", "phone", "address", "pan_card_number", "pincode", "store_code"],
      limit: 20,
    });

    // If balance required (for ledger)
    if (with_balance === "true") {
      const withBalances = await Promise.all(
        customers.map(async (c) => {
          const ledger = await sequelize.query(
            `
            SELECT 
              SUM(CASE WHEN type='DEBIT' THEN amount ELSE 0 END) as total_debit,
              SUM(CASE WHEN type='CREDIT' THEN amount ELSE 0 END) as total_credit
            FROM ledger_entries
            WHERE customer_id = ? AND organization_id = ?
          `,
            {
              replacements: [c.id, organization_id],
              type: sequelize.QueryTypes.SELECT,
            }
          );

          const debit = parseFloat(ledger[0]?.total_debit || 0);
          const credit = parseFloat(ledger[0]?.total_credit || 0);

          return {
            ...c.toJSON(),
            total_amount: debit.toFixed(2),
            received_amount: credit.toFixed(2),
            pending_amount: (debit - credit).toFixed(2),
          };
        })
      );

      return res.json({
        success: true,
        count: withBalances.length,
        data: withBalances,
      });
    }

    res.json({
      success: true,
      count: customers.length,
      data: customers,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

/**
 * @desc    Get single customer with invoices (Screenshot 4)
 * @route   GET /api/customer/:id
 * @access  Private
 */
export const getCustomer = async (req, res) => {
  try {
    const { id } = req.params;

    const customer = await Customer.findOne({
      where: { id, organization_id },
      include: [
        {
          model: Invoice,
          attributes: ["id", "invoice_number", "total_amount", "pending_amount", "status", "createdAt"],
          order: [["createdAt", "DESC"]],
        },
      ],
    });

    if (!customer) {
      return res.status(404).json({ message: "Customer not found" });
    }

    res.json({
      success: true,
      data: customer,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};