import PDFDocument from "pdfkit";

const STATE_CLAUSES = {
  maharashtra: {
    registrationNote: "As per the Maharashtra Rent Control Act, 1999, and the Model Tenancy Act, this agreement must be registered with the Sub-Registrar within 2 months of execution. Stamp duty of up to 0.25% of the total rent for the lease period is applicable.",
    policeVerification: "The Landlord shall ensure police verification of the Tenant as per Maharashtra Police Act requirements within 15 days of move-in.",
    stampDuty: "Stamp Duty applicable as per Maharashtra Stamp Act (typically ₹500 for 11-month agreements).",
  },
  karnataka: {
    registrationNote: "As per the Karnataka Rent Control Act, 2001, agreements exceeding 11 months must be registered. Stamp duty of 1% of total rent + deposit applies.",
    policeVerification: "Police verification is recommended but not mandatory under Karnataka state rules.",
    stampDuty: "Stamp Duty: 1% of (total rent for period + refundable deposit).",
  },
  delhi: {
    registrationNote: "As per the Delhi Rent Control Act, 1958, and the Delhi Rent Act, 1995, all rental agreements should be registered. Stamp duty is 2% of average annual rent.",
    policeVerification: "Tenant police verification is mandatory as per Delhi Police standing orders. The Landlord must report tenant details to the local police station within 24 hours.",
    stampDuty: "Stamp Duty: 2% of average annual rent, minimum ₹100.",
  },
  tamil_nadu: {
    registrationNote: "As per the Tamil Nadu Regulation of Rights and Responsibilities of Landlords and Tenants Act, 2017, all rental agreements must be registered.",
    policeVerification: "Tenant verification is recommended through local police station.",
    stampDuty: "Stamp Duty: 1% of annual rent.",
  },
  telangana: {
    registrationNote: "As per the Telangana Rights of Tenants and Landlords Act, rental agreements must be registered with the Rent Authority.",
    policeVerification: "Police verification of tenants is recommended.",
    stampDuty: "Stamp Duty: 0.5% of annual rent or ₹500, whichever is higher.",
  },
  other: {
    registrationNote: "It is recommended to register this agreement with the local Sub-Registrar office as per applicable state laws.",
    policeVerification: "Tenant verification through local police may be required as per local regulations.",
    stampDuty: "Stamp duty as applicable under the relevant state Stamp Act.",
  },
};

export function generateAgreementPdf(agreement) {
  const doc = new PDFDocument({ size: "A4", margin: 50 });
  const buffers = [];
  doc.on("data", (chunk) => buffers.push(chunk));

  const stateClauses = STATE_CLAUSES[agreement.state] || STATE_CLAUSES.other;
  const leaseStart = new Date(agreement.leaseStartDate).toLocaleDateString("en-IN");
  const leaseEnd = new Date(agreement.leaseEndDate).toLocaleDateString("en-IN");
  const today = new Date().toLocaleDateString("en-IN");

  // Title
  doc.fontSize(20).font("Helvetica-Bold").text("RENTAL / LEASE AGREEMENT", { align: "center" }).moveDown(0.5);
  doc.fontSize(10).font("Helvetica").text(`Date: ${today}`, { align: "center" }).moveDown(1);
  doc.moveTo(50, doc.y).lineTo(545, doc.y).stroke("#cccccc").moveDown(1);

  // Preamble
  doc.fontSize(11).font("Helvetica").text(
    `This Rental Agreement ("Agreement") is made and executed on ${today} between:`,
    { lineGap: 4 }
  ).moveDown(0.5);

  // Landlord
  doc.font("Helvetica-Bold").text("LANDLORD:", { continued: true }).font("Helvetica")
    .text(` ${agreement.landlordName}`, { lineGap: 2 });
  if (agreement.landlordAddress) doc.text(`Address: ${agreement.landlordAddress}`, { lineGap: 2 });
  if (agreement.landlordPhone) doc.text(`Phone: ${agreement.landlordPhone}`, { lineGap: 2 });
  doc.moveDown(0.5);

  // Tenant
  doc.font("Helvetica-Bold").text("TENANT:", { continued: true }).font("Helvetica")
    .text(` ${agreement.tenantName}`, { lineGap: 2 });
  if (agreement.tenantAddress) doc.text(`Address: ${agreement.tenantAddress}`, { lineGap: 2 });
  if (agreement.tenantPhone) doc.text(`Phone: ${agreement.tenantPhone}`, { lineGap: 2 });
  doc.moveDown(1);

  doc.moveTo(50, doc.y).lineTo(545, doc.y).stroke("#cccccc").moveDown(1);

  // Property details
  section(doc, "1. PROPERTY DETAILS");
  doc.text(`The Landlord hereby lets out and the Tenant hereby takes on rent the property situated at:`);
  doc.font("Helvetica-Bold").text(agreement.propertyAddress).font("Helvetica").moveDown(0.3);
  if (agreement.propertyType) doc.text(`Property Type: ${agreement.propertyType}`);
  if (agreement.furnishing) doc.text(`Furnishing Status: ${agreement.furnishing}`);
  doc.moveDown(0.8);

  // Term
  section(doc, "2. TERM OF LEASE");
  doc.text(`This agreement shall commence from ${leaseStart} and shall remain valid until ${leaseEnd}.`);
  if (agreement.lockInPeriodMonths > 0) {
    doc.text(`Lock-in Period: ${agreement.lockInPeriodMonths} month(s). Neither party may terminate the agreement during this period.`);
  }
  doc.text(`Notice Period: ${agreement.noticePeriodMonths || 1} month(s) written notice is required for termination.`);
  doc.moveDown(0.8);

  // Rent
  section(doc, "3. RENT & DEPOSIT");
  doc.text(`Monthly Rent: ₹${Number(agreement.monthlyRent).toLocaleString("en-IN")}`);
  doc.text(`Security Deposit: ₹${Number(agreement.securityDeposit || 0).toLocaleString("en-IN")}`);
  if (agreement.maintenanceCharges > 0) {
    doc.text(`Maintenance Charges: ₹${Number(agreement.maintenanceCharges).toLocaleString("en-IN")} per month`);
  }
  doc.text(`Rent Due Date: ${agreement.rentDueDate || 5}th of every month`);
  doc.text(`The security deposit shall be refunded within 30 days of vacating, after deducting any damages or unpaid rent.`);
  doc.moveDown(0.8);

  // Standard clauses
  section(doc, "4. TENANT OBLIGATIONS");
  doc.text("a) The Tenant shall use the premises solely for residential purposes.", { lineGap: 2 });
  doc.text("b) The Tenant shall maintain the property in good condition and shall not make structural modifications without written consent.", { lineGap: 2 });
  doc.text("c) The Tenant shall not sublet the property without prior written consent of the Landlord.", { lineGap: 2 });
  doc.text("d) The Tenant shall pay utility bills (electricity, water, gas, internet) promptly.", { lineGap: 2 });
  doc.moveDown(0.8);

  section(doc, "5. LANDLORD OBLIGATIONS");
  doc.text("a) The Landlord shall ensure the property is in habitable condition at the time of handover.", { lineGap: 2 });
  doc.text("b) The Landlord shall be responsible for structural repairs and maintenance of common areas.", { lineGap: 2 });
  doc.text("c) The Landlord shall not interfere with the Tenant's peaceful enjoyment of the property.", { lineGap: 2 });
  doc.moveDown(0.8);

  // Check if we need a new page
  if (doc.y > 650) doc.addPage();

  section(doc, "6. TERMINATION");
  doc.text(`Either party may terminate this agreement by giving ${agreement.noticePeriodMonths || 1} month(s) written notice, except during the lock-in period.`, { lineGap: 2 });
  doc.text("Upon termination, the Tenant shall vacate the premises and return all keys. The Landlord shall inspect the property and refund the deposit as per Clause 3.", { lineGap: 2 });
  doc.moveDown(0.8);

  // State-specific
  if (doc.y > 600) doc.addPage();
  section(doc, "7. STATE-SPECIFIC PROVISIONS");
  doc.text(stateClauses.registrationNote, { lineGap: 2 });
  doc.text(stateClauses.policeVerification, { lineGap: 2 });
  doc.text(stateClauses.stampDuty, { lineGap: 2 });
  doc.moveDown(0.8);

  // Additional terms
  if (agreement.additionalTerms && agreement.additionalTerms.length) {
    if (doc.y > 600) doc.addPage();
    section(doc, "8. ADDITIONAL TERMS");
    agreement.additionalTerms.forEach((term, i) => {
      doc.text(`${String.fromCharCode(97 + i)}) ${term}`, { lineGap: 2 });
    });
    doc.moveDown(0.8);
  }

  // Dispute resolution
  if (doc.y > 650) doc.addPage();
  section(doc, agreement.additionalTerms?.length ? "9. DISPUTE RESOLUTION" : "8. DISPUTE RESOLUTION");
  doc.text("Any dispute arising out of this agreement shall first be resolved through mutual discussion. If unresolved, the matter shall be referred to the Rent Authority / Court of competent jurisdiction.", { lineGap: 2 });
  doc.moveDown(2);

  // Signatures
  if (doc.y > 620) doc.addPage();
  doc.moveTo(50, doc.y).lineTo(545, doc.y).stroke("#cccccc").moveDown(1.5);

  const sigY = doc.y;
  doc.fontSize(10).font("Helvetica");
  doc.text("_________________________", 60, sigY);
  doc.text("Landlord's Signature", 60, sigY + 18);
  doc.text(agreement.landlordName, 60, sigY + 32);

  doc.text("_________________________", 350, sigY);
  doc.text("Tenant's Signature", 350, sigY + 18);
  doc.text(agreement.tenantName, 350, sigY + 32);

  doc.moveDown(4);

  doc.text("Witness 1: _________________________", 60);
  doc.moveDown(0.5);
  doc.text("Witness 2: _________________________", 60);
  doc.moveDown(2);

  // Footer
  doc.fontSize(8).fillColor("#888888")
    .text("Generated via InSell - NearMySpace. This is a draft agreement template. Please consult a legal professional before execution.", 50, doc.y, { align: "center" });

  doc.end();

  return new Promise((resolve, reject) => {
    doc.on("end", () => resolve(Buffer.concat(buffers)));
    doc.on("error", reject);
  });
}

function section(doc, title) {
  doc.fontSize(12).font("Helvetica-Bold").text(title).moveDown(0.3).fontSize(10).font("Helvetica");
}
