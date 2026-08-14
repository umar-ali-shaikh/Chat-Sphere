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

// Mirrors backend/src/validations/auth.validation.ts registerSchema so
// invalid submissions are caught client-side before hitting the API.
const schema = z
  .object({
    name: z.string().trim().min(2, "Tell us your name").max(50, "Name is too long"),
    email: z.string().trim().toLowerCase().email("Enter a valid email address"),
    password: z
      .string()
      .min(8, "Use at least 8 characters")
      .max(100, "Password is too long")
      .regex(/[A-Z]/, "Add an uppercase letter")
      .regex(/[a-z]/, "Add a lowercase letter")
      .regex(/[0-9]/, "Add a number")
      .regex(/[!@#$%^&*(),.?":{}|<>]/, "Add a special character"),
    confirm: z.string(),
  })
  .refine((v) => v.password === v.confirm, {
    message: "Passwords don't match",
    path: ["confirm"],
  });
type Values = z.infer<typeof schema>;

export const Route = createFileRoute("/register")({
  beforeLoad: async () => {
    const { user } = await fetchServerUser();
    if (user) {
      throw redirect({ to: "/chat" });
    }
  },
  head: () => ({
    meta: [
      { title: "Create your account — ChatSphere" },
      { name: "description", content: "Create a ChatSphere account and start realtime conversations with presence, typing and receipts." },
      { property: "og:title", content: "Create your account — ChatSphere" },
      { property: "og:description", content: "Start realtime conversations with presence, typing and receipts." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: RegisterPage,
});

function RegisterPage() {
  const { register: registerUser, registerPending, status } = useAuth();
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: { name: "", email: "", password: "", confirm: "" },
  });

  useEffect(() => {
    if (status === "authenticated") {
      // Full navigation, not the SPA router — see login.tsx for why.
      window.location.assign("/chat");
    }
  }, [status]);

  const onSubmit = async (values: Values) => {
    try {
      await registerUser({ name: values.name, email: values.email, password: values.password });
      toast.success("Account created");
      window.location.assign("/chat");
    } catch (error) {
      toast.error(apiErrorMessage(error, "Couldn't create your account. Please try again."));
    }
  };

  return (
    <AuthShell
      title="Create your account"
      subtitle="Two minutes to set up, then you're talking."
      footer={
        <>
          Already have an account?{" "}
          <Link to="/login" className="font-medium text-primary hover:underline">
            Sign in
          </Link>
        </>
      }
    >
      <form noValidate onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="name">Full name</Label>
          <Input id="name" autoComplete="name" placeholder="Aria Chen" {...register("name")} aria-invalid={!!errors.name} />
          {errors.name ? <p className="text-xs text-destructive">{errors.name.message}</p> : null}
        </div>
        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
          <Input id="email" type="email" autoComplete="email" placeholder="you@company.com" {...register("email")} aria-invalid={!!errors.email} />
          {errors.email ? <p className="text-xs text-destructive">{errors.email.message}</p> : null}
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <Input id="password" type="password" autoComplete="new-password" {...register("password")} aria-invalid={!!errors.password} />
            {errors.password ? (
              <p className="text-xs text-destructive">{errors.password.message}</p>
            ) : (
              <p className="text-xs text-muted-foreground">8+ chars, upper, lower, number, symbol</p>
            )}
          </div>
          <div className="space-y-2">
            <Label htmlFor="confirm">Confirm</Label>
            <Input id="confirm" type="password" autoComplete="new-password" {...register("confirm")} aria-invalid={!!errors.confirm} />
            {errors.confirm ? <p className="text-xs text-destructive">{errors.confirm.message}</p> : null}
          </div>
        </div>
        <Button type="submit" className="w-full rounded-2xl" size="lg" disabled={registerPending}>
          {registerPending ? "Creating account…" : "Create account"}
        </Button>
      </form>
    </AuthShell>
  );
}