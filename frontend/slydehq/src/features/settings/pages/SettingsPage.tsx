import type { ReactNode } from "react";
import { Avatar, Button, Switch, Tag } from "antd";
import { useLocation, useNavigate } from "react-router-dom";
import PageHeader from "@/components/layout/PageHeader";
import SectionPlaceholder from "@/components/SectionPlaceholder";
import { useAuthStore } from "@/features/auth/store/auth.store";
import { useWorkspace } from "@/features/workspace/hooks/use-workspace";
import { BillingSection } from "@/features/billing/components/BillingSection";
import { useDocumentTitle } from "@/lib/use-document-title";
import { useSuggestionPrefs } from "@/features/dashboard/suggestions";
import { activeSettingsSection } from "../sections";

/** A bordered "upgrade to Pro" call-to-action, used across settings sections. */
function UpgradeCard({ title, subtitle }: { title: string; subtitle: string }) {
  const navigate = useNavigate();
  return (
    <div className="flex flex-wrap items-center justify-between gap-4 rounded-lg border border-zinc-300 px-5 py-4">
      <div>
        <div className="font-semibold text-zinc-900">{title}</div>
        <div className="text-sm text-zinc-500">{subtitle}</div>
      </div>
      <Button type="primary" onClick={() => navigate("/settings/billing")}>
        Upgrade to Pro
      </Button>
    </div>
  );
}

function OverviewSection() {
  const user = useAuthStore((s) => s.user);
  const { data: workspace } = useWorkspace();
  const suggestionsOn = useSuggestionPrefs((s) => s.enabled);
  const setSuggestionsOn = useSuggestionPrefs((s) => s.setEnabled);

  return (
    <div className="max-w-3xl space-y-6">
      <div className="flex items-center gap-4">
        <Avatar size={56} src={user?.avatarUrl} className="bg-amber-400 text-lg text-zinc-900">
          {user?.name?.slice(0, 2).toUpperCase() ?? "U"}
        </Avatar>
        <div>
          <div className="text-lg font-semibold text-zinc-900">
            {workspace?.name ?? "Workspace"}
          </div>
          <div className="text-sm text-zinc-500">{user?.email}</div>
        </div>
        <Tag className="ml-auto capitalize">{workspace?.plan ?? "free"} plan</Tag>
      </div>

      <UpgradeCard
        title="Get more out of Slyde HQ with Pro"
        subtitle="More AI credits, custom branding, and team features."
      />

      {/* Preferences */}
      <div className="flex items-center justify-between rounded-lg border border-zinc-200 px-5 py-4">
        <div>
          <div className="font-semibold text-zinc-900">Assistant suggestions</div>
          <div className="text-sm text-zinc-500">
            Show the friendly guide with deck ideas on your dashboard.
          </div>
        </div>
        <Switch checked={suggestionsOn} onChange={setSuggestionsOn} />
      </div>
    </div>
  );
}

function ApiKeysSection() {
  return (
    <div className="max-w-4xl space-y-6">
      <p className="text-[15px] leading-relaxed text-zinc-600">
        Your API keys let you access the Slyde HQ API on your own behalf. You'll
        be the creator of decks made with the API.
      </p>
      <UpgradeCard
        title="Unlock API access with Pro"
        subtitle="Integrate Slyde HQ with your favourite tools."
      />
    </div>
  );
}

const SECTION_CONTENT: Record<string, ReactNode> = {
  overview: <OverviewSection />,
  billing: <BillingSection />,
  "api-keys": <ApiKeysSection />,
};

const SettingsPage = () => {
  const location = useLocation();
  const section = activeSettingsSection(location.pathname);
  useDocumentTitle(`${section.label} · Settings`);

  const content = SECTION_CONTENT[section.key] ?? (
    <SectionPlaceholder
      icon={section.icon}
      title={section.label}
      description="This settings section is coming soon."
    />
  );

  return (
    <div className="px-8 py-6">
      <PageHeader
        title={
          <span className="flex items-center gap-2">
            {section.label}
            {section.pro && <Tag color="geekblue">PRO</Tag>}
          </span>
        }
        utilities={false}
      />
      {content}
    </div>
  );
};

export default SettingsPage;
