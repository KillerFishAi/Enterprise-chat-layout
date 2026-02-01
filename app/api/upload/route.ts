import { NextRequest, NextResponse } from "next/server";
import { writeFile, mkdir, access } from "fs/promises";
import path from "path";
import { getAuthTokenFromRequest, verifyAuthToken } from "@/lib/auth";

/**
 * 格式化文件大小
 * @param bytes 文件字节数
 * @returns 格式化后的字符串，如 "1.5MB"
 */
function formatFileSize(bytes: number): string {
  if (bytes === 0) return "0B";

  const units = ["B", "KB", "MB", "GB", "TB"];
  const k = 1024;
  const i = Math.floor(Math.log(bytes) / Math.log(k));

  // 保留两位小数，去掉末尾的0
  const size = (bytes / Math.pow(k, i)).toFixed(2).replace(/\.?0+$/, "");
  return `${size}${units[i]}`;
}

/**
 * 确保上传目录存在
 */
async function ensureUploadDir(uploadDir: string): Promise<void> {
  try {
    await access(uploadDir);
  } catch {
    // 目录不存在，创建它
    await mkdir(uploadDir, { recursive: true });
  }
}

/**
 * 生成唯一文件名
 * @param originalName 原文件名
 * @returns 唯一文件名
 */
function generateUniqueFileName(originalName: string): string {
  const timestamp = Date.now();
  const random = Math.round(Math.random() * 1e9);
  const ext = path.extname(originalName);
  const baseName = path.basename(originalName, ext);
  
  // 清理文件名中的特殊字符
  const cleanBaseName = baseName.replace(/[^a-zA-Z0-9_\u4e00-\u9fa5-]/g, "_");
  
  return `${timestamp}-${random}-${cleanBaseName}${ext}`;
}

export async function POST(request: NextRequest) {
  try {
    // 1. 鉴权
    const token = getAuthTokenFromRequest(request);
    if (!token) {
      return NextResponse.json(
        { error: "未登录，请先登录" },
        { status: 401 }
      );
    }

    const payload = verifyAuthToken(token);
    if (!payload) {
      return NextResponse.json(
        { error: "登录已过期，请重新登录" },
        { status: 401 }
      );
    }

    // 2. 解析 multipart/form-data
    const formData = await request.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json(
        { error: "请选择要上传的文件" },
        { status: 400 }
      );
    }

    // 3. 文件类型和大小验证（可选，根据需要调整）
    const maxSize = 50 * 1024 * 1024; // 50MB
    if (file.size > maxSize) {
      return NextResponse.json(
        { error: "文件大小不能超过50MB" },
        { status: 400 }
      );
    }

    // 4. 确保上传目录存在
    const uploadDir = path.join(process.cwd(), "public", "uploads");
    await ensureUploadDir(uploadDir);

    // 5. 生成唯一文件名并保存文件
    const uniqueFileName = generateUniqueFileName(file.name);
    const filePath = path.join(uploadDir, uniqueFileName);

    // 将 File 转换为 Buffer 并写入
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    await writeFile(filePath, buffer);

    // 6. 返回结果
    return NextResponse.json({
      url: `/uploads/${uniqueFileName}`,
      name: file.name,
      size: formatFileSize(file.size),
    });
  } catch (error) {
    console.error("文件上传失败:", error);
    return NextResponse.json(
      { error: "文件上传失败，请稍后重试" },
      { status: 500 }
    );
  }
}
