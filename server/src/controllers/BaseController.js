import { asyncHandler } from "../core/asyncHandler.js";

export default class BaseController {
  wrap(handler) {
    return asyncHandler(handler.bind(this));
  }
}
