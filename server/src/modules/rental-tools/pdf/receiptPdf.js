import PDFDocument from "pdfkit";

const MONTHS = [
  "", "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

export function generateRentReceiptPdf(payment) {
  const doc = new PDFDocument({ size: "A4", margin: 50 });
  const buffers = [];

  doc.on("data", (chunk) => buffers.push(chunk));

  const monthName = MONTHS[payment.month] || "";
  const periodStr = `${monthName} ${payment.year}`;

  // Header
  doc
    .fontSize(22)
    .font("Helvetica-Bold")
    .text("RENT RECEIPT", { align: "center" })
    .moveDown(0.5);

  doc
    .fontSize(10)
    .font("Helvetica")
    .text(`Receipt No: RR-${payment._id ? String(payment._id).slice(-8).toUpperCase() : Date.now()}`, { align: "center" })
    .text(`Date: ${new Date(payment.paymentDate || Date.now()).toLocaleDateString("en-IN")}`, { align: "center" })
    .moveDown(1.5);

  // Divider
  doc.moveTo(50, doc.y).lineTo(545, doc.y).stroke("#cccccc").moveDown(1);

  // Period
  doc
    .fontSize(14)
    .font("Helvetica-Bold")
    .text(`Period: ${periodStr}`, { align: "center" })
    .moveDown(1.5);

  // Details table
  const startY = doc.y;
  const col1 = 60;
  const col2 = 250;

  const addRow = (label, value) => {
    doc.fontSize(11).font("Helvetica-Bold").text(label, col1, doc.y, { continued: false });
    const labelY = doc.y - 14;
    doc.fontSize(11).font("Helvetica").text(value, col2, labelY);
    doc.moveDown(0.3);
  };

  addRow("Received From:", payment.tenantName || "Tenant");
  addRow("Landlord Name:", payment.landlordName);
  if (payment.landlordPAN) {
    addRow("Landlord PAN:", payment.landlordPAN);
  }
  addRow("Property Address:", payment.propertyAddress);
  addRow("Rent Amount:", `₹${Number(payment.amount).toLocaleString("en-IN")}`);
  addRow("Payment Mode:", (payment.paymentMode || "UPI").toUpperCase());
  addRow("Payment Date:", new Date(payment.paymentDate || Date.now()).toLocaleDateString("en-IN"));

  doc.moveDown(2);

  // Amount in words
  doc
    .fontSize(11)
    .font("Helvetica-Bold")
    .text(`Amount in Words: ${numberToWords(payment.amount)} Rupees Only`, col1)
    .moveDown(2);

  // Divider
  doc.moveTo(50, doc.y).lineTo(545, doc.y).stroke("#cccccc").moveDown(2);

  // Signature area
  doc
    .fontSize(10)
    .font("Helvetica")
    .text("_________________________", 380, doc.y, { align: "left" })
    .text("Landlord's Signature", 400, doc.y + 5, { align: "left" })
    .moveDown(3);

  // Footer
  doc
    .fontSize(8)
    .fillColor("#888888")
    .text(
      "This is a computer-generated receipt. Generated via InSell - NearMySpace.",
      50,
      doc.y,
      { align: "center" }
    )
    .text(
      "This receipt is valid for HRA tax exemption claims under Section 10(13A) of the Income Tax Act.",
      { align: "center" }
    );

  doc.end();

  return new Promise((resolve, reject) => {
    doc.on("end", () => resolve(Buffer.concat(buffers)));
    doc.on("error", reject);
  });
}

function numberToWords(num) {
  if (num === 0) return "Zero";
  const ones = ["", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine",
    "Ten", "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen", "Seventeen", "Eighteen", "Nineteen"];
  const tens = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"];

  const n = Math.floor(Math.abs(num));
  if (n < 20) return ones[n];
  if (n < 100) return `${tens[Math.floor(n / 10)]} ${ones[n % 10]}`.trim();
  if (n < 1000) return `${ones[Math.floor(n / 100)]} Hundred ${numberToWords(n % 100)}`.trim();
  if (n < 100000) return `${numberToWords(Math.floor(n / 1000))} Thousand ${numberToWords(n % 1000)}`.trim();
  if (n < 10000000) return `${numberToWords(Math.floor(n / 100000))} Lakh ${numberToWords(n % 100000)}`.trim();
  return `${numberToWords(Math.floor(n / 10000000))} Crore ${numberToWords(n % 10000000)}`.trim();
}
