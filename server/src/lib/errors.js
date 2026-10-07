export class AppError extends Error {
  constructor(status, code, message, details) {
    super(message);
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export const asyncHandler = (handler) => (req, res, next) =>
  Promise.resolve(handler(req, res, next)).catch(next);

export function notFound(req, _res, next) {
  next(
    new AppError(
      404,
      "NOT_FOUND",
      `Route ${req.method} ${req.originalUrl} not found`
    )
  );
}

export function errorHandler(error, req, res, next) {
  void next;
  req.log?.error({ err: error }, "request failed");
  if (error?.name === "ZodError") {
    return res.status(400).json({
      error: {
        code: "VALIDATION_ERROR",
        message: "Request validation failed",
        details: error.issues,
      },
    });
  }
  if (error?.name === "MulterError") {
    return res
      .status(400)
      .json({ error: { code: "UPLOAD_ERROR", message: error.message } });
  }
  if (error instanceof AppError) {
    return res.status(error.status).json({
      error: {
        code: error.code,
        message: error.message,
        details: error.details,
      },
    });
  }
  if (error?.code === "23505") {
    return res.status(409).json({
      error: { code: "CONFLICT", message: "Resource already exists" },
    });
  }
  return res.status(500).json({
    error: { code: "INTERNAL_ERROR", message: "Unexpected server error" },
  });
}
