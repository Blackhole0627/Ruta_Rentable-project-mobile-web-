function escapeCsv(value: string | number): string {
  const s = String(value ?? '');
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/** Build a CSV string (Excel-compatible, UTF-8 BOM) and trigger a download. */
export function downloadCsv(
  filename: string,
  headers: string[],
  rows: (string | number)[][],
): void {
  const lines = [headers, ...rows].map((r) => r.map(escapeCsv).join(','));
  const csv = '﻿' + lines.join('\r\n'); // BOM so Excel reads UTF-8
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

/**
 * Open a print-optimized window with the given HTML and trigger the print
 * dialog, where the user can choose "Save as PDF". Dependency-free PDF export.
 */
export function printReport(title: string, bodyHtml: string): void {
  const win = window.open('', '_blank', 'width=900,height=650');
  if (!win) return;
  win.document.write(`<!doctype html><html lang="es"><head><meta charset="utf-8" />
    <title>${title}</title>
    <style>
      * { font-family: -apple-system, Segoe UI, Roboto, sans-serif; }
      body { margin: 32px; color: #0f172a; }
      h1 { font-size: 20px; margin: 0 0 4px; }
      .sub { color: #64748b; font-size: 12px; margin-bottom: 20px; }
      table { width: 100%; border-collapse: collapse; margin-top: 12px; font-size: 12px; }
      th, td { text-align: left; padding: 6px 8px; border-bottom: 1px solid #e2e8f0; }
      th { background: #f8fafc; text-transform: uppercase; font-size: 10px; color: #64748b; }
      .kpis { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; margin: 12px 0; }
      .kpi { border: 1px solid #e2e8f0; border-radius: 8px; padding: 10px; }
      .kpi .label { font-size: 11px; color: #64748b; }
      .kpi .value { font-size: 18px; font-weight: 700; }
    </style></head><body>${bodyHtml}
    <script>window.onload = function () { window.print(); }</script>
  </body></html>`);
  win.document.close();
}
