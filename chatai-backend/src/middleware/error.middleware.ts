import { Request, Response, NextFunction } from 'express';

export class AppError extends Error {
  constructor(public message: string, public statusCode: number = 500) {
    super(message);
    Object.setPrototypeOf(this, AppError.prototype);
  }
}

export const errorHandler = (err: any, req: Request, res: Response, next: NextFunction) => {
  const statusCode = err instanceof AppError ? err.statusCode : 500;
  const message = err.message || 'Something went wrong';

  console.error(`[Global Error] ${req.method} ${req.path}`, {
    message,
    stack: process.env.NODE_ENV === 'development' ? err.stack : undefined,
    tenantId: (req as any).tenantId
  });

  res.status(statusCode).json({
    success: false,
    error: message,
    code: statusCode,
    timestamp: new Date().toISOString()
  });
};
