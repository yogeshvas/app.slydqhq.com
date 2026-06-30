import { ApiOutlined, FileTextOutlined } from "@ant-design/icons";
import { Button, Card, Empty, Spin, Tag, Typography } from "antd";
import { useNavigate } from "react-router-dom";
import PageHeader from "@/components/layout/PageHeader";
import { deckPath } from "@/routes/paths";
import { timeAgo } from "@/lib/utils";
import { useDocumentTitle } from "@/lib/use-document-title";
import { useDecks } from "@/features/decks/hooks/use-decks";
import { LazyThumb } from "@/features/decks/components/LazyThumb";

const ApiGeneratedPage = () => {
  useDocumentTitle("API generated");
  const navigate = useNavigate();
  const { data, isLoading, hasNextPage, fetchNextPage, isFetchingNextPage } =
    useDecks({ source: "api" });
  const decks = data?.pages.flatMap((p) => p.decks) ?? [];

  return (
    <div className="px-8 py-6">
      <PageHeader title="API generated" icon={<ApiOutlined />} />
      <Typography.Paragraph type="secondary">
        Decks created through the Slyde HQ API.{" "}
        <Typography.Link onClick={() => navigate("/docs")}>
          View API docs →
        </Typography.Link>
      </Typography.Paragraph>

      {isLoading ? (
        <div className="grid place-items-center py-24">
          <Spin size="large" />
        </div>
      ) : decks.length === 0 ? (
        <Card>
          <Empty
            image={<ApiOutlined style={{ fontSize: 40, color: "#a1a1aa" }} />}
            description="No API-generated decks yet"
          >
            <Button type="primary" onClick={() => navigate("/settings/api-keys")}>
              Create an API key
            </Button>
          </Empty>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {decks.map((deck) => (
            <Card
              key={deck._id}
              hoverable
              styles={{ body: { padding: 16 } }}
              className="overflow-hidden"
              onClick={() => navigate(deckPath(deck._id))}
              cover={
                deck.thumbnailHtml ? (
                  <LazyThumb
                    html={deck.thumbnailHtml}
                    css={deck.styleCss ?? ""}
                    canvas={deck.canvas}
                  />
                ) : (
                  <div className="grid aspect-video place-items-center bg-gradient-to-br from-zinc-800 to-zinc-900 text-white/80">
                    <FileTextOutlined style={{ fontSize: 28 }} />
                  </div>
                )
              }
            >
              <div className="flex items-start justify-between gap-2">
                <Typography.Text strong className="truncate" title={deck.title}>
                  {deck.title}
                </Typography.Text>
                <Tag color="geekblue" className="!m-0">
                  API
                </Tag>
              </div>
              <Typography.Text type="secondary" className="mt-1 block text-[12px]">
                Created {timeAgo(deck.createdAt)}
              </Typography.Text>
            </Card>
          ))}
        </div>
      )}

      {hasNextPage && (
        <div className="mt-6 flex justify-center">
          <Button loading={isFetchingNextPage} onClick={() => void fetchNextPage()}>
            Load more
          </Button>
        </div>
      )}
    </div>
  );
};

export default ApiGeneratedPage;
