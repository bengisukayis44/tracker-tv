import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { auth, isGoogleEnabled } from "@/auth";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { GoogleButton, LoginForm } from "../auth-forms";

export const metadata: Metadata = { title: "Giriş yap" };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ callbackUrl?: string }> }) {
  const { callbackUrl } = await searchParams;
  if (await auth()) redirect("/");

  return (
    <Card className="mx-auto w-full max-w-sm">
      <CardHeader>
        <CardTitle className="text-xl">Giriş yap</CardTitle>
        <CardDescription>İzlediklerini takip etmeye devam et.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {isGoogleEnabled && (
          <>
            <GoogleButton callbackUrl={callbackUrl} />
            <Separator />
          </>
        )}
        <LoginForm callbackUrl={callbackUrl} />
      </CardContent>
    </Card>
  );
}
