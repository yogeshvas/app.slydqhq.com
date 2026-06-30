import { useState } from "react";
import {
  CheckOutlined,
  CopyOutlined,
  GiftOutlined,
  TeamOutlined,
  ThunderboltFilled,
} from "@ant-design/icons";
import { App as AntApp, Button, Col, Input, Row, Spin, Statistic, Typography } from "antd";
import { useReferral } from "../hooks/use-referral";

const { Title, Paragraph, Text } = Typography;

export function ReferralSection() {
  const { message } = AntApp.useApp();
  const { data, isLoading } = useReferral();
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    if (!data) return;
    await navigator.clipboard.writeText(data.link).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
    message.success("Invite link copied!");
  };

  const share = async () => {
    if (!data) return;
    const text = `Make presentations in seconds with AI — join Slyde HQ and we both get free credits: ${data.link}`;
    if (navigator.share) {
      navigator.share({ title: "Slyde HQ", text, url: data.link }).catch(() => {});
    } else {
      await navigator.clipboard.writeText(text).catch(() => {});
      message.success("Invite message copied!");
    }
  };

  if (isLoading || !data) {
    return (
      <div className="grid place-items-center py-12">
        <Spin />
      </div>
    );
  }

  return (
    <div className="max-w-3xl space-y-6">
      {/* Hero */}
      <div className="rounded-2xl border border-indigo-100 bg-gradient-to-br from-indigo-50 to-sky-50 p-6">
        <div className="mb-2 grid h-11 w-11 place-items-center rounded-full bg-indigo-600 text-white">
          <GiftOutlined className="text-[20px]" />
        </div>
        <Title level={3} className="!mb-1">
          Refer friends, earn credits
        </Title>
        <Paragraph className="!mb-0 !text-zinc-600">
          Share your link. When a friend signs up, you <b>both</b> get{" "}
          <Text strong>
            <ThunderboltFilled className="!text-amber-500" /> {data.rewardPerReferral} credits
          </Text>{" "}
          — that's a free deck each.
        </Paragraph>
      </div>

      {/* Link + actions */}
      <div>
        <Text type="secondary" className="!mb-1.5 block !text-[12px]">
          Your invite link
        </Text>
        <div className="flex flex-wrap gap-2">
          <Input
            readOnly
            value={data.link}
            className="!max-w-md"
            prefix={<GiftOutlined className="text-zinc-400" />}
          />
          <Button
            type="primary"
            icon={copied ? <CheckOutlined /> : <CopyOutlined />}
            onClick={() => void copy()}
          >
            {copied ? "Copied" : "Copy"}
          </Button>
          <Button onClick={() => void share()}>Share</Button>
        </div>
        <Text type="secondary" className="!mt-2 block !text-[12px]">
          Or share your code: <Text code>{data.code}</Text>
        </Text>
      </div>

      {/* Stats */}
      <Row gutter={16}>
        <Col xs={12} sm={8}>
          <div className="rounded-xl border border-zinc-200 p-4">
            <Statistic
              title="Friends joined"
              value={data.friendsJoined}
              prefix={<TeamOutlined className="!text-zinc-400" />}
            />
          </div>
        </Col>
        <Col xs={12} sm={8}>
          <div className="rounded-xl border border-zinc-200 p-4">
            <Statistic
              title="Credits earned"
              value={data.creditsEarned}
              prefix={<ThunderboltFilled className="!text-amber-500" />}
            />
          </div>
        </Col>
        <Col xs={24} sm={8}>
          <div className="rounded-xl border border-zinc-200 p-4">
            <Statistic
              title="Rewarded this month"
              value={`${data.thisMonth} / ${data.monthlyCap}`}
            />
          </div>
        </Col>
      </Row>

      <Text type="secondary" className="!text-[12px]">
        Up to {data.monthlyCap} rewarded referrals per month. New users must sign up
        with your link to qualify.
      </Text>
    </div>
  );
}
