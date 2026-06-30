import { AppstoreOutlined } from "@ant-design/icons";
import PageHeader from "@/components/layout/PageHeader";
import SectionPlaceholder from "@/components/SectionPlaceholder";
import { useDocumentTitle } from "@/lib/use-document-title";

const TemplatesPage = () => {
  useDocumentTitle("Templates");
  return (
    <div className="px-8 py-6">
      <PageHeader title="Templates" icon={<AppstoreOutlined />} />
      <SectionPlaceholder
        icon={<AppstoreOutlined />}
        title="Templates"
        description="Start from a ready-made structure and let AI fill in the content. A template gallery is on the way."
      />
    </div>
  );
};

export default TemplatesPage;
