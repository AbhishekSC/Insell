export function toMarkNotificationReadDTO(input = {}) {
  return {
    notificationId: String(input.notificationId || "").trim(),
  };
}
