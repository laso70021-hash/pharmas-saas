import { WorkspaceService } from "@/lib/pharmacy-service";
import { landingWorkspace } from "@/lib/workspace";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import LandingPage from "@/components/landing/LandingPage";
import { PharmacyService } from "@/lib/pharmacy-service";
import { useAuth } from "@/hooks/useAuth";

const title = "Swahivo - Run Your Pharmacy Smarter with AI";
const description =
  "A complete pharmacy management system for pharmacies, chains and suppliers. Manage stock, sales, prescriptions, expiry, orders and deliveries in one connected workspace.";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title },
      { name: "description", content: description },
      { property: "og:title", content: title },
      { property: "og:description", content: description },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: title },
      { name: "twitter:description", content: description },
    ],
  }),
  component: Home,
});

const stats = { pharmacies: "Multi", suppliers: "Wholesale", medicines: "FIFO", accuracy: "Live" };

function Home() {
  const navigate = useNavigate();
  const { user, isSuperAdmin } = useAuth();
  const { data: plans = [] } = useQuery({
    queryKey: ["subscription-plans"],
    queryFn: () => PharmacyService.getPlans(),
  });

  const openDashboard = () => {
    if (!user) navigate({ to: "/auth", search: { mode: "signup" } });
    else if (isSuperAdmin) navigate({ to: "/admin" });
    else void WorkspaceService.listWorkspaces(user.id, false)
      .then((list) => { const ws = landingWorkspace(list); if (ws) navigate({ to: "/pharmacy", search: { id: ws.id } }); else navigate({ to: "/account" }); })
      .catch(() => navigate({ to: "/account" }));
  };

  return (
    <div className="relative">
      <LandingPage
        onOpenDashboard={openDashboard}
        onChoosePlan={(slug) => {
          if (user) openDashboard();
          else navigate({ to: "/auth", search: { mode: "signup", plan: slug } });
        }}
        onSignIn={() => navigate({ to: "/auth" })}
        isSignedIn={Boolean(user)}
        plans={plans}
        stats={stats}
      />
    </div>
  );
}
