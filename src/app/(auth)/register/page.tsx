import { RegisterForm } from "@/components/auth/RegisterForm";
import { registerAction } from "@/server/actions/auth";

export const metadata = {
  title: "Create customer account — Brightloop Software",
};

export default function RegisterPage() {
  return <RegisterForm onSubmitAction={registerAction} />;
}
