// LOCATION: src/lib/pdf/generators.js
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

const BRAND = [234, 88, 12]; // #ea580c
const DARK = [30, 41, 59]; // surface-800
const LIGHT = [248, 250, 252]; // surface-50
const MUTED = [100, 116, 139]; // surface-500

// ─── Shared helpers ───────────────────────────────────────────────────────────

function fmt(n) {
  return Number(n || 0).toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function addHeader(doc, company, title, number, date, extra = []) {
  const W = doc.internal.pageSize.getWidth();

  // Orange header band
  doc.setFillColor(...BRAND);
  doc.rect(0, 0, W, 38, "F");

  // Try to add logo from public folder
  // (jsPDF needs a base64 image; logo is injected at runtime if available via window.__BF_LOGO__)
  if (typeof window !== "undefined" && window.__BF_LOGO__) {
    try {
      doc.addImage(window.__BF_LOGO__, "PNG", 10, 4, 28, 28);
    } catch (_) {}
  }

  // Company name
  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.setTextColor(255, 255, 255);
  doc.text(company?.company_name || "Bharath Forklift", 44, 16);

  // Company details (right side)
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);
  doc.setTextColor(255, 220, 200);
  const details = [
    company?.address || "",
    [company?.city, company?.state, company?.pincode]
      .filter(Boolean)
      .join(", "),
    company?.contact_number || "",
    company?.email || "",
    company?.gst_number ? `GST: ${company.gst_number}` : "",
  ].filter(Boolean);
  details.forEach((line, i) =>
    doc.text(line, W - 12, 10 + i * 5.5, { align: "right" }),
  );

  // Document title strip
  doc.setFillColor(...LIGHT);
  doc.rect(0, 38, W, 20, "F");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.setTextColor(...DARK);
  doc.text(title, 12, 52);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(...MUTED);
  doc.text(`#${number}`, 12, 60);
  doc.text(`Date: ${date}`, W - 12, 52, { align: "right" });
  extra.forEach((e, i) => doc.text(e, W - 12, 60 + i * 7, { align: "right" }));

  return 68; // y after header
}

function addBillTo(doc, customer, y) {
  const W = doc.internal.pageSize.getWidth();
  doc.setDrawColor(...LIGHT);
  doc.setFillColor(255, 255, 255);
  doc.roundedRect(10, y, W / 2 - 14, 44, 3, 3, "FD");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(7.5);
  doc.setTextColor(...MUTED);
  doc.text("BILL TO", 15, y + 8);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(...DARK);
  doc.text(customer?.name || "—", 15, y + 17);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.setTextColor(...MUTED);
  const lines = [
    customer?.address,
    [customer?.city, customer?.state].filter(Boolean).join(", "),
    customer?.mobile && `Mobile: ${customer.mobile}`,
    customer?.gst_number && `GST: ${customer.gst_number}`,
  ].filter(Boolean);
  lines.forEach((ln, i) => doc.text(ln, 15, y + 25 + i * 5.5));
  return y + 52;
}

function addTotalsBox(
  doc,
  { subtotal, discountAmount, taxAmount, total },
  currency = "₹",
) {
  const W = doc.internal.pageSize.getWidth();
  const H = doc.internal.pageSize.getHeight();
  const lx = W - 80;
  const rx = W - 12;
  let y = H - 54;

  const rows = [
    ["Subtotal", `${currency} ${fmt(subtotal)}`],
    ...(discountAmount > 0
      ? [["Discount", `- ${currency} ${fmt(discountAmount)}`]]
      : []),
    ...(taxAmount > 0 ? [["Tax (GST)", `${currency} ${fmt(taxAmount)}`]] : []),
  ];

  doc.setFillColor(...LIGHT);
  doc.roundedRect(lx - 8, y - 6, W - lx + 8, rows.length * 10 + 18, 3, 3, "F");

  doc.setFontSize(9);
  rows.forEach(([label, value], i) => {
    doc.setFont("helvetica", "normal");
    doc.setTextColor(...MUTED);
    doc.text(label, lx, y + i * 10);
    doc.setTextColor(...DARK);
    doc.text(value, rx, y + i * 10, { align: "right" });
  });

  const ty = y + rows.length * 10 + 4;
  doc.setFillColor(...BRAND);
  doc.roundedRect(lx - 8, ty - 5, W - lx + 8, 14, 3, 3, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(255, 255, 255);
  doc.text("TOTAL", lx, ty + 4);
  doc.text(`${currency} ${fmt(total)}`, rx, ty + 4, { align: "right" });
}

function addFooter(doc, text) {
  const W = doc.internal.pageSize.getWidth();
  const H = doc.internal.pageSize.getHeight();
  doc.setFontSize(7.5);
  doc.setTextColor(...MUTED);
  doc.text(text || "Thank you for your business!", W / 2, H - 14, {
    align: "center",
  });
  doc.text(`Page 1`, W / 2, H - 8, { align: "center" });
}

const TABLE_HEAD = {
  fillColor: BRAND,
  textColor: 255,
  fontStyle: "bold",
  fontSize: 8.5,
};
const TABLE_BODY = { fontSize: 8.5, textColor: DARK };
const TABLE_ALT = { fillColor: LIGHT };

// ─── Preload logo into window for runtime use ─────────────────────────────────
// Call this once in _app or layout (client-side only)
export function preloadLogoForPDF() {
  if (typeof window === "undefined" || window.__BF_LOGO__) return;
  const img = new Image();
  img.crossOrigin = "anonymous";
  img.src = "/logo/BF-LOGO.png";
  img.onload = () => {
    const canvas = document.createElement("canvas");
    canvas.width = img.width;
    canvas.height = img.height;
    canvas.getContext("2d").drawImage(img, 0, 0);
    window.__BF_LOGO__ = canvas.toDataURL("image/png");
  };
}

// ─── INVOICE ──────────────────────────────────────────────────────────────────
export function generateInvoicePDF(invoice, company) {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const currency = company?.currency_symbol || "₹";

  let y = addHeader(
    doc,
    company,
    "TAX INVOICE",
    invoice.invoice_number,
    new Date(invoice.invoice_date).toLocaleDateString("en-IN"),
    [
      invoice.due_date
        ? `Due: ${new Date(invoice.due_date).toLocaleDateString("en-IN")}`
        : "",
      `Status: ${invoice.status?.toUpperCase()}`,
    ].filter(Boolean),
  );

  y = addBillTo(doc, invoice.customers, y);

  const rows = (invoice.invoice_items || []).map((item, i) => [
    i + 1,
    item.product_name || item.products?.name || "—",
    item.quantity,
    `${currency} ${fmt(item.unit_price)}`,
    item.tax_rate ? `${item.tax_rate}%` : "—",
    item.discount_percent > 0 ? `${item.discount_percent}%` : "—",
    `${currency} ${fmt(item.total)}`,
  ]);

  autoTable(doc, {
    startY: y + 4,
    head: [["#", "Description", "Qty", "Rate", "Tax", "Disc%", "Amount"]],
    body: rows,
    theme: "striped",
    headStyles: TABLE_HEAD,
    bodyStyles: TABLE_BODY,
    alternateRowStyles: TABLE_ALT,
    columnStyles: {
      0: { cellWidth: 8, halign: "center" },
      2: { cellWidth: 14, halign: "center" },
      3: { cellWidth: 26, halign: "right" },
      4: { cellWidth: 14, halign: "center" },
      5: { cellWidth: 14, halign: "center" },
      6: { cellWidth: 26, halign: "right" },
    },
    margin: { left: 10, right: 10 },
  });

  addTotalsBox(
    doc,
    {
      subtotal: invoice.subtotal,
      discountAmount: invoice.discount_amount,
      taxAmount: invoice.tax_amount,
      total: invoice.total_amount,
    },
    currency,
  );

  // Payment summary below totals
  if (Number(invoice.paid_amount) > 0) {
    const W = doc.internal.pageSize.getWidth();
    const H = doc.internal.pageSize.getHeight();
    doc.setFontSize(8.5);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(...MUTED);
    doc.text(`Paid: ${currency} ${fmt(invoice.paid_amount)}`, W - 12, H - 28, {
      align: "right",
    });
    doc.setTextColor(220, 38, 38);
    doc.text(
      `Balance Due: ${currency} ${fmt(invoice.pending_amount)}`,
      W - 12,
      H - 21,
      { align: "right" },
    );
  }

  addFooter(doc, company?.invoice_terms);
  return doc;
}

// ─── QUOTATION ────────────────────────────────────────────────────────────────
export function generateQuotationPDF(quotation, company) {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const currency = company?.currency_symbol || "₹";

  let y = addHeader(
    doc,
    company,
    "QUOTATION",
    quotation.quotation_number,
    new Date(quotation.quotation_date).toLocaleDateString("en-IN"),
    [
      quotation.valid_until
        ? `Valid Until: ${new Date(quotation.valid_until).toLocaleDateString("en-IN")}`
        : "",
    ].filter(Boolean),
  );

  y = addBillTo(doc, quotation.customers, y);

  const rows = (quotation.quotation_items || []).map((item, i) => [
    i + 1,
    item.product_name || item.products?.name || "—",
    item.quantity,
    `${currency} ${fmt(item.unit_price)}`,
    item.tax_rate ? `${item.tax_rate}%` : "—",
    item.discount_percent > 0 ? `${item.discount_percent}%` : "—",
    `${currency} ${fmt(item.total)}`,
  ]);

  autoTable(doc, {
    startY: y + 4,
    head: [["#", "Description", "Qty", "Rate", "Tax", "Disc%", "Amount"]],
    body: rows,
    theme: "striped",
    headStyles: TABLE_HEAD,
    bodyStyles: TABLE_BODY,
    alternateRowStyles: TABLE_ALT,
    columnStyles: {
      0: { cellWidth: 8, halign: "center" },
      2: { cellWidth: 14, halign: "center" },
      3: { cellWidth: 26, halign: "right" },
      4: { cellWidth: 14, halign: "center" },
      5: { cellWidth: 14, halign: "center" },
      6: { cellWidth: 26, halign: "right" },
    },
    margin: { left: 10, right: 10 },
  });

  addTotalsBox(
    doc,
    {
      subtotal: quotation.subtotal,
      discountAmount: quotation.discount_amount,
      taxAmount: quotation.tax_amount,
      total: quotation.total_amount,
    },
    currency,
  );

  addFooter(doc, "This is a computer generated quotation. Not a tax invoice.");
  return doc;
}

// ─── DELIVERY CHALLAN ─────────────────────────────────────────────────────────
export function generateChallanPDF(challan, company) {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const currency = company?.currency_symbol || "₹";
  const W = doc.internal.pageSize.getWidth();

  let y = addHeader(
    doc,
    company,
    "DELIVERY CHALLAN",
    challan.challan_number,
    new Date(challan.challan_date).toLocaleDateString("en-IN"),
    [`Type: ${challan.challan_type?.toUpperCase()}`],
  );

  y = addBillTo(doc, challan.customers, y);

  // Vehicle details box
  if (challan.vehicles) {
    doc.setFillColor(...LIGHT);
    doc.roundedRect(W / 2 - 2, y - 52, W / 2 - 8, 44, 3, 3, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7.5);
    doc.setTextColor(...MUTED);
    doc.text("VEHICLE", W / 2 + 4, y - 44);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.setTextColor(...DARK);
    doc.text(challan.vehicles.vehicle_name, W / 2 + 4, y - 35);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8.5);
    doc.setTextColor(...MUTED);
    if (challan.vehicles.registration_number)
      doc.text(
        `Reg: ${challan.vehicles.registration_number}`,
        W / 2 + 4,
        y - 27,
      );
  }

  const detailRows =
    challan.challan_type === "rental"
      ? [
          [
            "Start Date",
            challan.start_date
              ? new Date(challan.start_date).toLocaleDateString("en-IN")
              : "—",
          ],
          [
            "End Date",
            challan.end_date
              ? new Date(challan.end_date).toLocaleDateString("en-IN")
              : "—",
          ],
          ["Rent Amount", `${currency} ${fmt(challan.rent_amount)}`],
          ["Security Deposit", `${currency} ${fmt(challan.security_deposit)}`],
          ...(challan.payment_date
            ? [
                [
                  "Payment Date",
                  new Date(challan.payment_date).toLocaleDateString("en-IN"),
                ],
              ]
            : []),
        ]
      : [
          ["Contract Amount", `${currency} ${fmt(challan.contract_amount)}`],
          [
            "Start Date",
            challan.start_date
              ? new Date(challan.start_date).toLocaleDateString("en-IN")
              : "—",
          ],
          [
            "End Date",
            challan.end_date
              ? new Date(challan.end_date).toLocaleDateString("en-IN")
              : "—",
          ],
          ["Payment Schedule", challan.payment_schedule || "—"],
          ...(challan.contract_notes
            ? [["Notes", challan.contract_notes]]
            : []),
        ];

  autoTable(doc, {
    startY: y + 4,
    head: [["Field", "Details"]],
    body: detailRows,
    theme: "grid",
    headStyles: TABLE_HEAD,
    bodyStyles: { ...TABLE_BODY, fontSize: 9.5 },
    columnStyles: { 0: { fontStyle: "bold", cellWidth: 55 } },
    margin: { left: 10, right: 10 },
  });

  // Signature lines
  const H = doc.internal.pageSize.getHeight();
  const sig = H - 32;
  doc.setDrawColor(200, 200, 200);
  doc.line(12, sig, 70, sig);
  doc.line(W - 70, sig, W - 12, sig);
  doc.setFontSize(8);
  doc.setTextColor(...MUTED);
  doc.text("Customer Signature", 12, sig + 6);
  doc.text("Authorised Signature", W - 12, sig + 6, { align: "right" });

  addFooter(doc, "This is a computer generated delivery challan.");
  return doc;
}

// ─── PURCHASE ORDER ───────────────────────────────────────────────────────────
export function generatePurchasePDF(purchase, company) {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const currency = company?.currency_symbol || "₹";

  addHeader(
    doc,
    company,
    "PURCHASE ORDER",
    purchase.purchase_number,
    new Date(purchase.purchase_date).toLocaleDateString("en-IN"),
  );

  // Supplier box
  if (purchase.suppliers) {
    const W = doc.internal.pageSize.getWidth();
    doc.setFillColor(...LIGHT);
    doc.roundedRect(10, 70, W / 2 - 14, 36, 3, 3, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7.5);
    doc.setTextColor(...MUTED);
    doc.text("SUPPLIER", 15, 78);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.setTextColor(...DARK);
    doc.text(purchase.suppliers.name, 15, 87);
    if (purchase.suppliers.mobile) {
      doc.setFont("helvetica", "normal");
      doc.setFontSize(8.5);
      doc.setTextColor(...MUTED);
      doc.text(purchase.suppliers.mobile, 15, 95);
    }
  }

  const rows = (purchase.purchase_items || []).map((item, i) => [
    i + 1,
    item.products?.name || "—",
    item.quantity,
    `${currency} ${fmt(item.buying_price)}`,
    item.tax_rate ? `${item.tax_rate}%` : "—",
    `${currency} ${fmt(item.total)}`,
  ]);

  autoTable(doc, {
    startY: 112,
    head: [["#", "Product", "Qty", "Rate", "Tax%", "Amount"]],
    body: rows,
    theme: "striped",
    headStyles: TABLE_HEAD,
    bodyStyles: TABLE_BODY,
    alternateRowStyles: TABLE_ALT,
    columnStyles: {
      0: { cellWidth: 8, halign: "center" },
      2: { cellWidth: 14, halign: "center" },
      3: { cellWidth: 28, halign: "right" },
      4: { cellWidth: 16, halign: "center" },
      5: { cellWidth: 28, halign: "right" },
    },
    margin: { left: 10, right: 10 },
  });

  addTotalsBox(
    doc,
    {
      subtotal: purchase.subtotal,
      discountAmount: purchase.discount_amount || 0,
      taxAmount: purchase.tax_amount,
      total: purchase.total_amount,
    },
    currency,
  );

  addFooter(doc, "This is a computer generated purchase order.");
  return doc;
}
