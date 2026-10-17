import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { auth, isGoogleEnabled } from "@/auth";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { GoogleButton, RegisterForm } from "../auth-forms";

export const metadata: Metadata = { title: "Kayıt ol" };

export default async function RegisterPage() {
  if (await auth()) redirect("/");

  return (
    <Card className="mx-auto w-full max-w-sm">
      <CardHeader>
        <CardTitle className="text-xl">Kayıt ol</CardTitle>
        <CardDescription>Dizi ve film takibine başlamak için hesap oluştur.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {isGoogleEnabled && (
          <>
            <GoogleButton />
            <Separator />
          </>
        )}
        <RegisterForm />
      </CardContent>
    </Card>
  );
}
