import AppError from "./AppError.js";

export default class ServiceUnavailableError extends AppError {
  constructor(message = "Service temporarily unavailable", details = null) {
    super(message, 503, details);
    this.name = "ServiceUnavailableError";
  }
}
