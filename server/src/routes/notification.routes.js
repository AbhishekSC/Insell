import express from "express";
import { verifyUser } from "../middlewares/auth.middleware.js";
import NotificationController from "../controllers/NotificationController.js";
import NotificationRepository from "../repositories/NotificationRepository.js";
import NotificationService from "../services/NotificationService.js";
import { markNotificationReadRules } from "../validators/notification.validator.js";
import { validateRequest } from "../middlewares/validation.js";

const router = new express.Router();
const notificationRepository = new NotificationRepository();
const notificationService = new NotificationService({ notificationRepository });
const notificationController = new NotificationController({ notificationService });

router.use(verifyUser);
router.post("/:notificationId/read", markNotificationReadRules, validateRequest, notificationController.markRead);

export default router;
