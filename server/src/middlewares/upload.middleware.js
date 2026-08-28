import multer from "multer";
import { createCloudinaryStorage } from "../config/cloudinary.js";

const storage = createCloudinaryStorage("community-resources", ["jpg", "jpeg", "png", "webp", "pdf", "docx", "txt"], {
  maxWidth: 1920,
  maxHeight: 1080,
  quality: 'auto:good',
  resourceType: 'auto'
});

function fileFilter(_req, file, cb) {
  const allowedMimeTypes = [
    "application/pdf",
    "image/png",
    "image/jpeg",
    "image/webp",
    "text/plain",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ];

  if (!allowedMimeTypes.includes(file.mimetype)) {
    cb(new Error("Unsupported file type"));
    return;
  }

  cb(null, true);
}

export const uploadCommunityResource = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 10 * 1024 * 1024,
  },
});

const expenseStorage = createCloudinaryStorage("expense-receipts", ["jpg", "jpeg", "png", "webp", "pdf"], {
  maxWidth: 1200,
  maxHeight: 1200,
  quality: 'auto:good',
  resourceType: 'auto'
});

function expenseFileFilter(_req, file, cb) {
  const allowedMimeTypes = ["image/png", "image/jpeg", "image/webp", "application/pdf"];
  if (!allowedMimeTypes.includes(file.mimetype)) {
    cb(new Error("Unsupported receipt file type"));
    return;
  }
  cb(null, true);
}

export const uploadExpenseReceipt = multer({
  storage: expenseStorage,
  fileFilter: expenseFileFilter,
  limits: {
    fileSize: 8 * 1024 * 1024,
  },
});

const profileStorage = createCloudinaryStorage("profile-pics", ["jpg", "jpeg", "png", "webp"], {
  maxWidth: 400,
  maxHeight: 400,
  quality: 'auto:best',
  resourceType: 'image'
});

function profileFileFilter(_req, file, cb) {
  const allowedMimeTypes = ["image/png", "image/jpeg", "image/webp"];
  if (!allowedMimeTypes.includes(file.mimetype)) {
    cb(new Error("Unsupported profile image file type"));
    return;
  }
  cb(null, true);
}

export const uploadProfileImage = multer({
  storage: profileStorage,
  fileFilter: profileFileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024,
  },
});

const announcementImageStorage = createCloudinaryStorage("announcements", ["jpg", "jpeg", "png", "webp"], {
  maxWidth: 1200,
  maxHeight: 800,
  quality: 'auto:good',
  resourceType: 'image'
});

function announcementImageFileFilter(_req, file, cb) {
  const allowedMimeTypes = ["image/png", "image/jpeg", "image/webp"];
  if (!allowedMimeTypes.includes(file.mimetype)) {
    cb(new Error("Unsupported image file type"));
    return;
  }
  cb(null, true);
}

export const uploadAnnouncementImage = multer({
  storage: announcementImageStorage,
  fileFilter: announcementImageFileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024,
  },
});

const feedbackScreenshotStorage = createCloudinaryStorage("feedback-screenshots", ["jpg", "jpeg", "png", "webp"], {
  maxWidth: 1600,
  maxHeight: 1600,
  quality: 'auto:good',
  resourceType: 'image'
});

function feedbackScreenshotFileFilter(_req, file, cb) {
  const allowedMimeTypes = ["image/png", "image/jpeg", "image/webp"];
  if (!allowedMimeTypes.includes(file.mimetype)) {
    cb(new Error("Unsupported image file type"));
    return;
  }
  cb(null, true);
}

export const uploadFeedbackScreenshot = multer({
  storage: feedbackScreenshotStorage,
  fileFilter: feedbackScreenshotFileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024,
  },
});

const communityPhotoStorage = createCloudinaryStorage("community-photos", ["jpg", "jpeg", "png", "webp"], {
  maxWidth: 800,
  maxHeight: 800,
  quality: 'auto:best',
  resourceType: 'image'
});

function communityPhotoFileFilter(_req, file, cb) {
  const allowedMimeTypes = ["image/png", "image/jpeg", "image/webp"];
  if (!allowedMimeTypes.includes(file.mimetype)) {
    cb(new Error("Unsupported community photo file type"));
    return;
  }
  cb(null, true);
}

export const uploadCommunityPhoto = multer({
  storage: communityPhotoStorage,
  fileFilter: communityPhotoFileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024,
  },
});

const propertyMediaStorage = createCloudinaryStorage("property-media", ["jpg", "jpeg", "png", "webp", "gif", "mp4", "webm", "mov"], {
  maxWidth: 1920,
  maxHeight: 1080,
  quality: 'auto:good',
  resourceType: 'auto'
});

function propertyMediaFileFilter(_req, file, cb) {
  const allowedMimeTypes = [
    "image/png",
    "image/jpeg",
    "image/webp",
    "image/gif",
    "video/mp4",
    "video/webm",
    "video/quicktime",
  ];
  if (!allowedMimeTypes.includes(file.mimetype)) {
    cb(new Error("Unsupported media file type. Only images (PNG, JPEG, WEBP, GIF) and videos (MP4, WEBM, MOV) are allowed."));
    return;
  }
  cb(null, true);
}

export const uploadPropertyMedia = multer({
  storage: propertyMediaStorage,
  fileFilter: propertyMediaFileFilter,
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB for videos
    files: 5, // Max 5 files
  },
});

const storyStorage = createCloudinaryStorage("stories", ["jpg", "jpeg", "png", "webp", "gif", "mp4", "webm", "mov"], {
  maxWidth: 1080,
  maxHeight: 1920,
  quality: 'auto:good',
  resourceType: 'auto'
});

function storyFileFilter(_req, file, cb) {
  const allowedMimeTypes = [
    "image/png",
    "image/jpeg",
    "image/webp",
    "image/gif",
    "video/mp4",
    "video/webm",
    "video/quicktime",
  ];
  if (!allowedMimeTypes.includes(file.mimetype)) {
    cb(new Error("Unsupported story file type. Only images (PNG, JPEG, WEBP, GIF) and videos (MP4, WEBM, MOV) are allowed."));
    return;
  }
  cb(null, true);
}

export const uploadStoryMedia = multer({
  storage: storyStorage,
  fileFilter: storyFileFilter,
  limits: {
    fileSize: 30 * 1024 * 1024, // 30MB for stories
  },
});
