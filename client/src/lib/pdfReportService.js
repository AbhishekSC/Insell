import { jsPDF } from "jspdf";

// A small, reusable PDF-generation service — any admin "download report"
// action can build on `createReportDoc` (brand header, section headers, a
// two-column key/value row) rather than hand-rolling jsPDF calls each time.
// Colors mirror the app's own theme (client/tailwind.config.js `light`).

const BRAND = {
  primary: [47, 111, 237], // #2f6fed
  primarySoft: [224, 234, 253], // a light tint of primary for section backgrounds
  ink: [31, 41, 55], // #1f2937 (tailwind "neutral")
  muted: [107, 114, 128],
  border: [219, 228, 255], // #dbe4ff ("base-300")
  success: [22, 163, 74],
  error: [220, 38, 38],
};

const PAGE = { width: 210, height: 297, margin: 16 }; // A4, mm

function statusColor(status) {
  if (status === "APPROVED") return BRAND.success;
  if (status === "REJECTED") return BRAND.error;
  return BRAND.muted;
}

// Cloudinary/user-uploaded images are cross-origin; canvas can still read
// pixel data from them as long as the response allows it (Cloudinary does),
// so this quietly returns null on any failure rather than breaking the PDF.
async function urlToDataURL(url) {
  if (!url) return null;
  try {
    const res = await fetch(url, { mode: "cors" });
    const blob = await res.blob();
    return await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

function createReportDoc({ title, subtitle }) {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  let y = 0;

  // Header band
  doc.setFillColor(...BRAND.primary);
  doc.rect(0, 0, PAGE.width, 32, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.text("NearMySpace", PAGE.margin, 14);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.text("No brokers. No noise. Just verified owners.", PAGE.margin, 20);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.text(title, PAGE.margin, 27);
  if (subtitle) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.text(subtitle, PAGE.width - PAGE.margin, 27, { align: "right" });
  }

  y = 40;
  doc.setTextColor(...BRAND.ink);
  return { doc, y };
}

function sectionHeader(doc, y, label) {
  doc.setFillColor(...BRAND.primary);
  doc.rect(PAGE.margin, y, 1.2, 5, "F");
  doc.setTextColor(...BRAND.ink);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text(label, PAGE.margin + 4, y + 4.2);
  return y + 10;
}

// A label/value row, alternating a faint background so a long section of
// rows still reads as a table rather than a wall of text.
function kvRow(doc, y, label, value, { index = 0, valueColor, bold = false } = {}) {
  const rowHeight = 7.5;
  const left = PAGE.margin;
  const right = PAGE.width - PAGE.margin;
  if (index % 2 === 0) {
    doc.setFillColor(248, 250, 255);
    doc.rect(left, y - 5, right - left, rowHeight, "F");
  }
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9.5);
  doc.setTextColor(...BRAND.muted);
  doc.text(String(label), left + 2, y);

  doc.setFont("helvetica", bold ? "bold" : "normal");
  doc.setTextColor(...(valueColor || BRAND.ink));
  doc.text(String(value ?? "—"), right - 2, y, { align: "right" });

  return y + rowHeight;
}

function footer(doc) {
  const pageCount = doc.internal.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setDrawColor(...BRAND.border);
    doc.line(PAGE.margin, PAGE.height - 16, PAGE.width - PAGE.margin, PAGE.height - 16);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(...BRAND.muted);
    doc.text(`Generated ${new Date().toLocaleString()}`, PAGE.margin, PAGE.height - 10);
    doc.text(`Page ${i} of ${pageCount}`, PAGE.width - PAGE.margin, PAGE.height - 10, { align: "right" });
  }
}

/**
 * Builds and downloads a branded PDF summary of one owner-verification
 * request — the applicant's profile plus the submission/review trail.
 * `request` is an admin-queue row (see ownerVerification admin DTO);
 * `profile` is the richer `/admin/users` lookup, optional.
 */
export async function downloadVerificationReportPDF(request, profile) {
  const { doc, y: startY } = createReportDoc({
    title: "Owner Verification Report",
    subtitle: `Request #${request.id.slice(-8).toUpperCase()}`,
  });
  let y = startY;

  // Applicant header — avatar + name + email
  const avatarSize = 20;
  const avatarDataUrl = await urlToDataURL(request.user?.profilePic);
  if (avatarDataUrl) {
    try {
      doc.addImage(avatarDataUrl, "JPEG", PAGE.margin, y, avatarSize, avatarSize, undefined, "FAST");
    } catch {
      // Some formats (e.g. webp) aren't decodable by jsPDF — skip silently.
    }
  } else {
    doc.setFillColor(...BRAND.primarySoft);
    doc.circle(PAGE.margin + avatarSize / 2, y + avatarSize / 2, avatarSize / 2, "F");
    doc.setTextColor(...BRAND.primary);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(14);
    doc.text((request.user?.fullName || "?").charAt(0).toUpperCase(), PAGE.margin + avatarSize / 2, y + avatarSize / 2 + 2, {
      align: "center",
    });
  }
  doc.setTextColor(...BRAND.ink);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.text(request.user?.fullName || "Unknown", PAGE.margin + avatarSize + 5, y + 8);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(...BRAND.muted);
  doc.text(request.user?.email || "No email on file", PAGE.margin + avatarSize + 5, y + 14);

  if (request.user?.isOwnerVerified) {
    doc.setFillColor(...BRAND.primarySoft);
    doc.roundedRect(PAGE.margin + avatarSize + 5, y + 17, 30, 5.5, 1.5, 1.5, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7.5);
    doc.setTextColor(...BRAND.primary);
    doc.text("✓ VERIFIED OWNER", PAGE.margin + avatarSize + 7, y + 20.7);
  }

  y += avatarSize + 8;

  // Applicant details
  y = sectionHeader(doc, y, "Applicant");
  let i = 0;
  y = kvRow(doc, y, "City", profile?.city || request.user?.city || "—", { index: i++ });
  y = kvRow(doc, y, "Mobile", profile?.mobileNumber || "—", { index: i++ });
  y = kvRow(doc, y, "Role", profile?.activeRole || profile?.primaryRole || "—", { index: i++ });
  y = kvRow(doc, y, "Email verified", profile ? (profile.isVerified ? "Yes" : "No") : "—", { index: i++ });
  y = kvRow(doc, y, "Account status", profile ? (profile.isBlocked ? "Blocked" : "Active") : "—", {
    index: i++,
    valueColor: profile?.isBlocked ? BRAND.error : BRAND.ink,
    bold: Boolean(profile?.isBlocked),
  });
  if (profile?.isAdmin) {
    y = kvRow(doc, y, "Platform role", "Admin", { index: i++, valueColor: BRAND.primary, bold: true });
  }
  y = kvRow(
    doc,
    y,
    "Rating",
    profile?.ratingCount > 0 ? `${(profile.ratingAvg || 0).toFixed(1)} ★ (${profile.ratingCount} reviews)` : "No ratings yet",
    { index: i++ }
  );
  y = kvRow(doc, y, "Connections", Array.isArray(profile?.friends) ? profile.friends.length : "—", { index: i++ });
  y = kvRow(doc, y, "Member since", profile?.createdAt ? new Date(profile.createdAt).toLocaleDateString() : "—", {
    index: i++,
  });

  y += 6;

  // Document / submission details
  y = sectionHeader(doc, y, "Verification Submission");
  i = 0;
  y = kvRow(doc, y, "Document type", request.docType.replace(/_/g, " "), { index: i++ });
  if (request.docNumber) {
    y = kvRow(doc, y, "Document number", request.docNumber, { index: i++ });
  }
  y = kvRow(doc, y, "Submitted", new Date(request.createdAt).toLocaleString(), { index: i++ });
  y = kvRow(doc, y, "Status", request.status, { index: i++, valueColor: statusColor(request.status), bold: true });
  if (request.status !== "PENDING") {
    y = kvRow(doc, y, "Reviewed by", request.reviewedBy?.fullName || "—", { index: i++ });
    y = kvRow(doc, y, "Reviewed at", request.reviewedAt ? new Date(request.reviewedAt).toLocaleString() : "—", {
      index: i++,
    });
  }

  if (request.note || request.reviewNote) {
    y += 4;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(...BRAND.muted);
    if (request.note) {
      doc.text(`Applicant note: "${request.note}"`, PAGE.margin, y, { maxWidth: PAGE.width - PAGE.margin * 2 });
      y += 6;
    }
    if (request.reviewNote) {
      doc.text(`Review note: "${request.reviewNote}"`, PAGE.margin, y, { maxWidth: PAGE.width - PAGE.margin * 2 });
      y += 6;
    }
  }

  footer(doc);
  doc.save(`verification-report-${(request.user?.fullName || request.id).replace(/\s+/g, "-")}.pdf`);
}
