import jsPDF from "jspdf";
import type { ScanSummary } from "../types";

export async function exportScanToPdf(
  result: ScanSummary
): Promise<Uint8Array> {
  const doc = new jsPDF({
    orientation: "portrait",
    unit: "mm",
    format: "a4",
  });

  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 15;
  let yPos = 20;

  const checkPageBreak = (height: number) => {
    if (yPos + height > pageHeight - 20) {
      doc.addPage();
      yPos = 20;
    }
  };

  // Title
  doc.setFontSize(24);
  doc.setFont("helvetica", "bold");
  doc.text("Scan Report", margin, yPos);
  yPos += 10;

  // Metadata
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(100);
  doc.text(`Folder: ${result.folderPath}`, margin, yPos);
  yPos += 5;
  doc.text(`Pattern: ${result.filePattern}`, margin, yPos);
  yPos += 5;
  doc.text(`Scan Date: ${new Date().toISOString()}`, margin, yPos);
  yPos += 5;
  doc.text(`Generated: ${new Date().toLocaleString()}`, margin, yPos);
  yPos += 10;

  // Summary section
  doc.setTextColor(0);
  doc.setFontSize(14);
  doc.setFont("helvetica", "bold");
  doc.text("Summary", margin, yPos);
  yPos += 7;

  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  const summaryItems = [
    `Total Files: ${result.totalFiles}`,
    `Error Files: ${result.errorFiles}`,
    `Warning Files: ${result.warningFiles}`,
    `Clean Files: ${result.cleanFiles}`,
    `Total Errors: ${result.totalErrors}`,
    `Total Warnings: ${result.totalWarnings}`,
  ];
  for (const item of summaryItems) {
    doc.text(item, margin + 5, yPos);
    yPos += 5;
  }
  yPos += 5;

  // File Details section
  checkPageBreak(20);
  doc.setFontSize(14);
  doc.setFont("helvetica", "bold");
  doc.text("File Details", margin, yPos);
  yPos += 7;

  for (const file of result.files) {
    checkPageBreak(15 + file.problems.length * 4);

    // File name
    doc.setFontSize(11);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(0);
    doc.text(file.fileName, margin + 5, yPos);
    yPos += 4;

    // Relative path in gray
    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(100);
    doc.text(file.relativePath, margin + 5, yPos);
    yPos += 4;

    if (file.problems.length === 0) {
      doc.setTextColor(0);
      doc.setFontSize(9);
      doc.text("  Clean", margin + 5, yPos);
      yPos += 4;
    } else {
      doc.setTextColor(0);
      doc.setFontSize(9);
      doc.setFont("helvetica", "normal");
      for (const problem of file.problems) {
        checkPageBreak(5);
        const severityLabel =
          problem.severity === "error" ? "ERROR" : "WARN";
        doc.text(
          `  [${severityLabel}] Ln ${problem.line}, Col ${problem.column}: ${problem.message}`,
          margin + 5,
          yPos
        );
        yPos += 4;
      }
    }

    yPos += 3;
  }

  const pdfOutput = doc.output("arraybuffer");
  return new Uint8Array(pdfOutput);
}
