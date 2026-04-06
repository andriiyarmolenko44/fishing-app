const { AppError } = require("../utils/AppError");
const { ErrorCode } = require("../utils/errorCodes");

function errorHandler(err, req, res, next) {
  const requestId = req.requestId;

  if (err && err.code === "P2002") {
    return res.status(409).json({
      error: {
        code: ErrorCode.CONFLICT,
        message: "Resource already exists",
        details: err.meta || null,
        requestId,
      },
    });
  }

  if (err instanceof AppError) {
    return res.status(err.status).json({
      error: {
        code: err.code,
        message: err.message,
        details: err.details,
        requestId,
      },
    });
  }

  console.error(err);
  return res.status(500).json({
    error: {
      code: ErrorCode.INTERNAL_ERROR,
      message: "Server error",
      details: null,
      requestId,
    },
  });
}

module.exports = { errorHandler };
