import type { NextRequest } from "next/server";
import jwt from "jsonwebtoken";

type JwtPayload = {
  userId: string;
};

const JWT_SECRET = process.env.JWT_SECRET || "DEV_SECRET_CHANGE_ME";

export function signAuthToken(userId: string) {
  return jwt.sign({ userId } satisfies JwtPayload, JWT_SECRET, {
    expiresIn: "7d",
  });
}

export function verifyAuthToken(token: string) {
  try {
    return jwt.verify(token, JWT_SECRET) as JwtPayload;
  } catch {
    return null;
  }
}

export function getAuthTokenFromRequest(req: NextRequest) {
  const cookie = req.cookies.get("token");
  return cookie?.value ?? null;
}
