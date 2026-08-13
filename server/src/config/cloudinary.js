import { v2 as cloudinary } from 'cloudinary';
import { CloudinaryStorage } from 'multer-storage-cloudinary';
import { logger } from '../utils/logger.js';

// Cloudinary is configured lazily via testCloudinaryConnection() after config loads
export function configureCloudinary() {
  const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
  const apiKey = process.env.CLOUDINARY_API_KEY;
  const apiSecret = process.env.CLOUDINARY_API_SECRET;
  if (!cloudName || !apiKey || !apiSecret) {
    throw new Error('Cloudinary configuration is incomplete. Please check your environment variables.');
  }
  cloudinary.config({ cloud_name: cloudName, api_key: apiKey, api_secret: apiSecret });
  logger.info('✅ Cloudinary configured successfully', { cloud_name: cloudName });
}

export const cloudinaryInstance = cloudinary;

export const createCloudinaryStorage = (folder, allowedFormats, options = {}) => {
  const { 
    maxWidth = 1920, 
    maxHeight = 1080, 
    quality = 'auto:good',
    resourceType = 'auto'
  } = options;

  const transformation = [
    { 
      quality: quality, 
      fetch_format: 'auto',
      ...(resourceType === 'image' && {
        width: maxWidth,
        height: maxHeight,
        crop: 'limit'
      })
    }
  ];

  return new CloudinaryStorage({
    cloudinary: cloudinaryInstance,
    params: {
      folder: folder,
      allowed_formats: allowedFormats,
      resource_type: resourceType,
      transformation,
      eager: [
        { 
          quality: 'auto:low', 
          fetch_format: 'auto',
          width: 800,
          height: 600,
          crop: 'limit'
        }
      ],
      eager_async: true,
    },
  });
};

export const deleteFromCloudinary = async (publicId) => {
  try {
    logger.info('Deleting file from Cloudinary', { publicId });
    await cloudinaryInstance.uploader.destroy(publicId);
    logger.info('File deleted successfully from Cloudinary', { publicId });
    return true;
  } catch (error) {
    logger.error('Error deleting from Cloudinary:', { publicId, error: error.message });
    return false;
  }
};

export const extractPublicIdFromUrl = (url) => {
  try {
    const parts = url.split('/');
    const filenameWithExtension = parts[parts.length - 1];
    const filename = filenameWithExtension.split('.')[0];
    const folder = parts[parts.length - 2];
    return `${folder}/${filename}`;
  } catch (error) {
    logger.error('Error extracting public ID from URL:', { url, error: error.message });
    return null;
  }
};

// Test Cloudinary connection
export const testCloudinaryConnection = async () => {
  try {
    configureCloudinary();
    logger.info('Testing Cloudinary connection...');
    const result = await cloudinaryInstance.api.ping();
    if (result && result.status === 'ok') {
      logger.info('✅ Cloudinary connection successful');
      return true;
    } else {
      logger.warn('⚠️ Cloudinary connection test returned unexpected response:', result);
      return false;
    }
  } catch (error) {
    logger.error('❌ Cloudinary connection test failed:', { error: error.message });
    return false;
  }
};
