// ── pdfExport.ts ─────────────────────────────────────────────────────────────
// Utility untuk mengekspor halaman Beranda (dashboard kepegawaian) menjadi
// laporan PDF yang rapi dan tetap sesuai tampilan aslinya di frontend.
//
// Strategi: setiap blok visual di halaman (hero, baris-baris chart, kartu
// insight) di-"foto" langsung dari DOM menggunakan html2canvas (resolusi 2x
// biar tajam saat dicetak), lalu gambar-gambar itu disusun ke halaman A4
// berurutan dengan header/footer konsisten. Dengan begini, warna, gradient,
// dan chart recharts yang dirender di browser akan identik dengan yang
// tampil di layar — bukan versi "dibuat ulang" yang berisiko beda.
//
// Install dependency (sekali saja di project frontend):
//   npm install jspdf html2canvas
//
// Pemakaian: lihat exportBerandaToPdf() di bagian bawah file ini, dan lihat
// contoh integrasinya di Beranda.tsx.

import jsPDF from "jspdf";
// PENTING: pakai "html2canvas-pro", BUKAN "html2canvas" biasa.
// html2canvas versi original belum bisa parse fungsi warna CSS modern
// (oklch(), lab(), color-mix(), dst) yang jadi default di Tailwind v4 —
// hasilnya error "Attempting to parse an unsupported color function".
// html2canvas-pro adalah fork yang sudah mendukung semuanya, dengan API
// yang identik (drop-in replacement), jadi tidak ada kode lain yang berubah.
import html2canvas from "html2canvas-pro";

// ── Ukuran halaman & margin (dalam mm, kertas A4 potret) ───────────────────────
const A4_WIDTH_MM = 210;
const A4_HEIGHT_MM = 297;
const MARGIN_X_MM = 12;
const HEADER_HEIGHT_MM = 18;
const FOOTER_HEIGHT_MM = 12;
const CONTENT_WIDTH_MM = A4_WIDTH_MM - MARGIN_X_MM * 2;
const MAX_CONTENT_HEIGHT_MM =
  A4_HEIGHT_MM - HEADER_HEIGHT_MM - FOOTER_HEIGHT_MM - 10; // sisa ruang aman per halaman
const GAP_MM = 6; // jarak vertikal antar blok

export interface PdfExportOptions {
  /** Nama file yang diunduh, tanpa perlu akhiran .pdf. WAJIB dibedakan per halaman
   *  (mis. "Laporan-Beranda-...", "Laporan-Proyeksi-Pensiun-..."), supaya
   *  unduhan dari halaman berbeda tidak saling menimpa/nama sama. */
  fileName?: string;
  /** Judul besar di halaman sampul, mis. "Laporan Dashboard Kepegawaian ASN" */
  reportTitle?: string;
  /** Sub-judul di bawah judul, mis. "Provinsi Jawa Timur" */
  reportSubtitle?: string;
  /** Baris ringkasan singkat, mis. "Total 12.345 ASN di 48 OPD" */
  summaryLine?: string;
  /** Teks kecil di setiap footer halaman */
  footerText?: string;
}

// ── Satu "blok" konten yang akan dicapture ke gambar dan ditempel ke PDF ───────
export interface PdfSection {
  /** Elemen DOM yang akan difoto. Kalau null, section ini dilewati (aman
   *  dipanggil sebelum ref ter-attach). */
  element: HTMLElement | null;
  /** Judul kecil dicetak sebagai teks pemisah tepat di atas gambar ini
   *  (opsional) — dipakai untuk heading antar-kelompok chart, mis.
   *  "Komposisi & Distribusi Generasi". */
  label?: string;
}

export interface BerandaExportRefs {
  /** Section hero (Total ASN + KPI ringkasan) */
  hero: HTMLElement | null;
  /** Baris 1: Status Kepegawaian + Komposisi Generasi per Status */
  row1: HTMLElement | null;
  /** Baris 2: Distribusi Generasi (donut) + Top 5 OPD */
  row2: HTMLElement | null;
  /** Baris 3: Proyeksi Pensiun per Tahun + Risiko Eselon */
  row3: HTMLElement | null;
  /** Section Rekomendasi AI & Insight Utama */
  insight: HTMLElement | null;
}

// ── Ambil "foto" dari sebuah elemen DOM sebagai canvas ─────────────────────────
async function captureElement(el: HTMLElement): Promise<HTMLCanvasElement> {
  return html2canvas(el, {
    scale: 2, // resolusi 2x supaya tajam saat dicetak / di-zoom
    useCORS: true,
    backgroundColor: "#ffffff",
    logging: false,
    // Elemen dengan atribut data-pdf-ignore="true" (mis. tombol "Ekspor
    // Laporan" itu sendiri) tidak akan ikut ter-capture ke gambar.
    ignoreElements: (node) => node.getAttribute?.("data-pdf-ignore") === "true",
  });
}

// ── Header & footer standar di setiap halaman ──────────────────────────────────
function drawHeader(pdf: jsPDF, title: string) {
  pdf.setFillColor(15, 23, 42); // slate-900, senada dengan hero dashboard
  pdf.rect(0, 0, A4_WIDTH_MM, HEADER_HEIGHT_MM, "F");
  pdf.setTextColor(255, 255, 255);
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(12);
  pdf.text(title, MARGIN_X_MM, HEADER_HEIGHT_MM / 2 + 4);

  const now = new Date();
  const tanggal = now.toLocaleDateString("id-ID", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(8.5);
  pdf.setTextColor(191, 219, 254); // blue-200
  pdf.text(`Dicetak ${tanggal}`, A4_WIDTH_MM - MARGIN_X_MM, HEADER_HEIGHT_MM / 2 + 4, {
    align: "right",
  });
}

function drawFooter(pdf: jsPDF, pageNum: number, totalPages: number, footerText: string) {
  const lineY = A4_HEIGHT_MM - FOOTER_HEIGHT_MM;
  pdf.setDrawColor(226, 232, 240); // slate-200
  pdf.setLineWidth(0.2);
  pdf.line(MARGIN_X_MM, lineY, A4_WIDTH_MM - MARGIN_X_MM, lineY);

  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(8);
  pdf.setTextColor(100, 116, 139); // slate-500
  pdf.text(footerText, MARGIN_X_MM, lineY + 6);
  pdf.text(`Halaman ${pageNum} dari ${totalPages}`, A4_WIDTH_MM - MARGIN_X_MM, lineY + 6, {
    align: "right",
  });
}

// ── Tulis blok judul + sub-judul + ringkasan di bagian atas sampul ─────────────
function drawCoverText(
  pdf: jsPDF,
  cursorY: number,
  title: string,
  subtitle?: string,
  summaryLine?: string
): number {
  let y = cursorY;
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(18);
  pdf.setTextColor(15, 23, 42);
  pdf.text(title, MARGIN_X_MM, y);
  y += 8;

  if (subtitle) {
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(11);
    pdf.setTextColor(71, 85, 105); // slate-600
    pdf.text(subtitle, MARGIN_X_MM, y);
    y += 7;
  }

  if (summaryLine) {
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(9.5);
    pdf.setTextColor(100, 116, 139);
    pdf.text(summaryLine, MARGIN_X_MM, y);
    y += 6;
  }

  return y + 4;
}

// ── Tulis judul kecil pemisah antar-bagian (mis. "Komposisi & Distribusi
//    Generasi") langsung sebagai teks PDF, biar tetap tajam & bisa dicari ──────
function drawSectionLabel(pdf: jsPDF, cursorY: number, label: string): number {
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(10.5);
  pdf.setTextColor(30, 41, 59); // slate-800
  pdf.text(label.toUpperCase(), MARGIN_X_MM, cursorY);
  pdf.setDrawColor(203, 213, 225);
  pdf.setLineWidth(0.3);
  pdf.line(MARGIN_X_MM, cursorY + 1.5, A4_WIDTH_MM - MARGIN_X_MM, cursorY + 1.5);
  return cursorY + 7;
}

interface Cursor {
  y: number;
  page: number;
}

// Pastikan ada cukup ruang; kalau tidak, buka halaman baru dan reset cursor.
function ensureSpace(pdf: jsPDF, cursor: Cursor, neededHeightMm: number) {
  const maxY = A4_HEIGHT_MM - FOOTER_HEIGHT_MM - 4;
  if (cursor.y + neededHeightMm > maxY) {
    pdf.addPage();
    cursor.page += 1;
    cursor.y = HEADER_HEIGHT_MM + 8;
  }
}

// Tinggi kira-kira yang dipakai drawSectionLabel (termasuk jarak sebelum &
// sesudahnya): 2mm jarak atas + 7mm tinggi teks/garis label.
const LABEL_BLOCK_HEIGHT_MM = 9;

interface ImageMeta {
  canvas: HTMLCanvasElement;
  widthMm: number;
  heightMm: number;
}

// Hitung ukuran gambar hasil capture dalam mm, diskalakan supaya muat dalam
// satu halaman. `reservedHeightMm` dipakai untuk "menyisakan" ruang buat
// judul pemisah (label) yang akan digambar tepat di atas gambar ini, supaya
// label+gambar dijamin selalu muat bersama dalam satu halaman yang sama.
function computeImageMeta(canvas: HTMLCanvasElement, reservedHeightMm = 0): ImageMeta {
  let widthMm = CONTENT_WIDTH_MM;
  let heightMm = (canvas.height / canvas.width) * widthMm;
  const maxHeight = MAX_CONTENT_HEIGHT_MM - reservedHeightMm;

  if (heightMm > maxHeight) {
    const ratio = maxHeight / heightMm;
    heightMm = maxHeight;
    widthMm = widthMm * ratio;
  }

  return { canvas, widthMm, heightMm };
}

// Tempel gambar yang ukurannya sudah dihitung computeImageMeta() ke posisi
// cursor saat ini (TANPA cek muat lagi — itu sudah harus dilakukan sebelum
// memanggil fungsi ini, bersamaan dengan label-nya kalau ada).
function placeImageMeta(pdf: jsPDF, cursor: Cursor, meta: ImageMeta) {
  const imgData = meta.canvas.toDataURL("image/png");
  const xOffset = MARGIN_X_MM + (CONTENT_WIDTH_MM - meta.widthMm) / 2; // rata tengah
  pdf.addImage(imgData, "PNG", xOffset, cursor.y, meta.widthMm, meta.heightMm, undefined, "FAST");
  cursor.y += meta.heightMm + GAP_MM;
}

// ── Fungsi inti generik: ekspor sekumpulan section (dari halaman manapun)
//    menjadi satu PDF. Semua halaman yang punya tombol "Ekspor Laporan"
//    cukup memanggil fungsi ini dengan section dan fileName masing-masing. ────
export async function exportSectionsToPdf(
  sections: PdfSection[],
  options: PdfExportOptions = {}
): Promise<void> {
  const {
    fileName = `Laporan-${new Date().toISOString().slice(0, 10)}.pdf`,
    reportTitle = "Laporan",
    reportSubtitle,
    summaryLine,
    footerText = "Dashboard Kepegawaian ASN — Provinsi Jawa Timur",
  } = options;

  const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const cursor: Cursor = { y: 0, page: 1 };

  // ── Sampul: judul, sub-judul, ringkasan singkat ──
  cursor.y = HEADER_HEIGHT_MM + 14;
  cursor.y = drawCoverText(pdf, cursor.y, reportTitle, reportSubtitle, summaryLine);

  // ── Tempel tiap section berurutan, dengan label pemisah kalau ada ──
  // PENTING: label & gambar section di-capture & dihitung ukurannya DULU,
  // baru sekali cek "muat tidak" untuk keduanya sekaligus (ensureSpace).
  // Ini mencegah kasus judul "nyangkut" sendirian di ujung halaman
  // sementara gambarnya pindah ke halaman berikutnya.
  for (const section of sections) {
    if (!section.element) continue;

    const reservedHeightMm = section.label ? LABEL_BLOCK_HEIGHT_MM : 0;
    const canvas = await captureElement(section.element);
    const meta = computeImageMeta(canvas, reservedHeightMm);

    ensureSpace(pdf, cursor, reservedHeightMm + meta.heightMm);

    if (section.label) {
      cursor.y = drawSectionLabel(pdf, cursor.y + 2, section.label);
    }

    placeImageMeta(pdf, cursor, meta);
  }

  // ── Gambar header + footer di semua halaman (dilakukan di akhir karena
  //    baru sekarang total jumlah halaman diketahui) ──
  const totalPages = pdf.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    pdf.setPage(i);
    drawHeader(pdf, reportTitle);
    drawFooter(pdf, i, totalPages, footerText);
  }

  pdf.save(fileName.endsWith(".pdf") ? fileName : `${fileName}.pdf`);
}

// ── Preset khusus halaman Beranda ──────────────────────────────────────────────
// Contoh cara membuat "preset" per halaman: susun section-section-nya sesuai
// struktur halaman itu, lalu beri fileName & judul yang unik supaya PDF yang
// diunduh dari Beranda tidak akan pernah bentrok nama dengan PDF dari
// halaman lain (Proyeksi Pensiun, Sebaran OPD, dst).
export async function exportBerandaToPdf(
  refs: BerandaExportRefs,
  options: PdfExportOptions = {}
): Promise<void> {
  const sections: PdfSection[] = [
    { element: refs.hero },
    { element: refs.row1, label: "Komposisi & Distribusi Generasi" },
    { element: refs.row2 },
    { element: refs.row3 },
    { element: refs.insight, label: "Rekomendasi & Insight Utama" },
  ];

  await exportSectionsToPdf(sections, {
    fileName: `Laporan-Beranda-Kepegawaian-${new Date().toISOString().slice(0, 10)}.pdf`,
    reportTitle: "Laporan Dashboard Kepegawaian ASN",
    reportSubtitle: "Provinsi Jawa Timur",
    ...options, // opsi dari pemanggil (mis. summaryLine) tetap bisa menimpa default di atas
  });
}