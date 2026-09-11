export function toRequestDTO(doc) {
  if (!doc) return null;
  return {
    id: String(doc._id),
    docType: doc.docType,
    status: doc.status,
    note: doc.note || "",
    reviewNote: doc.reviewNote || "",
    reviewedAt: doc.reviewedAt || null,
    createdAt: doc.createdAt,
    // The document itself is never returned to the submitting user's own
    // status check — only admins reviewing the queue see docUrl (below).
  };
}

export function toAdminQueueItemDTO(doc) {
  return {
    id: String(doc._id),
    docType: doc.docType,
    docUrl: doc.docUrl,
    note: doc.note || "",
    status: doc.status,
    reviewNote: doc.reviewNote || "",
    reviewedAt: doc.reviewedAt || null,
    reviewedBy: doc.reviewedBy ? { fullName: doc.reviewedBy.fullName } : null,
    createdAt: doc.createdAt,
    user: doc.user
      ? {
          id: String(doc.user._id),
          fullName: doc.user.fullName,
          email: doc.user.email,
          profilePic: doc.user.profilePic,
          city: doc.user.city,
          isOwnerVerified: Boolean(doc.user.isOwnerVerified),
        }
      : null,
  };
}
