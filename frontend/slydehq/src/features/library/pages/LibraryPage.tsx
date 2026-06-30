import { BgColorsOutlined } from "@ant-design/icons";
import PageHeader from "@/components/layout/PageHeader";
import SectionPlaceholder from "@/components/SectionPlaceholder";
import { useDocumentTitle } from "@/lib/use-document-title";

const LibraryPage = () => {
  useDocumentTitle("Library");
  return (
    <div className="px-8 py-6">
      <PageHeader title="Library" icon={<BgColorsOutlined />} />
      <SectionPlaceholder
        icon={<BgColorsOutlined />}
        title="Brand library"
        description="Save brand colours, fonts, and themes so every deck stays on-brand. Coming soon."
      />
    </div>
  );
};

export default LibraryPage;
