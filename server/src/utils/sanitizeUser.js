/**
 * Remove sensitive data from user object
 */
export function sanitizeUserData(user) {
  if (!user) return null;

  const userData = user.toObject ? user.toObject() : { ...user };

  // Remove sensitive fields
  delete userData.password;
  delete userData.__v; // Mongoose version key
  delete userData.verificationCode;
  delete userData.verificationCodeExpires;

  // Ensure _id is preserved
  if (user._id) {
    userData._id = user._id;
  }

  // Ensure isVerified is included (default to false if undefined)
  if (userData.isVerified === undefined) {
    userData.isVerified = false;
  }

  // Normalize workLocation: only clear if both coordinates and label are missing/empty
  if (userData.workLocation) {
    const hasCoords = Number.isFinite(Number(userData.workLocation.latitude)) && Number.isFinite(Number(userData.workLocation.longitude));
    const hasLabel = Boolean(userData.workLocation.label && String(userData.workLocation.label).trim());
    if (!hasCoords && !hasLabel) {
      userData.workLocation = null;
    }
  }

  return userData;
}
