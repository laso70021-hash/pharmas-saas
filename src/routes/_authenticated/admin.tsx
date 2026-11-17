import { createFileRoute, Navigate, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import AdminDashboard from "@/components/dashboard/AdminDashboard";
import { PharmacyService } from "@/lib/pharmacy-service";
import { useAuth } from "@/hooks/useAuth";

export const Route = createFileRoute("/_authenticated/admin")({
  head: () => ({
    meta: [
      { title: "Admin Dashboard | Swahivo" },
      { name: "description", content: "Platform administration for Swahivo: pharmacies, stock, sales and AI insights." },
      { property: "og:title", content: "Admin Dashboard | Swahivo" },
      { property: "og:description", content: "Platform administration for Swahivo." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AdminPage,
});

function AdminPage() {
  const navigate = useNavigate();
  const { isLoading, isSuperAdmin } = useAuth();
  const { data: plans = [] } = useQuery({
    queryKey: ["subscription-plans"],
    queryFn: () => PharmacyService.getPlans(),
    enabled: isSuperAdmin,
  });

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#F4F6FA] flex items-center justify-center text-sm font-semibold text-slate-500">
        Loading dashboard…
      </div>
    );
  }

  if (!isSuperAdmin) {
    // Business owners and suppliers manage their registration from their account page.
    return <Navigate to="/account" replace />;
  }

  return (
    <div className="relative">
      <AdminDashboard onBackToLanding={() => navigate({ to: "/" })} plans={plans} />
    </div>
  );
}
