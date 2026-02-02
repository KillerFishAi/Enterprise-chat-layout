import type { NextRequest } from "next/server";
import jwt from "jsonwebtoken";

type JwtPayload = {
  userId: string;
};

const JWT_SECRET = process.env.JWT_SECRET;
const DEV_SECRET = "DEV_SECRET_DO_NOT_USE_IN_PRODUCTION";

function getSecret(): string {
  if (process.env.NODE_ENV === "production" && !JWT_SECRET) {
    throw new Error("生产环境必须设置 JWT_SECRET 环境变量");
  }
  if (!JWT_SECRET && process.env.NODE_ENV !== "production") {
    console.warn("[auth] JWT_SECRET 未设置，使用开发环境默认值，请勿在生产环境使用");
  }
  return JWT_SECRET || DEV_SECRET;
}

export function signAuthToken(userId: string) {
  return jwt.sign({ userId } satisfies JwtPayload, getSecret(), {
    expiresIn: "7d",
    algorithm: "HS256",
  });
}

export function verifyAuthToken(token: string) {
  try {
    return jwt.verify(token, getSecret()) as JwtPayload;
  } catch {
    return null;
  }
}

export function getAuthTokenFromRequest(req: NextRequest) {
  const cookie = req.cookies.get("token");
  return cookie?.value ?? null;
}
