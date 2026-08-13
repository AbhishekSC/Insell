import { param } from "express-validator";

export const markNotificationReadRules = [
  param("notificationId").isMongoId().withMessage("Valid notificationId is required"),
];
