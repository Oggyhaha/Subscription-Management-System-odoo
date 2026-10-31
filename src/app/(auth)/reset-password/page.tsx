import * as React from "react";
import { ResetPasswordForm } from "@/components/auth/ResetPasswordForm";
import { resetPasswordAction } from "@/server/actions/auth";

export const metadata = {
  title: "Set new password — Brightloop Software",
};

export default function ResetPasswordPage() {
  return (
    <React.Suspense fallback={<div className="h-48 flex items-center justify-center text-xs text-muted-foreground">Loading form...</div>}>
      <ResetPasswordForm onSubmitAction={resetPasswordAction} />
    </React.Suspense>
  );
}
