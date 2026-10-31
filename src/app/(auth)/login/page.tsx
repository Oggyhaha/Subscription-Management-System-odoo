import { LoginForm } from "@/components/auth/LoginForm";
import { loginAction } from "@/server/actions/auth";

export const metadata = {
  title: "Sign in — Brightloop Software",
};

export default function LoginPage() {
  return <LoginForm onSubmitAction={loginAction} />;
}
