import { NotificationChannel } from "../../services/NotificationService.js";

export const ACTIVE_STATUSES = ["PENDING", "RESCHEDULE_PROPOSED"];
export const ALL_CHANNELS = [NotificationChannel.IN_APP, NotificationChannel.REALTIME, NotificationChannel.FIREBASE];
// A confirmed visit blocks any other confirmed visit involving the same two
// people that starts within this window either side.
export const VISIT_CONFLICT_MS = 90 * 60 * 1000;
