class ApiError extends Error {
  statusCode: number;
  success: boolean;
  errors: any[];

  constructor(
    statusCode: number,
    message: string = "Something went wrong",
    errors: any[] = [],
    stack?: string,
  ) {
    super(message);

    this.statusCode = statusCode;
    this.success = false;
    this.errors = errors;

    if (stack) {
      this.stack = stack;
    } else {
      Error.captureStackTrace(this, this.constructor);
    }
  }

  // 400 Bad Request
  static badRequest(message: string = "Bad Request", errors: any[] = []) {
    return new ApiError(400, message, errors);
  }

  // 401 Unauthorized
  static unauthorized(message: string = "Unauthorized") {
    return new ApiError(401, message);
  }

  // 403 Forbidden
  static forbidden(message: string = "Forbidden") {
    return new ApiError(403, message);
  }

  // 404 Not Found
  static notFound(message: string = "Not Found") {
    return new ApiError(404, message);
  }

  // 409 Conflict
  static conflict(message: string = "Conflict") {
    return new ApiError(409, message);
  }

  // 422 Unprocessable Entity
  static unprocessableEntity(
    message: string = "Validation Failed",
    errors: any[] = [],
  ) {
    return new ApiError(422, message, errors);
  }

  // 429 Too Many Requests
  static tooManyRequests(message: string = "Too Many Requests") {
    return new ApiError(429, message);
  }

  // 500 Internal Server Error
  static internal(message: string = "Internal Server Error") {
    return new ApiError(500, message);
  }

  // 503 Service Unavailable
  static serviceUnavailable(message: string = "Service Unavailable") {
    return new ApiError(503, message);
  }
}

export default ApiError;
