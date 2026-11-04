import AppError from "./AppError.js";

export default class NotFoundError extends AppError {
  constructor(message = "Resource not found", details = null) {
    super(message, 404, details);
    this.name = "NotFoundError";
  }
}
