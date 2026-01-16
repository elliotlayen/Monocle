import jsPDF from "jspdf";
import type { SchemaGraph } from "@/features/schema-graph/types";

export interface PdfExportOptions {
  title?: string;
  includeImage?: boolean;
  imageData?: Uint8Array;
  connectionInfo?: { server: string; database: string };
}

export async function exportToPdf(
  schema: SchemaGraph,
  options: PdfExportOptions = {}
): Promise<Uint8Array> {
  const {
    title = "Schema Report",
    connectionInfo,
    includeImage,
    imageData,
  } = options;

  const doc = new jsPDF({
    orientation: "portrait",
    unit: "mm",
    format: "a4",
  });

  const pageWidth = doc.internal.pageSize.getWidth();
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
  doc.text(title, margin, yPos);
  yPos += 10;

  // Connection info
  if (connectionInfo) {
    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(100);
    doc.text(`Server: ${connectionInfo.server}`, margin, yPos);
    yPos += 5;
    doc.text(`Database: ${connectionInfo.database}`, margin, yPos);
    yPos += 5;
    doc.text(`Generated: ${new Date().toLocaleString()}`, margin, yPos);
    yPos += 10;
  }

  // Summary section
  doc.setTextColor(0);
  doc.setFontSize(14);
  doc.setFont("helvetica", "bold");
  doc.text("Summary", margin, yPos);
  yPos += 7;

  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  const summaryItems = [
    `Tables: ${schema.tables.length}`,
    `Views: ${schema.views.length}`,
    `Relationships: ${schema.relationships.length}`,
    `Triggers: ${schema.triggers.length}`,
    `Stored Procedures: ${schema.storedProcedures.length}`,
    `Scalar Functions: ${schema.scalarFunctions.length}`,
  ];
  summaryItems.forEach((item) => {
    doc.text(item, margin + 5, yPos);
    yPos += 5;
  });
  yPos += 5;

  // Include graph image if provided
  if (includeImage && imageData) {
    checkPageBreak(100);
    doc.setFontSize(14);
    doc.setFont("helvetica", "bold");
    doc.text("Schema Diagram", margin, yPos);
    yPos += 7;

    const blob = new Blob([imageData], { type: "image/png" });
    const imageUrl = URL.createObjectURL(blob);

    try {
      const imgWidth = pageWidth - margin * 2;
      const imgHeight = 80;
      doc.addImage(imageUrl, "PNG", margin, yPos, imgWidth, imgHeight);
      yPos += imgHeight + 10;
    } finally {
      URL.revokeObjectURL(imageUrl);
    }
  }

  // Tables section
  if (schema.tables.length > 0) {
    checkPageBreak(20);
    doc.setFontSize(14);
    doc.setFont("helvetica", "bold");
    doc.text("Tables", margin, yPos);
    yPos += 7;

    schema.tables.forEach((table) => {
      checkPageBreak(15 + table.columns.length * 4);

      doc.setFontSize(11);
      doc.setFont("helvetica", "bold");
      doc.text(`${table.schema}.${table.name}`, margin + 5, yPos);
      yPos += 5;

      doc.setFontSize(9);
      doc.setFont("helvetica", "normal");
      table.columns.forEach((col) => {
        const pkIndicator = col.isPrimaryKey ? " (PK)" : "";
        const nullable = col.isNullable ? "NULL" : "NOT NULL";
        doc.text(
          `  ${col.name}: ${col.dataType} ${nullable}${pkIndicator}`,
          margin + 10,
          yPos
        );
        yPos += 4;
      });
      yPos += 3;
    });
  }

  // Views section
  if (schema.views.length > 0) {
    checkPageBreak(20);
    doc.setFontSize(14);
    doc.setFont("helvetica", "bold");
    doc.text("Views", margin, yPos);
    yPos += 7;

    schema.views.forEach((view) => {
      checkPageBreak(10);
      doc.setFontSize(10);
      doc.setFont("helvetica", "normal");
      doc.text(
        `${view.schema}.${view.name} (${view.columns.length} columns)`,
        margin + 5,
        yPos
      );
      yPos += 5;
    });
    yPos += 5;
  }

  // Stored Procedures section
  if (schema.storedProcedures.length > 0) {
    checkPageBreak(20);
    doc.setFontSize(14);
    doc.setFont("helvetica", "bold");
    doc.text("Stored Procedures", margin, yPos);
    yPos += 7;

    schema.storedProcedures.forEach((proc) => {
      checkPageBreak(10);
      doc.setFontSize(10);
      doc.setFont("helvetica", "normal");
      doc.text(
        `${proc.schema}.${proc.name} (${proc.parameters.length} params)`,
        margin + 5,
        yPos
      );
      yPos += 5;
    });
    yPos += 5;
  }

  // Scalar Functions section
  if (schema.scalarFunctions.length > 0) {
    checkPageBreak(20);
    doc.setFontSize(14);
    doc.setFont("helvetica", "bold");
    doc.text("Scalar Functions", margin, yPos);
    yPos += 7;

    schema.scalarFunctions.forEach((fn) => {
      checkPageBreak(10);
      doc.setFontSize(10);
      doc.setFont("helvetica", "normal");
      doc.text(
        `${fn.schema}.${fn.name} -> ${fn.returnType}`,
        margin + 5,
        yPos
      );
      yPos += 5;
    });
  }

  const pdfOutput = doc.output("arraybuffer");
  return new Uint8Array(pdfOutput);
}
