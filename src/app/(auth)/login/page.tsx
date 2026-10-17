import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { LoginForm } from "../auth-forms";

export const metadata: Metadata = { title: "Giriş yap" };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ callbackUrl?: string }> }) {
  const { callbackUrl } = await searchParams;
  if (await getCurrentUser()) redirect("/");

  return (
    <Card className="mx-auto w-full max-w-sm">
      <CardHeader>
        <CardTitle className="text-xl">Giriş yap</CardTitle>
        <CardDescription>İzlediklerini takip etmeye devam et.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <LoginForm callbackUrl={callbackUrl} />
      </CardContent>
    </Card>
  );
}
