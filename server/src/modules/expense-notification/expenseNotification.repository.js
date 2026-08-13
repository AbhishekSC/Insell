import Notification from "../../models/Notification.model.js";

export async function createOne(notificationDoc) {
  return Notification.create(notificationDoc);
}

export async function createMany(notificationDocs) {
  if (!Array.isArray(notificationDocs) || notificationDocs.length === 0) {
    return [];
  }
  return Notification.insertMany(notificationDocs);
}

export async function markManyRead(query) {
  return Notification.updateMany(query, { $set: { read: true } });
}
