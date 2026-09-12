import AppError from "../../exceptions/AppError.js";
import * as NotificationService from "../../services/NotificationService.js";
import { NotificationChannel } from "../../services/NotificationService.js";
import { DOC_TYPES } from "../../models/OwnerVerificationRequest.model.js";
import { toRequestDTO, toAdminQueueItemDTO } from "./ownerVerification.dto.js";
import {
  findActiveForUser,
  findPendingForUser,
  create,
  listByStatus,
  findById,
  markReviewed,
  setUserOwnerVerified,
} from "./ownerVerification.repository.js";

export async function getMyStatus(userId) {
  const req = await findActiveForUser(userId);
  return toRequestDTO(req);
}

// Format-only — a real-looking PAN/Aadhaar number, not an OCR cross-check
// against the uploaded image. The admin still visually compares the typed
// number to the document during review, same as before this field existed.
const PAN_FORMAT = /^[A-Z]{5}[0-9]{4}[A-Z]$/;

function normalizeDocNumber(docType, docNumber) {
  const raw = String(docNumber || "").trim();
  if (docType === "PAN") {
    const cleaned = raw.toUpperCase().replace(/\s+/g, "");
    if (!PAN_FORMAT.test(cleaned)) {
      throw new AppError("Enter a valid PAN number (e.g. ABCDE1234F)", 400);
    }
    return cleaned;
  }
  if (docType === "AADHAAR") {
    const cleaned = raw.replace(/[\s-]+/g, "");
    if (!/^\d{12}$/.test(cleaned)) {
      throw new AppError("Enter a valid 12-digit Aadhaar number", 400);
    }
    return cleaned;
  }
  // Any other doc type — the number field doesn't apply, ignore whatever was sent.
  return "";
}

export async function submitRequest(userId, { docType, docUrl, note, docNumber }) {
  if (!DOC_TYPES.includes(docType)) {
    throw new AppError("Choose a valid document type", 400);
  }
  if (!docUrl) {
    throw new AppError("A document upload is required", 400);
  }
  if ((docType === "PAN" || docType === "AADHAAR") && !docNumber) {
    throw new AppError(docType === "PAN" ? "PAN number is required" : "Aadhaar number is required", 400);
  }
  const existing = await findPendingForUser(userId);
  if (existing) {
    throw new AppError("You already have a verification request pending review", 409);
  }
  const doc = await create({
    userId,
    docType,
    docUrl,
    note: (note || "").trim().slice(0, 500),
    docNumber: normalizeDocNumber(docType, docNumber),
  });
  return toRequestDTO(doc);
}

export async function getQueue({ status, page, limit } = {}) {
  const { items, total, page: p, limit: l } = await listByStatus({ status, page, limit });
  return { requests: items.map(toAdminQueueItemDTO), total, page: p, limit: l };
}

export async function review(requestId, { approve, reviewNote, reviewerId }) {
  const doc = await findById(requestId);
  if (!doc) throw new AppError("Verification request not found", 404);
  if (doc.status !== "PENDING") throw new AppError("This request was already reviewed", 409);

  const status = approve ? "APPROVED" : "REJECTED";
  await markReviewed(requestId, { status, reviewNote, reviewerId });
  await setUserOwnerVerified(doc.user, approve);

  await NotificationService.send({
    recipientId: doc.user,
    actorId: reviewerId,
    type: "owner_verification_result",
    title: approve ? "You're a Verified Owner ✅" : "Verification request declined",
    message: approve
      ? "Your document was approved — the Verified Owner badge now shows on your listings and profile."
      : `Your verification request wasn't approved.${reviewNote ? ` ${reviewNote}` : ""} You can submit a new document any time.`,
    channels: [NotificationChannel.IN_APP, NotificationChannel.REALTIME, NotificationChannel.FIREBASE],
  }).catch(() => {});

  return { status };
}
