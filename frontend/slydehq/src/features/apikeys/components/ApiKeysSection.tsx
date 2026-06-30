import { useState } from "react";
import {
  ApiOutlined,
  CheckOutlined,
  CopyOutlined,
  DeleteOutlined,
  KeyOutlined,
  PlusOutlined,
} from "@ant-design/icons";
import {
  App as AntApp,
  Button,
  Empty,
  Flex,
  Input,
  InputNumber,
  Modal,
  Spin,
  Table,
  Tag,
  Typography,
} from "antd";
import { useNavigate } from "react-router-dom";
import { isApiError } from "@/lib/api-client";
import { timeAgo } from "@/lib/utils";
import { useWorkspace } from "@/features/workspace/hooks/use-workspace";
import {
  useApiKeys,
  useCreateApiKey,
  useRevokeApiKey,
} from "../hooks/use-apikeys";
import type { ApiKey } from "../api/apikeys.api";

const { Text, Paragraph, Link } = Typography;

export function ApiKeysSection() {
  const { message, modal } = AntApp.useApp();
  const navigate = useNavigate();
  const { data: workspace } = useWorkspace();
  const isPro = workspace?.plan === "pro";

  const { data: keys = [], isLoading } = useApiKeys();
  const create = useCreateApiKey();
  const revoke = useRevokeApiKey();

  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");
  const [budget, setBudget] = useState<number | null>(null);
  const [newSecret, setNewSecret] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  // Free workspaces can't use the API — show an upgrade prompt.
  if (!isPro) {
    return (
      <div className="max-w-3xl space-y-5">
        <Paragraph className="!text-[15px] !text-zinc-600">
          The Slyde HQ API lets you generate decks programmatically. API access is
          a Pro feature.
        </Paragraph>
        <div className="flex flex-wrap items-center justify-between gap-4 rounded-lg border border-zinc-300 px-5 py-4">
          <div>
            <div className="font-semibold text-zinc-900">Unlock API access with Pro</div>
            <div className="text-sm text-zinc-500">
              Generate decks from your own apps and automations.
            </div>
          </div>
          <Button type="primary" onClick={() => navigate("/settings/billing")}>
            Upgrade to Pro
          </Button>
        </div>
        <Link onClick={() => navigate("/docs")}>Read the API documentation →</Link>
      </div>
    );
  }

  const doCreate = async () => {
    if (!name.trim()) return;
    try {
      const { key } = await create.mutateAsync({ name: name.trim(), budgetCredits: budget });
      setCreating(false);
      setName("");
      setBudget(null);
      setNewSecret(key); // show once
    } catch (e) {
      message.error(isApiError(e) ? e.message : "Couldn't create key.");
    }
  };

  const doRevoke = (k: ApiKey) => {
    modal.confirm({
      title: `Revoke “${k.name}”?`,
      content: "Apps using this key will immediately lose access. This can't be undone.",
      okText: "Revoke",
      okButtonProps: { danger: true },
      onOk: async () => {
        try {
          await revoke.mutateAsync(k._id);
          message.success("Key revoked.");
        } catch (e) {
          message.error(isApiError(e) ? e.message : "Couldn't revoke.");
        }
      },
    });
  };

  const copySecret = async () => {
    if (!newSecret) return;
    await navigator.clipboard.writeText(newSecret).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div className="max-w-4xl space-y-5">
      <Flex justify="space-between" align="center" wrap gap={12}>
        <Paragraph className="!mb-0 !text-[15px] !text-zinc-600">
          Use these keys to call the Slyde HQ API.{" "}
          <Link onClick={() => navigate("/docs")}>View docs →</Link>
        </Paragraph>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => setCreating(true)}>
          Create key
        </Button>
      </Flex>

      {isLoading ? (
        <Flex justify="center" className="py-12">
          <Spin />
        </Flex>
      ) : keys.length === 0 ? (
        <Empty
          className="py-12"
          image={<KeyOutlined style={{ fontSize: 40, color: "#a1a1aa" }} />}
          description="No API keys yet"
        />
      ) : (
        <Table<ApiKey>
          size="small"
          rowKey="_id"
          dataSource={keys}
          pagination={false}
          columns={[
            {
              title: "Name",
              dataIndex: "name",
              render: (n: string, k: ApiKey) => (
                <Flex align="center" gap={8}>
                  <ApiOutlined className="text-zinc-400" />
                  <span>{n}</span>
                  {k.revoked && <Tag color="error">Revoked</Tag>}
                  {!k.revoked && !k.enabled && <Tag>Disabled</Tag>}
                </Flex>
              ),
            },
            { title: "Key", dataIndex: "prefix", render: (p: string) => <Text code>{p}</Text> },
            {
              title: "Usage",
              render: (_: unknown, k: ApiKey) =>
                k.budgetCredits != null
                  ? `${k.spentCredits} / ${k.budgetCredits} cr`
                  : `${k.spentCredits} cr`,
            },
            {
              title: "Last used",
              dataIndex: "lastUsedAt",
              render: (d: string | null) => (d ? timeAgo(d) : "—"),
            },
            {
              title: "",
              align: "right" as const,
              render: (_: unknown, k: ApiKey) =>
                k.revoked ? null : (
                  <Button
                    size="small"
                    danger
                    icon={<DeleteOutlined />}
                    onClick={() => doRevoke(k)}
                  >
                    Revoke
                  </Button>
                ),
            },
          ]}
        />
      )}

      {/* Create modal */}
      <Modal
        open={creating}
        title="Create API key"
        okText="Create"
        confirmLoading={create.isPending}
        onOk={() => void doCreate()}
        onCancel={() => setCreating(false)}
        destroyOnClose
      >
        <div className="space-y-3 pt-1">
          <div>
            <Text type="secondary" className="!mb-1 block !text-[12px]">
              Key name
            </Text>
            <Input
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Production server"
              maxLength={80}
            />
          </div>
          <div>
            <Text type="secondary" className="!mb-1 block !text-[12px]">
              Credit budget (optional)
            </Text>
            <InputNumber
              className="!w-full"
              min={1}
              value={budget ?? undefined}
              onChange={(v) => setBudget(v ?? null)}
              placeholder="Uncapped — draws from your wallet"
            />
          </div>
        </div>
      </Modal>

      {/* Show-once secret modal */}
      <Modal
        open={Boolean(newSecret)}
        title="Copy your API key"
        footer={[
          <Button key="done" type="primary" onClick={() => setNewSecret(null)}>
            Done
          </Button>,
        ]}
        onCancel={() => setNewSecret(null)}
      >
        <Paragraph type="warning" className="!text-[13px]">
          This is the only time you'll see this key. Copy it now and store it
          securely.
        </Paragraph>
        <Flex gap={8}>
          <Input readOnly value={newSecret ?? ""} />
          <Button
            type="primary"
            icon={copied ? <CheckOutlined /> : <CopyOutlined />}
            onClick={() => void copySecret()}
          >
            {copied ? "Copied" : "Copy"}
          </Button>
        </Flex>
      </Modal>
    </div>
  );
}
