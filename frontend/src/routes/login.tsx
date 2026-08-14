import { useEffect } from "react";
import { Link, createFileRoute, redirect } from "@tanstack/react-router";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AuthShell } from "@/components/auth/auth-shell";
import { useAuth } from "@/hooks/use-auth";
import { apiErrorMessage } from "@/lib/api-client";
import { fetchServerUser } from "@/lib/server-auth";

const schema = z.object({
  email: z.string().email("Enter a valid email address"),
  password: z.string().min(8, "Password must be at least 8 characters"),
});
type Values = z.infer<typeof schema>;

export const Route = createFileRoute("/login")({
  beforeLoad: async () => {
    const { user } = await fetchServerUser();
    if (user) {
      throw redirect({ to: "/chat" });
    }
  },
  head: () => ({
    meta: [
      { title: "Sign in — ChatSphere" },
      { name: "description", content: "Sign in to your ChatSphere workspace and pick up every conversation where you left it." },
      { property: "og:title", content: "Sign in — ChatSphere" },
      { property: "og:description", content: "Sign in to your ChatSphere workspace." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: LoginPage,
});

function LoginPage() {
  const { login, loginPending, status } = useAuth();
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<Values>({ resolver: zodResolver(schema), defaultValues: { email: "", password: "" } });

  useEffect(() => {
    if (status === "authenticated") {
      // Full navigation, not the SPA router: /chat's beforeLoad re-verifies
      // the session by forwarding the auth cookie server-side, and doing
      // that over a real top-level request is what makes it reliably see a
      // cookie that was just set a moment ago by the cross-origin login
      // call — a client-side router transition intermittently missed it.
      window.location.assign("/chat");
    }
  }, [status]);

  const onSubmit = async (values: Values) => {
    try {
      await login(values);
      toast.success("Welcome back");
      window.location.assign("/chat");
    } catch (error) {
      toast.error(apiErrorMessage(error, "Couldn't sign in. Check your details and try again."));
    }
  };

  return (
    <AuthShell
      title="Welcome back"
      subtitle="Sign in to pick up every conversation where you left it."
      footer={
        <>
          New here?{" "}
          <Link to="/register" className="font-medium text-primary hover:underline">
            Create an account
          </Link>
        </>
      }
    >
      <form noValidate onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
          <Input id="email" type="email" autoComplete="email" placeholder="you@company.com" {...register("email")} aria-invalid={!!errors.email} />
          {errors.email ? <p className="text-xs text-destructive">{errors.email.message}</p> : null}
        </div>
        <div className="space-y-2">
          <Label htmlFor="password">Password</Label>
          <Input id="password" type="password" autoComplete="current-password" placeholder="••••••••" {...register("password")} aria-invalid={!!errors.password} />
          {errors.password ? <p className="text-xs text-destructive">{errors.password.message}</p> : null}
        </div>
        <Button type="submit" className="w-full rounded-2xl" size="lg" disabled={loginPending}>
          {loginPending ? "Signing in…" : "Sign in"}
        </Button>
      </form>
    </AuthShell>
  );
}