import * as XLSX from 'xlsx';

export interface ExportColumn {
  header: string;
  key: string;
}

/**
 * Generates and triggers download of a real .xlsx Excel file using the XLSX library.
 */
export function exportToXLSX(data: Record<string, any>[], filename: string = 'dealflow360_report') {
  if (!data || data.length === 0) {
    alert('No data available to export.');
    return;
  }

  const worksheet = XLSX.utils.json_to_sheet(data);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Report');
  XLSX.writeFile(workbook, `${filename}.xlsx`);
}

/**
 * Triggers a formatted PDF export via a clean printable document window.
 */
export function exportToPDF(
  title: string,
  headers: string[],
  rows: (string | number)[][],
  filename: string = 'dealflow360_report'
) {
  const printWindow = window.open('', '_blank');
  if (!printWindow) {
    alert('Please allow popups to export PDF.');
    return;
  }

  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <title>${title} - DealFlow360</title>
        <style>
          body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; margin: 20px; color: #1e293b; }
          .header { display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid #0f172a; padding-bottom: 12px; margin-bottom: 20px; }
          .logo { font-size: 20px; font-weight: bold; color: #0f172a; }
          .subtitle { font-size: 12px; color: #64748b; }
          .title { font-size: 16px; font-weight: bold; margin-bottom: 12px; color: #0f172a; }
          table { width: 100%; border-collapse: collapse; margin-top: 10px; font-size: 12px; }
          th { background-color: #0f172a; color: #ffffff; text-align: left; padding: 8px 10px; border: 1px solid #334155; }
          td { border: 1px solid #cbd5e1; padding: 8px 10px; }
          tr:nth-child(even) { background-color: #f8fafc; }
          .footer { margin-top: 30px; font-size: 10px; text-align: center; color: #94a3b8; border-top: 1px solid #e2e8f0; padding-top: 10px; }
        </style>
      </head>
      <body>
        <div class="header">
          <div>
            <div class="logo">DEALFLOW360</div>
            <div class="subtitle">Closed-Loop Sales Governance & Commercial Risk Engine</div>
          </div>
          <div style="text-align: right;">
            <div style="font-size: 12px; font-weight: bold;">OPERATIONAL REPORT</div>
            <div class="subtitle">Generated: ${new Date().toLocaleString()}</div>
          </div>
        </div>
        <div class="title">${title}</div>
        <table>
          <thead>
            <tr>
              ${headers.map((h) => `<th>${h}</th>`).join('')}
            </tr>
          </thead>
          <tbody>
            ${rows
              .map(
                (row) => `
              <tr>
                ${row.map((cell) => `<td>${cell}</td>`).join('')}
              </tr>
            `
              )
              .join('')}
          </tbody>
        </table>
        <div class="footer">
          Confidential - Internal Commercial Governance Document - DealFlow360 System Export
        </div>
        <script>
          window.onload = function() {
            window.print();
          };
        </script>
      </body>
    </html>
  `;

  printWindow.document.write(html);
  printWindow.document.close();
}
