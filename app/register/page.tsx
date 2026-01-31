"use client";

import React from "react"

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { MessageSquare, Eye, EyeOff, Smartphone, Mail, User, ArrowLeft, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

type RegisterMethod = "account" | "phone" | "email";

export default function RegisterPage() {
  const router = useRouter();
  const [registerMethod, setRegisterMethod] = useState<RegisterMethod>("phone");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [step, setStep] = useState<"form" | "success">("form");
  
  const [formData, setFormData] = useState({
    account: "",
    phone: "",
    email: "",
    password: "",
    confirmPassword: "",
    verifyCode: "",
    nickname: "",
  });

  const [errors, setErrors] = useState<Record<string, string>>({});

  const validateForm = () => {
    const newErrors: Record<string, string> = {};

    if (registerMethod === "account") {
      if (!formData.account || formData.account.length < 4) {
        newErrors.account = "账号至少4个字符";
      }
      if (!/^[a-zA-Z0-9_]+$/.test(formData.account)) {
        newErrors.account = "账号只能包含字母、数字和下划线";
      }
    }

    if (registerMethod === "phone") {
      if (!formData.phone || !/^1[3-9]\d{9}$/.test(formData.phone)) {
        newErrors.phone = "请输入有效的手机号";
      }
    }

    if (registerMethod === "email") {
      if (!formData.email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
        newErrors.email = "请输入有效的邮箱地址";
      }
    }

    if (!formData.nickname || formData.nickname.length < 2) {
      newErrors.nickname = "昵称至少2个字符";
    }

    if (!formData.password || formData.password.length < 6) {
      newErrors.password = "密码至少6个字符";
    }

    if (formData.password !== formData.confirmPassword) {
      newErrors.confirmPassword = "两次密码输入不一致";
    }

    if ((registerMethod === "phone" || registerMethod === "email") && !formData.verifyCode) {
      newErrors.verifyCode = "请输入验证码";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) return;

    setIsLoading(true);
    setErrors({});

    try {
      const payload: {
        account?: string;
        phone?: string;
        email?: string;
        password: string;
        nickname: string;
      } = {
        password: formData.password,
        nickname: formData.nickname,
      };

      if (registerMethod === "account") {
        payload.account = formData.account;
      } else if (registerMethod === "phone") {
        payload.phone = formData.phone;
      } else if (registerMethod === "email") {
        payload.email = formData.email;
      }

      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as { error?: string } | null;
        throw new Error(data?.error ?? "注册失败");
      }

      setStep("success");
    } catch (err) {
      console.error(err);
      alert((err as Error).message || "注册失败，请稍后重试");
    } finally {
      setIsLoading(false);
    }
  };

  const handleSendCode = () => {
    // Simulate sending verification code
  };

  if (step === "success") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <div className="w-full max-w-md text-center">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-primary/10 mb-6">
            <Check className="h-10 w-10 text-primary" />
          </div>
          <h1 className="text-2xl font-bold text-foreground mb-2">注册成功</h1>
          <p className="text-muted-foreground mb-8">
            您的账号已创建成功，现在可以登录使用了
          </p>
          <Button
            onClick={() => router.push("/login")}
            className="w-full max-w-xs bg-primary hover:bg-primary/90"
          >
            前往登录
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="w-full max-w-md">
        {/* Back Button */}
        <Link
          href="/login"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-6"
        >
          <ArrowLeft className="h-4 w-4" />
          <span>返回登录</span>
        </Link>

        {/* Logo and Title */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-primary mb-4">
            <MessageSquare className="h-8 w-8 text-primary-foreground" />
          </div>
          <h1 className="text-2xl font-bold text-foreground">创建账号</h1>
          <p className="text-muted-foreground mt-2">选择您喜欢的注册方式</p>
        </div>

        {/* Register Card */}
        <div className="bg-card rounded-xl border border-border p-6 shadow-sm">
          {/* Register Method Tabs */}
          <div className="flex gap-1 p-1 bg-muted rounded-lg mb-6">
            <button
              type="button"
              onClick={() => setRegisterMethod("phone")}
              className={cn(
                "flex-1 flex items-center justify-center gap-1.5 py-2 text-sm font-medium rounded-md transition-colors",
                registerMethod === "phone"
                  ? "bg-card text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <Smartphone className="h-4 w-4" />
              <span>手机号</span>
            </button>
            <button
              type="button"
              onClick={() => setRegisterMethod("email")}
              className={cn(
                "flex-1 flex items-center justify-center gap-1.5 py-2 text-sm font-medium rounded-md transition-colors",
                registerMethod === "email"
                  ? "bg-card text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <Mail className="h-4 w-4" />
              <span>邮箱</span>
            </button>
            <button
              type="button"
              onClick={() => setRegisterMethod("account")}
              className={cn(
                "flex-1 flex items-center justify-center gap-1.5 py-2 text-sm font-medium rounded-md transition-colors",
                registerMethod === "account"
                  ? "bg-card text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <User className="h-4 w-4" />
              <span>账号</span>
            </button>
          </div>

          {/* Register Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Phone Registration */}
            {registerMethod === "phone" && (
              <div className="space-y-2">
                <Label htmlFor="phone">手机号</Label>
                <Input
                  id="phone"
                  type="tel"
                  placeholder="请输入手机号"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  className={errors.phone ? "border-destructive" : ""}
                />
                {errors.phone && <p className="text-xs text-destructive">{errors.phone}</p>}
              </div>
            )}

            {/* Email Registration */}
            {registerMethod === "email" && (
              <div className="space-y-2">
                <Label htmlFor="email">邮箱</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="请输入邮箱地址"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className={errors.email ? "border-destructive" : ""}
                />
                {errors.email && <p className="text-xs text-destructive">{errors.email}</p>}
              </div>
            )}

            {/* Account Registration */}
            {registerMethod === "account" && (
              <div className="space-y-2">
                <Label htmlFor="account">账号</Label>
                <Input
                  id="account"
                  placeholder="请设置账号（字母、数字、下划线）"
                  value={formData.account}
                  onChange={(e) => setFormData({ ...formData, account: e.target.value })}
                  className={errors.account ? "border-destructive" : ""}
                />
                {errors.account && <p className="text-xs text-destructive">{errors.account}</p>}
              </div>
            )}

            {/* Verification Code (for phone and email) */}
            {(registerMethod === "phone" || registerMethod === "email") && (
              <div className="space-y-2">
                <Label htmlFor="verifyCode">验证码</Label>
                <div className="flex gap-2">
                  <Input
                    id="verifyCode"
                    placeholder="请输入验证码"
                    value={formData.verifyCode}
                    onChange={(e) => setFormData({ ...formData, verifyCode: e.target.value })}
                    className={errors.verifyCode ? "border-destructive" : ""}
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
                {errors.verifyCode && <p className="text-xs text-destructive">{errors.verifyCode}</p>}
              </div>
            )}

            {/* Nickname */}
            <div className="space-y-2">
              <Label htmlFor="nickname">昵称</Label>
              <Input
                id="nickname"
                placeholder="请设置昵称"
                value={formData.nickname}
                onChange={(e) => setFormData({ ...formData, nickname: e.target.value })}
                className={errors.nickname ? "border-destructive" : ""}
              />
              {errors.nickname && <p className="text-xs text-destructive">{errors.nickname}</p>}
            </div>

            {/* Password */}
            <div className="space-y-2">
              <Label htmlFor="password">密码</Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  placeholder="请设置密码（至少6位）"
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  className={errors.password ? "border-destructive" : ""}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              {errors.password && <p className="text-xs text-destructive">{errors.password}</p>}
            </div>

            {/* Confirm Password */}
            <div className="space-y-2">
              <Label htmlFor="confirmPassword">确认密码</Label>
              <div className="relative">
                <Input
                  id="confirmPassword"
                  type={showConfirmPassword ? "text" : "password"}
                  placeholder="请再次输入密码"
                  value={formData.confirmPassword}
                  onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
                  className={errors.confirmPassword ? "border-destructive" : ""}
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              {errors.confirmPassword && <p className="text-xs text-destructive">{errors.confirmPassword}</p>}
            </div>

            {/* Submit Button */}
            <Button
              type="submit"
              className="w-full bg-primary hover:bg-primary/90"
              disabled={isLoading}
            >
              {isLoading ? "注册中..." : "注册"}
            </Button>
          </form>

          {/* Login Link */}
          <div className="mt-6 text-center text-sm">
            <span className="text-muted-foreground">已有账号？</span>
            <Link href="/login" className="text-primary hover:underline ml-1">
              立即登录
            </Link>
          </div>
        </div>

        {/* Footer */}
        <p className="text-center text-xs text-muted-foreground mt-6">
          注册即表示您同意我们的
          <Link href="/terms" className="text-primary hover:underline mx-1">服务条款</Link>
          和
          <Link href="/privacy" className="text-primary hover:underline mx-1">隐私政策</Link>
        </p>
      </div>
    </div>
  );
}
