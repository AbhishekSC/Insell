import AppError from "./AppError.js";

export default class ConflictError extends AppError {
  constructor(message = "Resource conflict", details = null) {
    super(message, 409, details);
    this.name = "ConflictError";
  }
}
