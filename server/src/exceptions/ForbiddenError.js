import AppError from "./AppError.js";

export default class ForbiddenError extends AppError {
  constructor(message = "Access denied", details = null) {
    super(message, 403, details);
    this.name = "ForbiddenError";
  }
}
