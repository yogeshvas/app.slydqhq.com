import { useState } from "react";
import {
  CheckCircleFilled,
  CrownOutlined,
  DownloadOutlined,
  FilePdfOutlined,
  ThunderboltFilled,
} from "@ant-design/icons";
import {
  App as AntApp,
  Avatar,
  Badge,
  Button,
  Card,
  Col,
  Divider,
  Empty,
  Flex,
  Row,
  Segmented,
  Space,
  Spin,
  Statistic,
  Table,
  Tag,
  Typography,
} from "antd";
import { useNavigate } from "react-router-dom";
import { isApiError } from "@/lib/api-client";
import { useAuthStore } from "@/features/auth/store/auth.store";
import { useWorkspace } from "@/features/workspace/hooks/use-workspace";
import { billingApi } from "../api/billing.api";
import {
  useCatalog,
  useInvoices,
  useLedger,
  useWallet,
} from "../hooks/use-billing";
import type { Currency, Invoice, LedgerEntry } from "../api/billing.api";
import { money, printInvoice, printReport } from "../lib/print-doc";

const { Title, Text, Paragraph } = Typography;

const COIN_BG = "radial-gradient(circle at 30% 30%, #fde68a, #f59e0b 70%)";

const REASON_LABEL: Record<string, string> = {
  signup: "Signup bonus",
  daily_topup: "Daily free credits",
  recharge: "Wallet recharge",
  subscription: "Pro monthly credits",
  generation: "Deck generation",
  ai_image: "AI image",
  ai_edit: "AI edit",
  refund: "Refund",
  grant: "Grant",
  purchase: "Purchase",
  export: "Export",
};

/** Gold coin = antd Avatar with a gradient + lightning icon. */
function Coin({ size = 22 }: { size?: number }) {
  return (
    <Avatar
      size={size}
      icon={<ThunderboltFilled />}
      style={{ background: COIN_BG, border: "1.5px solid #d97706", color: "#fff" }}
    />
  );
}

export function BillingSection() {
  const navigate = useNavigate();
  const { message } = AntApp.useApp();
  const { data: workspace } = useWorkspace();
  const user = useAuthStore((s) => s.user);
  const { data: wallet, isLoading: wLoading } = useWallet();
  const { data: catalog, isLoading: cLoading } = useCatalog();
  const [ledgerPage, setLedgerPage] = useState(1);
  const [activityTab, setActivityTab] = useState<"invoices" | "ledger">("invoices");
  const { data: ledger, isFetching: ledgerFetching } = useLedger(ledgerPage);
  const { data: invoices } = useInvoices();

  const currency: Currency = wallet?.currency ?? "INR";
  const isPro = wallet?.plan === "pro";
  const wsName = workspace?.name ?? "Workspace";

  const goPay = (qs: string) => {
    if (!wallet?.billingEnabled) {
      message.info("Payments aren't enabled yet.");
      return;
    }
    navigate(`/payment?${qs}`);
  };

  const exportReport = async () => {
    try {
      const all = await billingApi.ledger(1);
      printReport(wsName, all.items, REASON_LABEL);
    } catch (e) {
      message.error(isApiError(e) ? e.message : "Couldn't export report.");
    }
  };

  if (wLoading || cLoading) {
    return (
      <Flex justify="center" className="py-16">
        <Spin />
      </Flex>
    );
  }

  const freePlan = catalog?.plans.find((p) => p.tier === "free");
  const proPlan = catalog?.plans.find((p) => p.tier === "pro");
  const packs = catalog?.packs ?? [];

  const invoiceColumns = [
    { title: "Invoice", dataIndex: "invoiceNo" },
    {
      title: "Date",
      dataIndex: "createdAt",
      render: (d: string) => new Date(d).toLocaleDateString(),
    },
    {
      title: "For",
      dataIndex: "kind",
      render: (k: string) => (k === "subscription" ? "Pro subscription" : "Credit pack"),
    },
    {
      title: "Credits",
      dataIndex: "credits",
      align: "right" as const,
      render: (c: number) => c || "—",
    },
    {
      title: "Amount",
      align: "right" as const,
      render: (_: unknown, r: Invoice) => money(r.amount, r.currency),
    },
    {
      title: "",
      align: "right" as const,
      render: (_: unknown, r: Invoice) => (
        <Button
          size="small"
          icon={<DownloadOutlined />}
          onClick={() => printInvoice({ ...r, workspaceName: wsName })}
        >
          Invoice
        </Button>
      ),
    },
  ];

  const ledgerColumns = [
    {
      title: "Date",
      dataIndex: "createdAt",
      render: (d: string) => new Date(d).toLocaleString(),
    },
    {
      title: "Activity",
      dataIndex: "reason",
      render: (r: string) => REASON_LABEL[r] ?? r,
    },
    {
      title: "Credits",
      dataIndex: "delta",
      align: "right" as const,
      render: (d: number) => (
        <Text type={d >= 0 ? "success" : undefined} strong={d >= 0}>
          {d >= 0 ? `+${d}` : d}
        </Text>
      ),
    },
    { title: "Balance", dataIndex: "balanceAfter", align: "right" as const },
  ];

  return (
    <div className="-mx-8 -my-6 min-h-full bg-gradient-to-b from-white via-indigo-50 to-sky-100 px-8 py-6">
      {/* Wallet */}
      <Card className="!mb-6">
        <Flex align="center" justify="space-between" wrap gap={16}>
          <Flex align="center" gap={14}>
            <Avatar
              size={52}
              icon={<ThunderboltFilled style={{ fontSize: 24 }} />}
              style={{ background: COIN_BG, border: "2px solid #d97706", color: "#fff" }}
            />
            <Statistic
              title="Your credit balance"
              value={wallet?.balance ?? 0}
              valueStyle={{ fontWeight: 700, fontSize: 30 }}
            />
          </Flex>
          <Tag color={isPro ? "geekblue" : "default"} className="capitalize">
            {wallet?.plan ?? "free"} plan
          </Tag>
        </Flex>
      </Card>

      {/* Buy credits — primary */}
      <Flex align="center" gap={8} className="!mb-1">
        <Coin />
        <Title level={4} className="!mb-0">
          Buy credits
        </Title>
      </Flex>
      <Paragraph type="secondary" className="!mb-4">
        Credits power every generation. Top up your wallet — bigger packs include bonus credits.
      </Paragraph>
      <Row gutter={[16, 16]} className="!mb-8">
        {packs.map((p, i) => {
          // The 3rd pack is the highlighted "best value" (shimmer border).
          const best = i === 2;
          const card = (
            <Card hoverable className="h-full text-center">
              <Flex vertical align="center" gap={4}>
                <Coin size={30} />
                <Statistic
                  value={p.credits}
                  valueStyle={{ fontWeight: 700, fontSize: 24 }}
                />
                <Text type="secondary" className="!text-[12px]">
                  credits
                </Text>
                {p.bonusPct > 0 && (
                  <Tag color="success" className="!m-0">
                    +{p.bonusPct}% bonus
                  </Tag>
                )}
                <Button
                  type={best ? "primary" : "default"}
                  block
                  className="!mt-2"
                  onClick={() => goPay(`type=pack&pack=${p.id}`)}
                >
                  Buy {money(p.price, currency)}
                </Button>
              </Flex>
            </Card>
          );
          return (
            <Col key={p.id} xs={24} sm={12} lg={6}>
              {best ? (
                <div className="shimmer-border h-full !rounded-2xl">
                  <Badge.Ribbon text="BEST VALUE" color="#4F46E5">
                    {card}
                  </Badge.Ribbon>
                </div>
              ) : (
                card
              )}
            </Col>
          );
        })}
      </Row>
      {wallet && !wallet.billingEnabled && (
        <Text type="warning" className="!mb-6 block !text-[12px]">
          Payments aren't configured yet (Razorpay keys missing).
        </Text>
      )}

      {/* Plans — secondary */}
      <Title level={5} className="!mb-3">
        Plans
      </Title>
      <Row gutter={[16, 16]} className="!mb-8">
        <Col xs={24} sm={12}>
          <Card className="h-full">
            <Title level={5} className="!mb-1">
              Free
            </Title>
            <Title level={3} className="!mt-0">
              {money(0, currency)}
            </Title>
            <Space direction="vertical" size={6}>
              <Text>✓ Pay-as-you-go credits</Text>
              <Text>✓ Daily free credits</Text>
              <Text>✓ Up to {freePlan?.cardsPerPrompt ?? 15} cards / prompt</Text>
            </Space>
            {!isPro && (
              <div>
                <Tag className="!mt-4">Current plan</Tag>
              </div>
            )}
          </Card>
        </Col>
        <Col xs={24} sm={12}>
          <Badge.Ribbon text="Pro" color="#4F46E5">
            <Card className="h-full" style={{ borderColor: "#4F46E5", borderWidth: 2 }}>
              <Title level={5} className="!mb-1">
                Pro
              </Title>
              <Title level={3} className="!mt-0">
                {money(proPlan?.price ?? 0, currency)}
                <Text type="secondary" className="!text-[13px] !font-normal">
                  {" "}
                  / month
                </Text>
              </Title>
              <Space direction="vertical" size={6}>
                <Text>✓ {proPlan?.monthlyCredits ?? 2000} credits / month</Text>
                <Text>✓ Members + API + email generation</Text>
                <Text>✓ Watermark removed</Text>
              </Space>
              <Divider className="!my-4" />
              {isPro ? (
                <Space>
                  <Tag color="geekblue" icon={<CheckCircleFilled />}>
                    Active
                  </Tag>
                  {!wallet?.cancelAtPeriodEnd && (
                    <Button
                      size="small"
                      onClick={() =>
                        billingApi
                          .cancel()
                          .then(() => message.success("Cancels at period end."))
                          .catch(() => message.error("Couldn't cancel."))
                      }
                    >
                      Cancel
                    </Button>
                  )}
                </Space>
              ) : (
                <Button
                  type="primary"
                  icon={<CrownOutlined />}
                  onClick={() => goPay("type=pro")}
                >
                  Upgrade to Pro
                </Button>
              )}
            </Card>
          </Badge.Ribbon>
        </Col>
      </Row>

      {/* Invoices + ledger — Segmented (pill) switch */}
      <Card>
        <Flex align="center" justify="space-between" wrap gap={12} className="!mb-4">
          <Segmented
            value={activityTab}
            onChange={(v) => setActivityTab(v as "invoices" | "ledger")}
            options={[
              { label: "Invoices", value: "invoices" },
              { label: "Credit activity", value: "ledger" },
            ]}
          />
          {activityTab === "ledger" ? (
            <Button icon={<FilePdfOutlined />} onClick={() => void exportReport()}>
              Export report (PDF)
            </Button>
          ) : (
            <Text type="secondary" className="!text-[12px]">
              {user?.email}
            </Text>
          )}
        </Flex>

        {activityTab === "invoices" ? (
          <Table<Invoice>
            size="small"
            rowKey="_id"
            dataSource={invoices ?? []}
            locale={{ emptyText: <Empty description="No invoices yet" /> }}
            pagination={{ pageSize: 10, hideOnSinglePage: true }}
            columns={invoiceColumns}
          />
        ) : (
          <Table<LedgerEntry>
            size="small"
            rowKey="_id"
            loading={ledgerFetching}
            dataSource={ledger?.items ?? []}
            pagination={{
              current: ledgerPage,
              total: ledger?.total ?? 0,
              pageSize: 30,
              showSizeChanger: false,
              onChange: setLedgerPage,
            }}
            columns={ledgerColumns}
          />
        )}
      </Card>
    </div>
  );
}
