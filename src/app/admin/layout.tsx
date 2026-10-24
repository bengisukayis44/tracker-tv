import type { Metadata } from "next";
import { ShieldCheck } from "lucide-react";
import { AdminNav } from "@/components/admin/admin-nav";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const metadata: Metadata = {
  title: { template: "%s · Yönetim · Tracker.tv", default: "Yönetim" },
  robots: { index: false },
};

/** The admin panel's frame. Every page and action checks the admin again; this only draws the navigation. */
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  await requireAdmin();
  const openReports = await prisma.comment.count({ where: { reports: { some: { resolvedAt: null } } } });
  return (
    <div className="space-y-6">
      <div className="space-y-3">
        <p className="text-primary inline-flex items-center gap-1.5 text-sm font-semibold">
          <ShieldCheck className="size-4" />
          Yönetim paneli
        </p>
        <AdminNav openReports={openReports} />
      </div>
      {children}
    </div>
  );
}
