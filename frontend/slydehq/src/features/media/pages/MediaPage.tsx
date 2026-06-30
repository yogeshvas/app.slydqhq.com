import { PictureOutlined } from "@ant-design/icons";
import PageHeader from "@/components/layout/PageHeader";
import { useDocumentTitle } from "@/lib/use-document-title";
import { MediaLibrary } from "../components/MediaLibrary";

/**
 * Media library. Every image a user generates (AI / stock) is catalogued here
 * automatically, alongside their uploads — searchable by AI-derived metadata and
 * user tags, and reusable across decks.
 */
const MediaPage = () => {
  useDocumentTitle("Media");
  return (
    <div className="flex h-full min-h-0 flex-col px-8 py-6">
      <PageHeader title="Media" icon={<PictureOutlined />} />
      <div className="min-h-0 flex-1">
        <MediaLibrary />
      </div>
    </div>
  );
};

export default MediaPage;
