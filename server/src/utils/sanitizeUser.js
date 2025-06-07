/**
 * Remove sensitive data from user object
 */
export function sanitizeUserData(user) {
  if (!user) return null;

  const userData = user.toObject ? user.toObject() : { ...user };

  // Remove sensitive fields
  delete userData.password;
  delete userData.__v; // Mongoose version key

  return userData;
}
