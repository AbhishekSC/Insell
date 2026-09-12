export function toScheduledCallDTO(call) {
  return {
    id: String(call._id),
    circle: String(call.circle?._id || call.circle),
    title: call.title || "",
    scheduledAt: call.scheduledAt,
    durationMinutes: call.durationMinutes ?? null,
    status: call.status,
    reminderSentAt: call.reminderSentAt || null,
    endedAt: call.endedAt || null,
    createdAt: call.createdAt,
    // scheduledBy may or may not be populated depending on the call site —
    // only shape it as an object once we can tell it actually was.
    scheduledBy:
      call.scheduledBy && typeof call.scheduledBy === "object" && call.scheduledBy.fullName
        ? {
            id: String(call.scheduledBy._id),
            fullName: call.scheduledBy.fullName,
            profilePic: call.scheduledBy.profilePic || null,
          }
        : call.scheduledBy
          ? { id: String(call.scheduledBy) }
          : null,
  };
}
