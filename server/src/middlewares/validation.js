import { validationResult } from "express-validator";
import ValidationError from "../exceptions/ValidationError.js";

export function validateRequest(req, _res, next) {
  const result = validationResult(req);
  if (result.isEmpty()) {
    return next();
  }

  const details = result.array({ onlyFirstError: true }).map((error) => ({
    field: error.path,
    message: error.msg,
  }));

  return next(new ValidationError("Request validation failed", details));
}
