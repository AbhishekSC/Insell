// **Success response handler**
export const sendSuccessResponse = (res, statusCode, message, data = {}) => {
  return res.status(statusCode).json({
    status: "success",
    message: message,
    data: data,
  });
};

// **Error response handler**
export const sendErrorResponse = (
  res,
  statusCode,
  message,
  missingFields = {},
  errors = []
) => {
  return res.status(statusCode).json({
    status: "error",
    message: message,
    missingFields: missingFields,
    errors: errors,
  });
};
