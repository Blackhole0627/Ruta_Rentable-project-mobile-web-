import { Capacitor } from '@capacitor/core';

/** Structured data for a branded PDF report (rendered with jsPDF). */
export interface ReportDoc {
  title: string;
  lang: 'es' | 'en';
  kpis: { label: string; value: string }[];
  sections: { heading: string; columns: string[]; rows: (string | number)[][] }[];
}

const GREEN: [number, number, number] = [22, 163, 74];

function escapeCsv(value: string | number): string {
  const s = String(value ?? '');
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/**
 * Save a generated file. On the web this triggers a browser download; on a
 * native Capacitor app (Android WebView, where `<a download>` does nothing) it
 * writes the file to the cache and opens the native share sheet so the driver
 * can save it or send it on.
 */
async function saveFile(
  filename: string,
  data: string,
  mime: string,
  isBase64: boolean,
): Promise<void> {
  if (Capacitor.isNativePlatform()) {
    const { Filesystem, Directory, Encoding } = await import('@capacitor/filesystem');
    const { Share } = await import('@capacitor/share');
    await Filesystem.writeFile({
      path: filename,
      data,
      directory: Directory.Cache,
      ...(isBase64 ? {} : { encoding: Encoding.UTF8 }),
    });
    const { uri } = await Filesystem.getUri({ path: filename, directory: Directory.Cache });
    try {
      await Share.share({ title: filename, url: uri });
    } catch {
      /* user cancelled the share sheet — ignore */
    }
    return;
  }

  // Web: classic blob download.
  const blob = isBase64 ? base64ToBlob(data, mime) : new Blob([data], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function base64ToBlob(base64: string, mime: string): Blob {
  const bytes = atob(base64);
  const arr = new Uint8Array(bytes.length);
  for (let i = 0; i < bytes.length; i++) arr[i] = bytes.charCodeAt(i);
  return new Blob([arr], { type: mime });
}

/** Build a CSV (Excel-compatible, UTF-8 BOM) and save/share it. */
export async function downloadCsv(
  filename: string,
  headers: string[],
  rows: (string | number)[][],
): Promise<void> {
  const lines = [headers, ...rows].map((r) => r.map(escapeCsv).join(','));
  const csv = '﻿' + lines.join('\r\n');
  await saveFile(filename, csv, 'text/csv;charset=utf-8;', false);
}

/**
 * Render a branded, watermarked PDF report with jsPDF and save/share it. Works
 * on web and native (unlike window.print, which the Android WebView ignores).
 */
export async function exportReportPdf(doc: ReportDoc, filename: string): Promise<void> {
  const { jsPDF } = await import('jspdf');
  const autoTable = (await import('jspdf-autotable')).default;

  const pdf = new jsPDF({ unit: 'pt', format: 'a4', compress: true });
  const pageW = pdf.internal.pageSize.getWidth();
  const pageH = pdf.internal.pageSize.getHeight();
  const margin = 40;
  const generated = new Date().toLocaleString(doc.lang === 'en' ? 'en-US' : 'es-NI');
  const genLabel = doc.lang === 'en' ? 'Generated on' : 'Generado el';

  const drawChrome = () => {
    // Watermark — faint rotated "RutaRentable" tiled across the page.
    pdf.saveGraphicsState();
    // @ts-expect-error GState is available at runtime in jsPDF.
    pdf.setGState(new pdf.GState({ opacity: 0.06 }));
    pdf.setTextColor(GREEN[0], GREEN[1], GREEN[2]);
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(26);
    for (let y = 130; y < pageH; y += 165) {
      for (let x = -10; x < pageW; x += 235) {
        pdf.text('RutaRentable', x, y, { angle: 30 });
      }
    }
    pdf.restoreGraphicsState();

    // Header — logo chip + RutaRentable wordmark + generated date.
    pdf.setFillColor(GREEN[0], GREEN[1], GREEN[2]);
    pdf.roundedRect(margin, 30, 26, 26, 5, 5, 'F');
    pdf.setTextColor(255, 255, 255);
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(15);
    pdf.text('R', margin + 8.5, 49);
    pdf.setTextColor(GREEN[0], GREEN[1], GREEN[2]);
    pdf.text('Ruta', margin + 34, 49);
    pdf.setTextColor(15, 23, 42);
    pdf.text('Rentable', margin + 34 + pdf.getTextWidth('Ruta'), 49);
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(9);
    pdf.setTextColor(100, 116, 139);
    pdf.text(`${genLabel} ${generated}`, pageW - margin, 46, { align: 'right' });
    pdf.setDrawColor(GREEN[0], GREEN[1], GREEN[2]);
    pdf.setLineWidth(2);
    pdf.line(margin, 64, pageW - margin, 64);
  };

  drawChrome();

  // Title.
  let y = 92;
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(16);
  pdf.setTextColor(15, 23, 42);
  pdf.text(doc.title, margin, y);
  y += 16;

  // KPI cards — 3-column grid.
  if (doc.kpis.length) {
    const cols = 3;
    const gap = 10;
    const cardW = (pageW - margin * 2 - gap * (cols - 1)) / cols;
    const cardH = 46;
    doc.kpis.forEach((k, i) => {
      const col = i % cols;
      const row = Math.floor(i / cols);
      const x = margin + col * (cardW + gap);
      const cy = y + row * (cardH + gap);
      pdf.setDrawColor(226, 232, 240);
      pdf.setFillColor(255, 255, 255);
      pdf.setLineWidth(0.8);
      pdf.roundedRect(x, cy, cardW, cardH, 6, 6, 'FD');
      pdf.setFont('helvetica', 'normal');
      pdf.setFontSize(8.5);
      pdf.setTextColor(100, 116, 139);
      pdf.text(k.label, x + 10, cy + 17);
      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(13);
      pdf.setTextColor(15, 23, 42);
      pdf.text(k.value, x + 10, cy + 35);
    });
    const rows = Math.ceil(doc.kpis.length / cols);
    y += rows * (cardH + gap) + 8;
  }

  // Tables.
  for (const section of doc.sections) {
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(11);
    pdf.setTextColor(51, 65, 85);
    pdf.text(section.heading, margin, y);
    y += 6;
    autoTable(pdf, {
      startY: y,
      head: [section.columns],
      body: section.rows.length ? section.rows.map((r) => r.map(String)) : [['—']],
      theme: 'striped',
      margin: { left: margin, right: margin, top: 80 },
      styles: { fontSize: 9, cellPadding: 5, textColor: [30, 41, 59] },
      headStyles: { fillColor: [240, 253, 244], textColor: [21, 128, 61], fontStyle: 'bold', fontSize: 8.5 },
      alternateRowStyles: { fillColor: [250, 250, 250] },
      didDrawPage: drawChrome,
    });
    // @ts-expect-error lastAutoTable is attached by jspdf-autotable.
    y = (pdf.lastAutoTable?.finalY ?? y) + 22;
  }

  // Footer on every page.
  const pageCount = pdf.getNumberOfPages();
  for (let p = 1; p <= pageCount; p++) {
    pdf.setPage(p);
    pdf.setDrawColor(226, 232, 240);
    pdf.setLineWidth(0.5);
    pdf.line(margin, pageH - 30, pageW - margin, pageH - 30);
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(8);
    pdf.setTextColor(148, 163, 184);
    pdf.text('RutaRentable', margin, pageH - 18);
    pdf.text(`${p} / ${pageCount}`, pageW - margin, pageH - 18, { align: 'right' });
  }

  if (Capacitor.isNativePlatform()) {
    const base64 = (pdf.output('datauristring') as string).split(',')[1];
    await saveFile(filename, base64, 'application/pdf', true);
  } else {
    const url = URL.createObjectURL(pdf.output('blob'));
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }
}
