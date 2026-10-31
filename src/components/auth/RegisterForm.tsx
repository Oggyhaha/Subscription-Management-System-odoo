"use client";

import * as React from "react";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { registerSchema, RegisterInput } from "@/schemas/auth";
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
import { AlertCircle, CheckCircle2, Loader2, Check, X } from "lucide-react";
import { cn } from "@/lib/utils";

export interface RegisterFormProps {
  onSubmitAction?: (values: RegisterInput) => Promise<{ success: boolean; error?: string }>;
}

export function RegisterForm({ onSubmitAction }: RegisterFormProps) {
  const [isLoading, setIsLoading] = React.useState(false);
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null);
  const [successMessage, setSuccessMessage] = React.useState<string | null>(null);

  const form = useForm<RegisterInput>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      name: "",
      email: "",
      password: "",
      confirmPassword: "",
    },
    mode: "onChange",
  });

  const passwordValue = form.watch("password") || "";

  const passwordChecks = [
    { label: "More than 8 characters", valid: passwordValue.length > 8 },
    { label: "At least one uppercase letter", valid: /[A-Z]/.test(passwordValue) },
    { label: "At least one lowercase letter", valid: /[a-z]/.test(passwordValue) },
    { label: "At least one special character", valid: /[^A-Za-z0-9]/.test(passwordValue) },
  ];

  const handleSubmit = async (values: RegisterInput) => {
    setIsLoading(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      if (onSubmitAction) {
        // TODO(dev-a): Wire customer registration server action in Hour 2
        const res = await onSubmitAction(values);
        if (!res.success) {
          setErrorMessage(res.error || "Registration failed. Please check your details.");
        } else {
          setSuccessMessage("Account created successfully! You can now log in.");
        }
      } else {
        // Static simulation before server action is attached by Dev A
        await new Promise((resolve) => setTimeout(resolve, 800));
        setSuccessMessage("Registration validated. Dev A will attach Prisma user creation in Hour 2.");
      }
    } catch (err: unknown) {
      setErrorMessage(err instanceof Error ? err.message : "An unexpected registration error occurred.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card className="border-rule shadow-sm">
      <CardHeader className="space-y-1 pb-4">
        <CardTitle className="text-xl font-bold">Create account</CardTitle>
        <CardDescription>
          Sign up for a Brightloop customer account to manage subscriptions and invoices
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

        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Full name</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="Jane Doe"
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
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Email address</FormLabel>
                  <FormControl>
                    <Input
                      type="email"
                      placeholder="jane@company.com"
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
                  <FormLabel>Password</FormLabel>
                  <FormControl>
                    <Input
                      type="password"
                      placeholder="••••••••••••"
                      autoComplete="new-password"
                      disabled={isLoading}
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Live Password Requirements Checklist */}
            <div className="rounded-md bg-paper-3 p-3 text-xs space-y-1.5 border border-rule">
              <span className="font-medium text-foreground block mb-1">
                Password requirements:
              </span>
              {passwordChecks.map((check, i) => (
                <div
                  key={i}
                  className={cn(
                    "flex items-center gap-2",
                    check.valid
                      ? "text-emerald-600 dark:text-emerald-400"
                      : "text-muted-foreground"
                  )}
                >
                  {check.valid ? (
                    <Check className="h-3.5 w-3.5 shrink-0" />
                  ) : (
                    <X className="h-3.5 w-3.5 shrink-0 opacity-40" />
                  )}
                  <span>{check.label}</span>
                </div>
              ))}
            </div>

            <FormField
              control={form.control}
              name="confirmPassword"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Confirm password</FormLabel>
                  <FormControl>
                    <Input
                      type="password"
                      placeholder="••••••••••••"
                      autoComplete="new-password"
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
              {isLoading ? "Creating account..." : "Create customer account"}
            </Button>
          </form>
        </Form>

        <div className="mt-6 text-center text-xs text-muted-foreground">
          Already have an account?{" "}
          <Link
            href="/login"
            className="font-medium text-primary underline-offset-4 hover:underline"
          >
            Sign in
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}
