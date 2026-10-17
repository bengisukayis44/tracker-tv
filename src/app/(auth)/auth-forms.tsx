"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { loginSchema, registerSchema, type LoginInput, type RegisterInput } from "@/lib/validations/auth";
import { loginAction, registerAction } from "./actions";

function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return <p className="text-destructive text-xs font-medium">{message}</p>;
}

function FormError({ message }: { message?: string }) {
  if (!message) return null;
  return (
    <div
      role="alert"
      className="border-destructive/30 bg-destructive/10 text-destructive rounded-lg border px-3 py-2 text-sm"
    >
      {message}
    </div>
  );
}

export function LoginForm({ callbackUrl }: { callbackUrl?: string }) {
  const [pending, startTransition] = useTransition();
  const [formError, setFormError] = useState<string>();
  const form = useForm<LoginInput>({
    resolver: zodResolver(loginSchema),
    defaultValues: { identifier: "", password: "" },
  });
  const { errors } = form.formState;

  const onSubmit = form.handleSubmit((values) => {
    setFormError(undefined);
    startTransition(async () => {
      const result = await loginAction(values, callbackUrl);
      if (result?.error) setFormError(result.error);
    });
  });

  return (
    <form onSubmit={onSubmit} className="space-y-4" noValidate>
      <FormError message={formError} />
      <div className="space-y-2">
        <Label htmlFor="identifier">E-posta veya kullanıcı adı</Label>
        <Input
          id="identifier"
          autoComplete="username"
          aria-invalid={!!errors.identifier}
          {...form.register("identifier")}
        />
        <FieldError message={errors.identifier?.message} />
      </div>
      <div className="space-y-2">
        <Label htmlFor="password">Şifre</Label>
        <Input
          id="password"
          type="password"
          autoComplete="current-password"
          aria-invalid={!!errors.password}
          {...form.register("password")}
        />
        <FieldError message={errors.password?.message} />
      </div>
      <Button type="submit" className="w-full" disabled={pending}>
        {pending && <Loader2 className="animate-spin" />}
        Giriş yap
      </Button>
      <p className="text-muted-foreground text-center text-sm">
        Hesabın yok mu?{" "}
        <Link href="/register" className="text-primary font-medium hover:underline">
          Kayıt ol
        </Link>
      </p>
    </form>
  );
}

export function RegisterForm() {
  const [pending, startTransition] = useTransition();
  const [formError, setFormError] = useState<string>();
  const form = useForm<RegisterInput>({
    resolver: zodResolver(registerSchema),
    defaultValues: { username: "", email: "", password: "" },
  });
  const { errors } = form.formState;

  const onSubmit = form.handleSubmit((values) => {
    setFormError(undefined);
    startTransition(async () => {
      const result = await registerAction(values);
      if (result?.error) setFormError(result.error);
      for (const [field, message] of Object.entries(result?.fieldErrors ?? {})) {
        form.setError(field as keyof RegisterInput, { message });
      }
    });
  });

  return (
    <form onSubmit={onSubmit} className="space-y-4" noValidate>
      <FormError message={formError} />
      <div className="space-y-2">
        <Label htmlFor="username">Kullanıcı adı</Label>
        <Input id="username" autoComplete="username" aria-invalid={!!errors.username} {...form.register("username")} />
        <FieldError message={errors.username?.message} />
      </div>
      <div className="space-y-2">
        <Label htmlFor="email">E-posta</Label>
        <Input id="email" type="email" autoComplete="email" aria-invalid={!!errors.email} {...form.register("email")} />
        <FieldError message={errors.email?.message} />
      </div>
      <div className="space-y-2">
        <Label htmlFor="password">Şifre</Label>
        <Input
          id="password"
          type="password"
          autoComplete="new-password"
          aria-invalid={!!errors.password}
          {...form.register("password")}
        />
        <FieldError message={errors.password?.message} />
      </div>
      <Button type="submit" className="w-full" disabled={pending}>
        {pending && <Loader2 className="animate-spin" />}
        Kayıt ol
      </Button>
      <p className="text-muted-foreground text-center text-sm">
        Zaten hesabın var mı?{" "}
        <Link href="/login" className="text-primary font-medium hover:underline">
          Giriş yap
        </Link>
      </p>
    </form>
  );
}
