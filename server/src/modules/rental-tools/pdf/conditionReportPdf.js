import PDFDocument from "pdfkit";

export function generateConditionReportPdf(report) {
  const doc = new PDFDocument({ size: "A4", margin: 50 });
  const buffers = [];
  doc.on("data", (chunk) => buffers.push(chunk));

  const moveInDate = new Date(report.moveInDate || Date.now()).toLocaleDateString("en-IN");
  const generatedDate = new Date().toLocaleDateString("en-IN");

  // Header
  doc.fontSize(20).font("Helvetica-Bold").text("PROPERTY CONDITION REPORT", { align: "center" }).moveDown(0.3);
  doc.fontSize(10).font("Helvetica").text("Move-In Inspection", { align: "center" }).moveDown(0.5);
  doc.moveTo(50, doc.y).lineTo(545, doc.y).stroke("#cccccc").moveDown(1);

  // Summary
  const col1 = 60;
  const col2 = 220;

  const row = (label, value) => {
    doc.fontSize(10).font("Helvetica-Bold").text(label, col1, doc.y, { continued: false });
    const y = doc.y - 13;
    doc.fontSize(10).font("Helvetica").text(value || "—", col2, y);
    doc.moveDown(0.2);
  };

  row("Report Date:", generatedDate);
  row("Move-In Date:", moveInDate);
  row("Property Address:", report.propertyAddress);
  row("Tenant:", report.tenantName || "Tenant");
  row("Landlord:", report.landlordName);
  if (report.landlordPhone) row("Landlord Phone:", report.landlordPhone);
  doc.moveDown(1);

  doc.moveTo(50, doc.y).lineTo(545, doc.y).stroke("#cccccc").moveDown(1);

  // Room-by-room
  doc.fontSize(14).font("Helvetica-Bold").text("Room-by-Room Condition").moveDown(0.8);

  const rooms = report.rooms || [];
  rooms.forEach((room, i) => {
    if (doc.y > 650) doc.addPage();

    doc.fontSize(12).font("Helvetica-Bold")
      .text(`${i + 1}. ${room.name}`)
      .moveDown(0.3);

    const conditionColors = {
      excellent: "#22c55e",
      good: "#3b82f6",
      fair: "#eab308",
      poor: "#f97316",
      damaged: "#ef4444",
    };
    const color = conditionColors[room.condition] || "#888888";

    doc.fontSize(10).font("Helvetica")
      .fillColor(color)
      .text(`Condition: ${(room.condition || "not assessed").toUpperCase()}`)
      .fillColor("#000000");

    if (room.notes) {
      doc.moveDown(0.2).text(`Notes: ${room.notes}`);
    }

    if (room.photos && room.photos.length) {
      doc.moveDown(0.2).text(`Photos: ${room.photos.length} attached (see digital report)`);
    }

    doc.moveDown(0.6);
  });

  if (rooms.length === 0) {
    doc.fontSize(10).font("Helvetica").text("No rooms documented.", { align: "center" }).moveDown(1);
  }

  // Overall notes
  if (report.overallNotes) {
    if (doc.y > 620) doc.addPage();
    doc.moveDown(0.5);
    doc.moveTo(50, doc.y).lineTo(545, doc.y).stroke("#cccccc").moveDown(1);
    doc.fontSize(12).font("Helvetica-Bold").text("Overall Notes").moveDown(0.4);
    doc.fontSize(10).font("Helvetica").text(report.overallNotes).moveDown(1);
  }

  // Signatures
  if (doc.y > 620) doc.addPage();
  doc.moveDown(1);
  doc.moveTo(50, doc.y).lineTo(545, doc.y).stroke("#cccccc").moveDown(1.5);

  doc.fontSize(10).font("Helvetica");
  const sigY = doc.y;
  doc.text("_________________________", 60, sigY);
  doc.text("Tenant's Signature", 60, sigY + 18);

  doc.text("_________________________", 350, sigY);
  doc.text("Landlord's Signature", 350, sigY + 18);

  doc.moveDown(4);

  // Footer
  doc.fontSize(8).fillColor("#888888")
    .text(`Generated on ${generatedDate} via InSell - NearMySpace. This report documents the property condition at the time of move-in and serves as evidence in case of deposit disputes.`, 50, doc.y, { align: "center" });

  doc.end();

  return new Promise((resolve, reject) => {
    doc.on("end", () => resolve(Buffer.concat(buffers)));
    doc.on("error", reject);
  });
}
