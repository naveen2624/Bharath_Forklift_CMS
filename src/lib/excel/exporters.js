import * as XLSX from 'xlsx';

export function exportToExcel(data, columns, filename, sheetName = 'Sheet1') {
  const headers = columns.map(c => c.label);
  const rows = data.map(row =>
    columns.map(c => {
      const val = row[c.key];
      return c.format ? c.format(val, row) : val;
    })
  );

  const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);

  // Style header row
  const headerStyle = { font: { bold: true }, fill: { fgColor: { rgb: 'EA580C' } } };
  headers.forEach((_, i) => {
    const cell = XLSX.utils.encode_cell({ r: 0, c: i });
    if (ws[cell]) ws[cell].s = headerStyle;
  });

  // Auto column widths
  const colWidths = columns.map((col, i) => ({
    wch: Math.max(
      col.label.length,
      ...rows.map(r => String(r[i] ?? '').length)
    ) + 2,
  }));
  ws['!cols'] = colWidths;

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, sheetName);
  XLSX.writeFile(wb, `${filename}_${new Date().toISOString().split('T')[0]}.xlsx`);
}

export const EXPORT_COLUMNS = {
  customers: [
    { key: 'customer_code', label: 'ID' },
    { key: 'name', label: 'Name' },
    { key: 'mobile', label: 'Mobile' },
    { key: 'email', label: 'Email' },
    { key: 'customer_type', label: 'Type' },
    { key: 'credit_limit', label: 'Credit Limit', format: v => Number(v).toFixed(2) },
    { key: 'current_credit', label: 'Current Credit', format: v => Number(v).toFixed(2) },
    { key: 'gst_number', label: 'GST Number' },
  ],
  suppliers: [
    { key: 'supplier_code', label: 'ID' },
    { key: 'name', label: 'Name' },
    { key: 'contact_person', label: 'Contact Person' },
    { key: 'mobile', label: 'Mobile' },
    { key: 'email', label: 'Email' },
    { key: 'gst_number', label: 'GST Number' },
    { key: 'outstanding_amount', label: 'Outstanding', format: v => Number(v).toFixed(2) },
  ],
  products: [
    { key: 'product_code', label: 'Code' },
    { key: 'name', label: 'Name' },
    { key: 'category_id', label: 'Category' },
    { key: 'stock_quantity', label: 'Stock' },
    { key: 'minimum_stock', label: 'Min Stock' },
    { key: 'buying_price', label: 'Buying Price', format: v => Number(v).toFixed(2) },
    { key: 'selling_price', label: 'Selling Price', format: v => Number(v).toFixed(2) },
    { key: 'stock_status', label: 'Status' },
  ],
  invoices: [
    { key: 'invoice_number', label: 'Invoice #' },
    { key: 'invoice_date', label: 'Date' },
    { key: 'subtotal', label: 'Subtotal', format: v => Number(v).toFixed(2) },
    { key: 'tax_amount', label: 'Tax', format: v => Number(v).toFixed(2) },
    { key: 'total_amount', label: 'Total', format: v => Number(v).toFixed(2) },
    { key: 'paid_amount', label: 'Paid', format: v => Number(v).toFixed(2) },
    { key: 'pending_amount', label: 'Pending', format: v => Number(v).toFixed(2) },
    { key: 'status', label: 'Status' },
  ],
};
