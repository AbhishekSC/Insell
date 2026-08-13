import crypto from 'crypto';
import { logger } from '../utils/logger.js';

const OTP_LENGTH = 6;
const OTP_EXPIRY_MINUTES = 10;

/**
 * Generate a random OTP
 * @returns {string} - 6-digit OTP
 */
export function generateOTP() {
  const otp = crypto.randomInt(0, 1000000).toString().padStart(OTP_LENGTH, '0');
  return otp;
}

/**
 * Calculate OTP expiry time
 * @returns {Date} - Expiry date
 */
export function getOTPExpiry() {
  const expiry = new Date();
  expiry.setMinutes(expiry.getMinutes() + OTP_EXPIRY_MINUTES);
  return expiry;
}

/**
 * Verify if OTP is valid and not expired
 * @param {string} storedOTP - The OTP stored in database
 * @param {string} providedOTP - The OTP provided by user
 * @param {Date} expiryDate - The expiry date of the OTP
 * @returns {boolean} - True if OTP is valid
 */
export function verifyOTP(storedOTP, providedOTP, expiryDate) {
  if (!storedOTP || !providedOTP || !expiryDate) {
    logger.warn('OTP verification failed: Missing required fields');
    return false;
  }

  if (storedOTP !== providedOTP) {
    logger.warn('OTP verification failed: Invalid OTP');
    return false;
  }

  if (new Date() > expiryDate) {
    logger.warn('OTP verification failed: OTP expired');
    return false;
  }

  return true;
}

/**
 * Generate OTP and expiry for password reset
 * @returns {Object} - { otp, expiry }
 */
export function generateResetOTP() {
  const otp = generateOTP();
  const expiry = getOTPExpiry();
  logger.info(`Generated reset OTP, expires at ${expiry}`);
  return { otp, expiry };
}
