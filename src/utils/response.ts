import { Response } from 'express';

export const sendSuccess = (res: Response, data: any, message = 'Success', statusCode = 200) => {
  return res.status(statusCode).json({
    status: 'success',
    message,
    data,
  });
};

export const sendError = (res: Response, message = 'Error', statusCode = 500, errors: any = null, code?: string) => {
  return res.status(statusCode).json({
    success: false,
    error: {
      code: code || 'INTERNAL_ERROR',
      message,
      ...(errors && { details: errors }),
    }
  });
};
