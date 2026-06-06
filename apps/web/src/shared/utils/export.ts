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

export interface PrintOptions {
  /** Language for the boilerplate (header/footer). Body strings are pre-translated. */
  lang?: 'es' | 'en';
  /** Watermark text repeated diagonally behind the content. */
  watermark?: string;
}

/**
 * Open a print-optimized window with a branded, watermarked layout and trigger
 * the print dialog, where the user picks "Save as PDF". Dependency-free.
 */
export function printReport(title: string, bodyHtml: string, opts: PrintOptions = {}): void {
  const { lang = 'es', watermark = 'RutaRentable' } = opts;
  const win = window.open('', '_blank', 'width=900,height=650');
  if (!win) return;

  // Diagonal repeating watermark as an SVG background so it prints on every page.
  const tile = encodeURIComponent(
    `<svg xmlns='http://www.w3.org/2000/svg' width='340' height='230'>` +
      `<text x='28' y='140' transform='rotate(-30 170 115)' fill='#16a34a' fill-opacity='0.06' ` +
      `font-size='30' font-weight='700' font-family='Segoe UI, Roboto, sans-serif'>${watermark}</text>` +
      `</svg>`,
  );
  const generated = new Date().toLocaleString(lang === 'en' ? 'en-US' : 'es-NI');
  const genLabel = lang === 'en' ? 'Generated on' : 'Generado el';

  win.document.write(`<!doctype html><html lang="${lang}"><head><meta charset="utf-8" />
    <title>${title}</title>
    <style>
      @page { margin: 22mm 15mm; }
      * { font-family: 'Segoe UI', Roboto, -apple-system, sans-serif; -webkit-print-color-adjust: exact; print-color-adjust: exact; box-sizing: border-box; }
      html { background: #fff; }
      body {
        margin: 0; color: #0f172a;
        background-image: url("data:image/svg+xml,${tile}");
        background-repeat: repeat;
      }
      .page { padding: 28px 32px; }
      .brandbar { display:flex; align-items:center; justify-content:space-between; border-bottom: 3px solid #16a34a; padding-bottom: 12px; margin-bottom: 18px; }
      .brand { display:flex; align-items:center; gap:10px; }
      .brand .logo { width:34px; height:34px; border-radius:9px; background:#16a34a; color:#fff; display:flex; align-items:center; justify-content:center; font-weight:800; font-size:18px; }
      .brand .name { font-size:18px; font-weight:800; color:#16a34a; letter-spacing:-0.3px; }
      .brand .name span { color:#0f172a; }
      .meta { text-align:right; font-size:11px; color:#64748b; line-height:1.5; }
      h1 { font-size:19px; margin:2px 0; }
      .sub { color:#64748b; font-size:12px; margin-bottom:4px; }
      table { width:100%; border-collapse:collapse; margin-top:10px; font-size:12px; }
      th, td { text-align:left; padding:7px 10px; border-bottom:1px solid #e2e8f0; }
      th { background:#f0fdf4; text-transform:uppercase; font-size:10px; color:#15803d; letter-spacing:.3px; }
      tbody tr:nth-child(even) td { background:#fafafa; }
      h3 { font-size:13px; margin:22px 0 4px; color:#334155; }
      .kpis { display:grid; grid-template-columns:repeat(3, 1fr); gap:10px; margin:14px 0; }
      .kpi { border:1px solid #e2e8f0; border-radius:10px; padding:12px; background:#fff; }
      .kpi .label { font-size:11px; color:#64748b; }
      .kpi .value { font-size:18px; font-weight:800; color:#0f172a; margin-top:2px; }
      .footer { margin-top:28px; border-top:1px solid #e2e8f0; padding-top:8px; font-size:10px; color:#94a3b8; display:flex; justify-content:space-between; }
    </style></head><body>
      <div class="page">
        <div class="brandbar">
          <div class="brand"><div class="logo">R</div><div class="name">Ruta<span>Rentable</span></div></div>
          <div class="meta">${genLabel}<br/><strong>${generated}</strong></div>
        </div>
        ${bodyHtml}
        <div class="footer"><span>RutaRentable</span><span>${title}</span></div>
      </div>
      <script>window.onload = function () { setTimeout(function(){ window.print(); }, 200); }</script>
    </body></html>`);
  win.document.close();
}
