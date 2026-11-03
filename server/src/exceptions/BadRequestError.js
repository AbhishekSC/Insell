import AppError from "./AppError.js";

export default class BadRequestError extends AppError {
  constructor(message = "Bad request", details = null) {
    super(message, 400, details);
    this.name = "BadRequestError";
  }
}
