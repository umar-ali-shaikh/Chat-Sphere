import { Request } from "express";

declare global {
  namespace Express {
    interface UserPayload {
      id: string;
      name: string;
      email: string;
    }

    interface Request {
      user?: UserPayload;
    }
  }
}

export interface AuthenticatedRequest extends Request {
  user: Express.UserPayload;
}

export {};