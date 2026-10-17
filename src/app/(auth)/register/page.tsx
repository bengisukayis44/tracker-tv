import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { RegisterForm } from "../auth-forms";

export const metadata: Metadata = { title: "Kayıt ol" };

export default async function RegisterPage() {
  if (await getCurrentUser()) redirect("/");

  return (
    <Card className="mx-auto w-full max-w-sm">
      <CardHeader>
        <CardTitle className="text-xl">Kayıt ol</CardTitle>
        <CardDescription>Dizi ve film takibine başlamak için hesap oluştur.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <RegisterForm />
      </CardContent>
    </Card>
  );
}
