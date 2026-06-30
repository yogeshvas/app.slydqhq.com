import {
  DeleteOutlined,
  ExclamationCircleFilled,
  RestOutlined,
  UndoOutlined,
} from "@ant-design/icons";
import {
  App as AntApp,
  Button,
  Empty,
  Flex,
  Spin,
  Table,
  Typography,
} from "antd";
import PageHeader from "@/components/layout/PageHeader";
import { isApiError } from "@/lib/api-client";
import { timeAgo } from "@/lib/utils";
import { useDocumentTitle } from "@/lib/use-document-title";
import {
  useEmptyTrash,
  usePurgeDeck,
  useRestoreDeck,
  useTrash,
} from "@/features/decks/hooks/use-decks";
import type { DeckSummary } from "@/features/decks/types/deck.types";

const { Text } = Typography;

const TrashPage = () => {
  useDocumentTitle("Trash");
  const { message, modal } = AntApp.useApp();
  const { data: decks = [], isLoading } = useTrash();
  const restore = useRestoreDeck();
  const purge = usePurgeDeck();
  const empty = useEmptyTrash();

  const doEmpty = () => {
    modal.confirm({
      title: "Empty trash?",
      icon: <ExclamationCircleFilled style={{ color: "#dc2626" }} />,
      content: (
        <span>
          All {decks.length} deck{decks.length === 1 ? "" : "s"} in trash and their
          slides will be deleted.{" "}
          <Text strong type="danger">
            This action cannot be reversed.
          </Text>
        </span>
      ),
      okText: "Empty trash",
      okButtonProps: { danger: true },
      cancelText: "Cancel",
      onOk: async () => {
        try {
          await empty.mutateAsync();
          message.success("Trash emptied.");
        } catch (e) {
          message.error(isApiError(e) ? e.message : "Couldn't empty trash.");
        }
      },
    });
  };

  const doRestore = async (id: string) => {
    try {
      await restore.mutateAsync(id);
      message.success("Deck restored.");
    } catch (e) {
      message.error(isApiError(e) ? e.message : "Couldn't restore.");
    }
  };

  const doPurge = (deck: DeckSummary) => {
    modal.confirm({
      title: "Delete permanently?",
      icon: <ExclamationCircleFilled style={{ color: "#dc2626" }} />,
      content: (
        <span>
          “{deck.title}” and all its slides will be gone for good.{" "}
          <Text strong type="danger">
            This action cannot be reversed.
          </Text>
        </span>
      ),
      okText: "Delete forever",
      okButtonProps: { danger: true },
      cancelText: "Cancel",
      onOk: async () => {
        try {
          await purge.mutateAsync(deck._id);
          message.success("Deck permanently deleted.");
        } catch (e) {
          message.error(isApiError(e) ? e.message : "Couldn't delete.");
        }
      },
    });
  };

  return (
    <div className="px-8 py-6">
      <PageHeader
        title="Trash"
        icon={<RestOutlined />}
        extra={
          decks.length > 0 ? (
            <Button danger icon={<DeleteOutlined />} onClick={doEmpty}>
              Empty trash
            </Button>
          ) : undefined
        }
      />


      <Text type="secondary" className="!mb-4 block">
        Decks you move to trash stay here until you restore or permanently delete
        them.
      </Text>

      {isLoading ? (
        <Flex justify="center" className="py-16">
          <Spin />
        </Flex>
      ) : decks.length === 0 ? (
        <Empty className="py-16" description="Trash is empty" />
      ) : (
        <Table<DeckSummary>
          rowKey="_id"
          size="middle"
          dataSource={decks}
          pagination={{ pageSize: 12, hideOnSinglePage: true }}
          columns={[
            { title: "Title", dataIndex: "title" },
            {
              title: "Updated",
              dataIndex: "updatedAt",
              render: (d: string) => timeAgo(d),
            },
            {
              title: "",
              align: "right" as const,
              render: (_: unknown, deck: DeckSummary) => (
                <Flex gap={8} justify="end">
                  <Button
                    icon={<UndoOutlined />}
                    onClick={() => void doRestore(deck._id)}
                  >
                    Restore
                  </Button>
                  <Button
                    danger
                    icon={<DeleteOutlined />}
                    onClick={() => doPurge(deck)}
                  >
                    Delete
                  </Button>
                </Flex>
              ),
            },
          ]}
        />
      )}
    </div>
  );
};

export default TrashPage;
