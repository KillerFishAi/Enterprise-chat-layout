"use client";

import React from "react"

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { MessageSquare, Eye, EyeOff, Smartphone, Mail, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

type LoginMethod = "account" | "phone" | "email";

export default function LoginPage() {
  const router = useRouter();
  const [loginMethod, setLoginMethod] = useState<LoginMethod>("account");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  
  const [formData, setFormData] = useState({
    account: "",
    phone: "",
    email: "",
    password: "",
    verifyCode: "",
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      if (loginMethod === "account") {
        const res = await fetch("/api/auth/login", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          credentials: "include", // 确保接受并携带 Cookie（登录后跳转依赖此）
          body: JSON.stringify({
            account: formData.account,
            password: formData.password,
          }),
        });

        if (!res.ok) {
          const data = (await res.json().catch(() => null)) as { error?: string } | null;
          throw new Error(data?.error ?? "登录失败");
        }

        // 使用整页跳转，确保浏览器在下一次请求时带上刚设置的 Cookie（client 路由有时不会带新 Cookie）
        window.location.href = "/";
        return;
      }

      // 手机号 / 邮箱登录当前仍为模拟逻辑
      await new Promise((resolve) => setTimeout(resolve, 1000));
      router.push("/");
    } catch (err) {
      console.error(err);
      // 简单提示，实际可以用全局 toast 组件
      alert((err as Error).message || "登录失败，请稍后重试");
    } finally {
      setIsLoading(false);
    }
  };

  const handleSendCode = () => {
    // Simulate sending verification code
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="w-full max-w-md">
        {/* Logo and Title */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-primary mb-4">
            <MessageSquare className="h-8 w-8 text-primary-foreground" />
          </div>
          <h1 className="text-2xl font-bold text-foreground">企业通讯</h1>
          <p className="text-muted-foreground mt-2">登录您的账号</p>
        </div>

        {/* Login Card */}
        <div className="bg-card rounded-xl border border-border p-6 shadow-sm">
          {/* Login Method Tabs */}
          <div className="flex gap-1 p-1 bg-muted rounded-lg mb-6">
            <button
              type="button"
              onClick={() => setLoginMethod("account")}
              className={cn(
                "flex-1 flex items-center justify-center gap-1.5 py-2 text-sm font-medium rounded-md transition-colors",
                loginMethod === "account"
                  ? "bg-card text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <User className="h-4 w-4" />
              <span>账号</span>
            </button>
            <button
              type="button"
              onClick={() => setLoginMethod("phone")}
              className={cn(
                "flex-1 flex items-center justify-center gap-1.5 py-2 text-sm font-medium rounded-md transition-colors",
                loginMethod === "phone"
                  ? "bg-card text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <Smartphone className="h-4 w-4" />
              <span>手机号</span>
            </button>
            <button
              type="button"
              onClick={() => setLoginMethod("email")}
              className={cn(
                "flex-1 flex items-center justify-center gap-1.5 py-2 text-sm font-medium rounded-md transition-colors",
                loginMethod === "email"
                  ? "bg-card text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <Mail className="h-4 w-4" />
              <span>邮箱</span>
            </button>
          </div>

          {/* Login Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Account Login */}
            {loginMethod === "account" && (
              <>
                <div className="space-y-2">
                  <Label htmlFor="account">账号</Label>
                  <Input
                    id="account"
                    autoComplete="username"
                    placeholder="请输入账号"
                    value={formData.account}
                    onChange={(e) => setFormData({ ...formData, account: e.target.value })}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="password">密码</Label>
                  <div className="relative">
                    <Input
                      id="password"
                      type={showPassword ? "text" : "password"}
                      autoComplete="current-password"
                      placeholder="请输入密码"
                      value={formData.password}
                      onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>
              </>
            )}

            {/* Phone Login */}
            {loginMethod === "phone" && (
              <>
                <div className="space-y-2">
                  <Label htmlFor="phone">手机号</Label>
                  <Input
                    id="phone"
                    type="tel"
                    placeholder="请输入手机号"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="verifyCode">验证码</Label>
                  <div className="flex gap-2">
                    <Input
                      id="verifyCode"
                      placeholder="请输入验证码"
                      value={formData.verifyCode}
                      onChange={(e) => setFormData({ ...formData, verifyCode: e.target.value })}
                      required
                    />
                    <Button
                      type="button"
                      variant="outline"
                      onClick={handleSendCode}
                      className="shrink-0 w-28 bg-transparent"
                    >
                      获取验证码
                    </Button>
                  </div>
                </div>
              </>
            )}

            {/* Email Login */}
            {loginMethod === "email" && (
              <>
                <div className="space-y-2">
                  <Label htmlFor="email">邮箱</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="请输入邮箱地址"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="emailVerifyCode">验证码</Label>
                  <div className="flex gap-2">
                    <Input
                      id="emailVerifyCode"
                      placeholder="请输入验证码"
                      value={formData.verifyCode}
                      onChange={(e) => setFormData({ ...formData, verifyCode: e.target.value })}
                      required
                    />
                    <Button
                      type="button"
                      variant="outline"
                      onClick={handleSendCode}
                      className="shrink-0 w-28 bg-transparent"
                    >
                      获取验证码
                    </Button>
                  </div>
                </div>
              </>
            )}

            {/* Forgot Password */}
            {loginMethod === "account" && (
              <div className="text-right">
                <Link href="/forgot-password" className="text-sm text-primary hover:underline">
                  忘记密码？
                </Link>
              </div>
            )}

            {/* Submit Button */}
            <Button
              type="submit"
              className="w-full bg-primary hover:bg-primary/90"
              disabled={isLoading}
            >
              {isLoading ? "登录中..." : "登录"}
            </Button>
          </form>

          {/* Register Link */}
          <div className="mt-6 text-center text-sm">
            <span className="text-muted-foreground">还没有账号？</span>
            <Link href="/register" className="text-primary hover:underline ml-1">
              立即注册
            </Link>
          </div>
        </div>

        {/* Footer */}
        <p className="text-center text-xs text-muted-foreground mt-6">
          登录即表示您同意我们的
          <Link href="/terms" className="text-primary hover:underline mx-1">服务条款</Link>
          和
          <Link href="/privacy" className="text-primary hover:underline mx-1">隐私政策</Link>
        </p>
      </div>
    </div>
  );
}
