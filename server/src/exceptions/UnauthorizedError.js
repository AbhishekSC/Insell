import AppError from "./AppError.js";

export default class UnauthorizedError extends AppError {
  constructor(message = "Unauthorized", details = null) {
    super(message, 401, details);
    this.name = "UnauthorizedError";
  }
}
