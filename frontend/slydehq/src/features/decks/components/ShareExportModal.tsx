import { useEffect, useState } from "react";
import {
  CheckOutlined,
  CopyOutlined,
  DownloadOutlined,
  ExportOutlined,
  FilePdfOutlined,
  FileImageOutlined,
  FilePptOutlined,
  GoogleOutlined,
  LinkOutlined,
  SettingOutlined,
} from "@ant-design/icons";
import {
  App as AntApp,
  Button,
  ConfigProvider,
  Flex,
  Input,
  Menu,
  Modal,
  Segmented,
  Space,
  Switch,
  Tag,
  Tooltip,
  Typography,
} from "antd";
import { isApiError } from "@/lib/api-client";
import { decksApi } from "../api/decks.api";
import type { ExportFormat, ShareSettings } from "../types/deck.types";

const { Text } = Typography;

interface Props {
  open: boolean;
  onClose: () => void;
  deckId: string;
  deckTitle: string;
  slideCount: number;
}

type Pane = "share" | "export" | "settings";

const EXPORT_TYPES: {
  format: ExportFormat | "gslides";
  label: string;
  icon: React.ReactNode;
  soon?: boolean;
}[] = [
  { format: "pdf", label: "Export to PDF", icon: <FilePdfOutlined /> },
  { format: "pptx", label: "Export to PowerPoint", icon: <FilePptOutlined /> },
  {
    format: "gslides",
    label: "Export to Google Slides",
    icon: <GoogleOutlined />,
    soon: true,
  },
  { format: "png", label: "Export as PNGs", icon: <FileImageOutlined /> },
];

/** Parse a range string like "1-5, 8, 11-12" into sorted unique 1-based numbers. */
function parseRange(input: string, max: number): number[] {
  const out = new Set<number>();
  for (const part of input.split(",")) {
    const seg = part.trim();
    if (!seg) continue;
    const m = seg.match(/^(\d+)\s*-\s*(\d+)$/);
    if (m) {
      const a = Math.max(1, parseInt(m[1], 10));
      const b = Math.min(max, parseInt(m[2], 10));
      for (let i = a; i <= b; i++) out.add(i);
    } else if (/^\d+$/.test(seg)) {
      const n = parseInt(seg, 10);
      if (n >= 1 && n <= max) out.add(n);
    }
  }
  return [...out].sort((a, b) => a - b);
}

/**
 * Gamma-style Share / Export / Settings modal: export a card range to PDF/PPTX/
 * PNGs, copy the public link, and control password + download + discoverable.
 */
export function ShareExportModal({
  open,
  onClose,
  deckId,
  deckTitle,
  slideCount,
}: Props) {
  const { message } = AntApp.useApp();
  const [pane, setPane] = useState<Pane>("export");

  // Export state
  const [scope, setScope] = useState<"all" | "custom">("all");
  const [range, setRange] = useState("");
  const [exporting, setExporting] = useState<string | null>(null);

  // Share state
  const [share, setShare] = useState<ShareSettings | null>(null);
  const [loadingShare, setLoadingShare] = useState(false);
  const [savingShare, setSavingShare] = useState(false);
  const [copied, setCopied] = useState(false);
  const [password, setPassword] = useState("");

  // Lazily fetch/create the share link when Share/Settings is first opened.
  useEffect(() => {
    if (!open || share || (pane !== "share" && pane !== "settings")) return;
    setLoadingShare(true);
    decksApi
      .getShare(deckId)
      .then(setShare)
      .catch((e) =>
        message.error(isApiError(e) ? e.message : "Couldn't load share link."),
      )
      .finally(() => setLoadingShare(false));
  }, [open, pane, deckId, share, message]);

  const selectedNumbers = (): number[] | undefined => {
    if (scope === "all") return undefined;
    const nums = parseRange(range, slideCount);
    return nums.length ? nums : undefined;
  };

  const runExport = async (format: ExportFormat | "gslides") => {
    if (format === "gslides") {
      message.info("Google Slides export is coming soon.");
      return;
    }
    if (scope === "custom" && !selectedNumbers()) {
      message.warning("Enter a valid card range, e.g. 1-5, 8.");
      return;
    }
    setExporting(format);
    const hide = message.loading(`Preparing ${format.toUpperCase()}…`, 0);
    try {
      const { url } = await decksApi.exportDeck(
        deckId,
        format,
        selectedNumbers(),
      );
      window.open(url, "_blank", "noopener");
      message.success("Export ready.");
    } catch (e) {
      message.error(isApiError(e) ? e.message : "Export failed.");
    } finally {
      hide();
      setExporting(null);
    }
  };

  const patchShare = async (
    patch: Parameters<typeof decksApi.updateShare>[1],
  ) => {
    setSavingShare(true);
    try {
      setShare(await decksApi.updateShare(deckId, patch));
    } catch (e) {
      message.error(isApiError(e) ? e.message : "Couldn't save settings.");
    } finally {
      setSavingShare(false);
    }
  };

  const copyLink = async () => {
    if (!share) return;
    try {
      await navigator.clipboard.writeText(share.url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      message.error("Couldn't copy. Copy it manually.");
    }
  };

  const exportPane = (
    <Space direction="vertical" size="middle" className="w-full">
      <Text type="secondary">
        Download a copy of <b>{deckTitle || "this deck"}</b> to share.
      </Text>
      <div>
        <Text type="secondary" className="!mb-1.5 block !text-[12px]">
          Which cards
        </Text>
        <Segmented
          value={scope}
          onChange={(v) => setScope(v as "all" | "custom")}
          options={[
            { label: `All cards (${slideCount})`, value: "all" },
            { label: "Custom range", value: "custom" },
          ]}
        />
        {scope === "custom" && (
          <Input
            className="!mt-2"
            value={range}
            onChange={(e) => setRange(e.target.value)}
            placeholder={`e.g. 1-5, 8  (1–${slideCount})`}
          />
        )}
      </div>
      <div>
        <Text type="secondary" className="!mb-1.5 block !text-[12px]">
          Export type
        </Text>
        <Space direction="vertical" size={4} className="w-full">
          {EXPORT_TYPES.map((t) => (
            <Button
              key={t.format}
              block
              icon={t.icon}
              loading={exporting === t.format}
              disabled={Boolean(exporting)}
              onClick={() => void runExport(t.format)}
              className="!flex !items-center !justify-start !text-left"
            >
              <span className="flex-1">{t.label}</span>
              {t.soon && <Tag className="!m-0">Soon</Tag>}
              <DownloadOutlined />
            </Button>
          ))}
        </Space>
      </div>
    </Space>
  );

  const sharePane = (
    <Space direction="vertical" size="large" className="w-full">
      <Text type="secondary">
        Anyone with this link can view the deck
        {share?.hasPassword ? " (password required)" : ""}.
      </Text>
      <Space.Compact className="w-full">
        <Input
          readOnly
          value={loadingShare ? "Generating link…" : (share?.url ?? "")}
          prefix={<LinkOutlined className="text-zinc-400" />}
        />
        <Button
          type="primary"
          icon={copied ? <CheckOutlined /> : <CopyOutlined />}
          disabled={!share}
          onClick={() => void copyLink()}
        >
          {copied ? "Copied" : "Copy"}
        </Button>
      </Space.Compact>
      <Flex align="center" justify="space-between">
        <div>
          <Text strong className="block">
            Link sharing
          </Text>
          <Text type="secondary" className="!text-[12px]">
            Turn the public link on or off.
          </Text>
        </div>
        <Switch
          checked={share?.enabled ?? false}
          loading={savingShare}
          disabled={!share}
          onChange={(v) => void patchShare({ enabled: v })}
        />
      </Flex>
      <Flex align="center" justify="space-between">
        <div>
          <Text strong className="block">
            Allow downloads
          </Text>
          <Text type="secondary" className="!text-[12px]">
            Let viewers export the deck.
          </Text>
        </div>
        <Switch
          checked={share?.allowDownload ?? false}
          loading={savingShare}
          disabled={!share}
          onChange={(v) => void patchShare({ allowDownload: v })}
        />
      </Flex>
    </Space>
  );

  const settingsPane = (
    <Space direction="vertical" size="large" className="w-full">
      <div>
        <Text strong className="block">
          Require a password to view
        </Text>
        <Text type="secondary" className="!mb-2 block !text-[12px]">
          {share?.hasPassword
            ? "A password is set. Enter a new one to change it, or remove it."
            : "Viewers must enter this password to open the deck."}
        </Text>
        <Space.Compact className="w-full">
          <Input.Password
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder={share?.hasPassword ? "New password" : "Set a password"}
            disabled={!share}
          />
          <Button
            disabled={!share || !password}
            loading={savingShare}
            onClick={async () => {
              await patchShare({ password });
              setPassword("");
              message.success("Password set.");
            }}
          >
            Set
          </Button>
          {share?.hasPassword && (
            <Tooltip title="Remove password">
              <Button
                danger
                loading={savingShare}
                onClick={() => void patchShare({ password: null })}
              >
                Remove
              </Button>
            </Tooltip>
          )}
        </Space.Compact>
      </div>
      <Flex align="center" justify="space-between">
        <div>
          <Text strong className="block">
            Discoverable on the web
          </Text>
          <Text type="secondary" className="!text-[12px]">
            Allow this deck to be indexed/listed publicly.
          </Text>
        </div>
        <Switch
          checked={share?.discoverable ?? false}
          loading={savingShare}
          disabled={!share}
          onChange={(v) => void patchShare({ discoverable: v })}
        />
      </Flex>
    </Space>
  );

  return (
    <Modal
      open={open}
      onCancel={onClose}
      footer={null}
      width={720}
      title={
        <div className="!pr-8">
          <Space size={8}>
            <ExportOutlined />
            <Text strong>Share</Text>
          </Space>
        </div>
      }
    >
      <Flex gap={20} className="min-h-[400px] pt-2">
        <ConfigProvider
          theme={{
            components: { Menu: { itemHeight: 34, itemMarginBlock: 2 } },
          }}
        >
          <Menu
            mode="inline"
            selectedKeys={[pane]}
            onClick={({ key }) => setPane(key as Pane)}
            style={{ width: 150, borderInlineEnd: 0 }}
            items={[
              { key: "share", label: "Share", icon: <LinkOutlined /> },
              { key: "export", label: "Export", icon: <DownloadOutlined /> },
              { key: "settings", label: "Settings", icon: <SettingOutlined /> },
            ]}
          />
        </ConfigProvider>
        <div className="min-w-0 flex-1">
          {pane === "share" && sharePane}
          {pane === "export" && exportPane}
          {pane === "settings" && settingsPane}
        </div>
      </Flex>
    </Modal>
  );
}
