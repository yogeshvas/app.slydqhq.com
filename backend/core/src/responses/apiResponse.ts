import express from "express";
class ApiResponse {
  statusCode: number;
  data: any;
  message: string;

  constructor(statusCode: number, data: any, message: string) {
    this.statusCode = statusCode;
    this.data = data;
    this.message = message;
  }

  static success(
    res: express.Response,
    data: any,
    message: string = "Success",
    statusCode: number = 200,
  ) {
    return res
      .status(statusCode)
      .json(new ApiResponse(statusCode, data, message));
  }

  static created(
    res: express.Response,
    data: any,
    message: string = "Resource created",
    statusCode: number = 201,
  ) {
    return res
      .status(statusCode)
      .json(new ApiResponse(statusCode, data, message));
  }
}

export default ApiResponse;
