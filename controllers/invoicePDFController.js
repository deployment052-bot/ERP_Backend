import PDFDocument from "pdfkit";
import Invoice from "../models/Invoice.js";
import InvoiceItem from "../models/InvoiceItem.js";
import Customer from "../models/Customer.js";

export const downloadInvoiceByCustomer = async (req, res) => {
  try {
    const { customer_id } = req.params;

    // ================= FETCH DATA =================
    const invoice = await Invoice.findOne({
      where: { customer_id },
      include: [
        { model: Customer, as: "customer" },
        { model: InvoiceItem, as: "items" }
      ],
      order: [["createdAt", "DESC"]],
    });

    if (!invoice) {
      return res.status(404).json({ message: "Invoice not found" });
    }

    const customer = invoice.customer || {};
    const items = invoice.items || [];

    // ================= FORMAT DATA =================
    const data = {
      header: {
        company_name: "Merxenta Global Private Limited",
        address: "H.No. 999/9, Gurgaon, Haryana",
        phone: "0120-2562111",
      },
      customer_details: {
        name: customer.name || "",
        phone: customer.phone || "",
        address: customer.address || "",
        invoice_no: invoice.id,
        invoice_date: invoice.invoice_date || "",
      },
      items: items.map((item, index) => ({
        sno: index + 1,
        product_code: item.product_code,
        description: item.description,
        hsn_code: item.hsn_code,
        purity: item.purity,
        gross_weight: item.gross_weight,
        net_weight: item.net_weight,
        rate: item.rate,
        value: item.value,
        making_charge_percent: item.making_charge_percent,
        making_charge_value: item.making_charge_value,
        amount: item.total_amount,
      })),
      summary: {
        subtotal: invoice.total_amount || 0,
        cgst: (invoice.total_amount || 0) * 0.015,
        sgst: (invoice.total_amount || 0) * 0.015,
        total_with_tax: (invoice.total_amount || 0) * 1.03,
        round_off: 0,
        final_amount: Math.round((invoice.total_amount || 0) * 1.03),
      },
    };

    // ================= PDF =================
    const doc = new PDFDocument({ margin: 20, size: "A4" });

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename=invoice_${invoice.id}.pdf`
    );

    doc.pipe(res);

    // ================= HEADER =================
    doc.fontSize(16).text("TAX INVOICE", { align: "center" });

    doc.fontSize(12).text(data.header.company_name, { align: "center" });
    doc.fontSize(9).text(data.header.address, { align: "center" });
    doc.text(`PH: ${data.header.phone}`, { align: "center" });

    doc.moveDown();

    // ================= CUSTOMER =================
    doc.fontSize(10);
    doc.text(`Customer: ${data.customer_details.name}`);
    doc.text(`Phone: ${data.customer_details.phone}`);
    doc.text(`Address: ${data.customer_details.address}`);
    doc.text(`Invoice No: ${data.customer_details.invoice_no}`);
    doc.text(`Date: ${data.customer_details.invoice_date}`);

    doc.moveDown();

    // ================= TABLE =================
    const startX = 20;
    let y = doc.y;

    const col = {
      sno: startX,
      code: startX + 25,
      desc: startX + 80,
      hsn: startX + 180,
      purity: startX + 230,
      gwt: startX + 280,
      nwt: startX + 330,
      rate: startX + 380,
      value: startX + 430,
    };

    doc.fontSize(7);

    // HEADER ROW
    doc.text("SNo", col.sno, y);
    doc.text("Code", col.code, y);
    doc.text("Description", col.desc, y);
    doc.text("HSN", col.hsn, y);
    doc.text("Purity", col.purity, y);
    doc.text("G.Wt", col.gwt, y);
    doc.text("N.Wt", col.nwt, y);
    doc.text("Rate", col.rate, y);
    doc.text("Value", col.value, y);

    y += 15;

    // ITEMS
    data.items.forEach((item) => {
      doc.text(item.sno, col.sno, y);
      doc.text(item.product_code, col.code, y);
      doc.text(item.description, col.desc, y, { width: 90 });
      doc.text(item.hsn_code, col.hsn, y);
      doc.text(item.purity, col.purity, y);
      doc.text(item.gross_weight, col.gwt, y);
      doc.text(item.net_weight, col.nwt, y);
      doc.text(item.rate, col.rate, y);
      doc.text(item.value, col.value, y);

      y += 15;

      // MAKING LINE
      doc.text(
        `Making: ${item.making_charge_percent}% | ${item.making_charge_value.toFixed(
          2
        )}`,
        col.desc,
        y
      );

      y += 15;

      // AMOUNT
      doc.text(`Amount: ${item.amount.toFixed(2)}`, col.value, y);

      y += 20;
    });

    // ================= SUMMARY =================
    doc.moveDown();

    doc.text(`Subtotal: ${data.summary.subtotal.toFixed(2)}`, {
      align: "right",
    });
    doc.text(`CGST: ${data.summary.cgst.toFixed(2)}`, {
      align: "right",
    });
    doc.text(`SGST: ${data.summary.sgst.toFixed(2)}`, {
      align: "right",
    });
    doc.text(`Total: ${data.summary.total_with_tax.toFixed(2)}`, {
      align: "right",
    });

    doc.moveDown();

    doc.fontSize(12).text(
      `Final Amount: ${data.summary.final_amount}`,
      { align: "right" }
    );

    doc.end();
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: error.message });
  }
};
export default downloadInvoiceByCustomer;