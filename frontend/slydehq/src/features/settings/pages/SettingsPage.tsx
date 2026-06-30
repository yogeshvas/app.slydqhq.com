import type { ReactNode } from "react";
import { Tag } from "antd";
import { useLocation } from "react-router-dom";
import PageHeader from "@/components/layout/PageHeader";
import SectionPlaceholder from "@/components/SectionPlaceholder";
import { BillingSection } from "@/features/billing/components/BillingSection";
import { ApiKeysSection } from "@/features/apikeys/components/ApiKeysSection";
import { ProfileOverview } from "@/features/profile/components/ProfileOverview";
import { ReferralSection } from "@/features/referral/components/ReferralSection";
import { MembersSection } from "@/features/members/components/MembersSection";
import { useDocumentTitle } from "@/lib/use-document-title";
import { activeSettingsSection } from "../sections";


const SECTION_CONTENT: Record<string, ReactNode> = {
  overview: <ProfileOverview />,
  billing: <BillingSection />,
  referral: <ReferralSection />,
  members: <MembersSection />,
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
