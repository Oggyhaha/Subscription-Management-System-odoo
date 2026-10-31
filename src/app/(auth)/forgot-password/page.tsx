import { ForgotPasswordForm } from "@/components/auth/ForgotPasswordForm";
import { forgotPasswordAction } from "@/server/actions/auth";

export const metadata = {
  title: "Forgot password — Brightloop Software",
};

export default function ForgotPasswordPage() {
  return <ForgotPasswordForm onSubmitAction={forgotPasswordAction} />;
}
