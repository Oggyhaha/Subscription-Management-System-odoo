"use client";

import * as React from "react";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { loginSchema, LoginInput } from "@/schemas/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertCircle, CheckCircle2, Loader2, Sparkles } from "lucide-react";
import { demoLoginAction } from "@/server/actions/auth";

export interface LoginFormProps {
  onSubmitAction?: (values: LoginInput) => Promise<{ success: boolean; error?: string }>;
}

export function LoginForm({ onSubmitAction }: LoginFormProps) {
  const [isLoading, setIsLoading] = React.useState(false);
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null);
  const [successMessage, setSuccessMessage] = React.useState<string | null>(null);

  const form = useForm<LoginInput>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: "",
      password: "",
    },
  });

  const handleSubmit = async (values: LoginInput) => {
    setIsLoading(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      if (onSubmitAction) {
        const res = await onSubmitAction(values);
        if (!res.success) {
          setErrorMessage(res.error || "Authentication failed. Please verify your credentials.");
        } else {
          setSuccessMessage("Sign in successful. Redirecting to workspace...");
          const redirect = (res as { redirectUrl?: string }).redirectUrl || "/customer";
          window.location.href = redirect;
        }
      } else {
        await new Promise((resolve) => setTimeout(resolve, 800));
        setSuccessMessage("Credentials validated. Redirecting...");
      }
    } catch (err: unknown) {
      setErrorMessage(err instanceof Error ? err.message : "An unexpected authentication error occurred.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleQuickDemo = async (role: "ADMIN" | "STAFF" | "CUSTOMER") => {
    setIsLoading(true);
    setErrorMessage(null);
    setSuccessMessage(`Authenticating as demo ${role.toLowerCase()}...`);

    try {
      const res = await demoLoginAction(role);
      if (res.success && res.redirectUrl) {
        window.location.href = res.redirectUrl;
      } else {
        setErrorMessage(res.error || "Demo login failed");
        setSuccessMessage(null);
        setIsLoading(false);
      }
    } catch (err: unknown) {
      setErrorMessage(err instanceof Error ? err.message : "Demo authentication error");
      setSuccessMessage(null);
      setIsLoading(false);
    }
  };

  return (
    <Card className="border-rule shadow-sm">
      <CardHeader className="space-y-1 pb-4">
        <CardTitle className="text-xl font-bold">Sign in</CardTitle>
        <CardDescription>
          Enter your email and password to access your Brightloop account
        </CardDescription>
      </CardHeader>
      <CardContent>
        {errorMessage && (
          <div className="mb-4 flex items-center gap-2 rounded-md border border-destructive/20 bg-destructive/10 p-3 text-xs text-destructive">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}

        {successMessage && (
          <div className="mb-4 flex items-center gap-2 rounded-md border border-emerald-500/20 bg-emerald-500/10 p-3 text-xs text-emerald-700 dark:text-emerald-400">
            <CheckCircle2 className="h-4 w-4 shrink-0" />
            <span>{successMessage}</span>
          </div>
        )}

        {/* 1-Click Demo Quick Pickers */}
        <div className="mb-5 rounded-md border border-rule bg-paper-3/60 p-3">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-foreground mb-2">
            <Sparkles className="h-3.5 w-3.5 text-primary" />
            1-Click Demo Sign-In
          </div>
          <div className="grid grid-cols-3 gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={isLoading}
              onClick={() => handleQuickDemo("ADMIN")}
              className="text-[11px] h-8 px-2 font-medium bg-card"
            >
              Admin
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={isLoading}
              onClick={() => handleQuickDemo("STAFF")}
              className="text-[11px] h-8 px-2 font-medium bg-card"
            >
              Staff
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={isLoading}
              onClick={() => handleQuickDemo("CUSTOMER")}
              className="text-[11px] h-8 px-2 font-medium bg-card"
            >
              Customer
            </Button>
          </div>
        </div>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Email</FormLabel>
                  <FormControl>
                    <Input
                      type="email"
                      placeholder="alex@brightloop.local"
                      autoComplete="email"
                      disabled={isLoading}
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="password"
              render={({ field }) => (
                <FormItem>
                  <div className="flex items-center justify-between">
                    <FormLabel>Password</FormLabel>
                    <Link
                      href="/forgot-password"
                      className="text-xs text-primary underline-offset-4 hover:underline"
                    >
                      Forgot password?
                    </Link>
                  </div>
                  <FormControl>
                    <Input
                      type="password"
                      placeholder="••••••••••••"
                      autoComplete="current-password"
                      disabled={isLoading}
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <Button
              type="submit"
              className="w-full font-medium"
              disabled={isLoading}
            >
              {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {isLoading ? "Signing in..." : "Sign in to account"}
            </Button>
          </form>
        </Form>

        <div className="mt-6 text-center text-xs text-muted-foreground">
          Don&apos;t have an account?{" "}
          <Link
            href="/register"
            className="font-medium text-primary underline-offset-4 hover:underline"
          >
            Create customer account
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}
