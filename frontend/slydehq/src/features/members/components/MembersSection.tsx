import { useState } from "react";
import {
  CopyOutlined,
  CrownFilled,
  DeleteOutlined,
  MailOutlined,
  TeamOutlined,
  UserAddOutlined,
} from "@ant-design/icons";
import {
  App as AntApp,
  Avatar,
  Button,
  Empty,
  Form,
  Input,
  Popconfirm,
  Select,
  Spin,
  Table,
  Tag,
  Typography,
} from "antd";
import type { ColumnsType } from "antd/es/table";
import { useNavigate } from "react-router-dom";
import { isApiError } from "@/lib/api-client";
import { paths } from "@/routes/paths";
import { useWorkspace } from "@/features/workspace/hooks/use-workspace";
import {
  useInviteMember,
  useMembers,
  useRemoveMember,
  useRevokeInvite,
  useSetMemberRole,
} from "@/features/workspace/hooks/use-workspace";
import type {
  InvitableRole,
  Member,
  PendingInvite,
} from "@/features/workspace/types/workspace.types";

const { Title, Paragraph, Text } = Typography;

const ROLE_OPTIONS = [
  { value: "member", label: "Member" },
  { value: "admin", label: "Admin" },
];

const roleTag = (role: string) => {
  if (role === "owner")
    return (
      <Tag icon={<CrownFilled />} color="gold">
        Owner
      </Tag>
    );
  if (role === "admin") return <Tag color="geekblue">Admin</Tag>;
  return <Tag>Member</Tag>;
};

const initials = (name: string) => name.slice(0, 2).toUpperCase();

export function MembersSection() {
  const { message } = AntApp.useApp();
  const navigate = useNavigate();
  const { data: workspace } = useWorkspace();
  const { data, isLoading } = useMembers();

  const invite = useInviteMember();
  const setRole = useSetMemberRole();
  const removeMember = useRemoveMember();
  const revokeInvite = useRevokeInvite();

  const [form] = Form.useForm<{ email: string; role: InvitableRole }>();
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const isPro = workspace?.plan === "pro";
  const canManage = data?.canManage ?? false;

  const onInvite = async (values: { email: string; role: InvitableRole }) => {
    try {
      await invite.mutateAsync(values);
      message.success(`Invite sent to ${values.email}.`);
      form.resetFields();
    } catch (error) {
      message.error(
        isApiError(error) ? error.message : "Couldn't send the invite.",
      );
    }
  };

  const onRole = async (userId: string, role: InvitableRole) => {
    try {
      await setRole.mutateAsync({ userId, role });
      message.success("Role updated.");
    } catch (error) {
      message.error(isApiError(error) ? error.message : "Couldn't update role.");
    }
  };

  const onRemove = async (userId: string) => {
    try {
      await removeMember.mutateAsync(userId);
      message.success("Member removed.");
    } catch (error) {
      message.error(isApiError(error) ? error.message : "Couldn't remove member.");
    }
  };

  const onRevoke = async (inviteId: string) => {
    try {
      await revokeInvite.mutateAsync(inviteId);
      message.success("Invite revoked.");
    } catch (error) {
      message.error(isApiError(error) ? error.message : "Couldn't revoke invite.");
    }
  };

  const copyLink = async (inv: PendingInvite) => {
    await navigator.clipboard.writeText(inv.link).catch(() => {});
    setCopiedId(inv.id);
    setTimeout(() => setCopiedId(null), 1500);
    message.success("Invite link copied!");
  };

  const memberColumns: ColumnsType<Member> = [
    {
      title: "Member",
      dataIndex: "name",
      render: (_, m) => (
        <div className="flex items-center gap-3">
          <Avatar src={m.avatar || undefined} className="bg-indigo-500">
            {initials(m.name)}
          </Avatar>
          <div className="min-w-0">
            <div className="flex items-center gap-2 font-medium text-zinc-900">
              <span className="truncate">{m.name}</span>
              {m.isYou && <Tag className="!m-0">You</Tag>}
            </div>
            <div className="truncate text-[12px] text-zinc-500">{m.email}</div>
          </div>
        </div>
      ),
    },
    {
      title: "Role",
      dataIndex: "role",
      width: 160,
      render: (_, m) => {
        // Owner is fixed; managers can change others (not themselves/owner).
        if (m.role === "owner" || !canManage || m.isYou) return roleTag(m.role);
        return (
          <Select
            size="small"
            value={m.role}
            options={ROLE_OPTIONS}
            style={{ width: 120 }}
            onChange={(v) => onRole(m.userId, v as InvitableRole)}
          />
        );
      },
    },
    {
      title: "",
      key: "actions",
      width: 56,
      align: "right",
      render: (_, m) =>
        canManage && !m.isYou && m.role !== "owner" ? (
          <Popconfirm
            title="Remove member?"
            description={`${m.name} will lose access to this workspace.`}
            okText="Remove"
            okButtonProps={{ danger: true }}
            onConfirm={() => onRemove(m.userId)}
          >
            <Button type="text" size="small" danger icon={<DeleteOutlined />} />
          </Popconfirm>
        ) : null,
    },
  ];

  if (isLoading || !data) {
    return (
      <div className="grid place-items-center py-12">
        <Spin />
      </div>
    );
  }

  return (
    <div className="max-w-3xl space-y-8">
      {/* Invite box */}
      <div>
        <Title level={5} className="!mb-1">
          Invite teammates
        </Title>
        <Paragraph type="secondary" className="!mb-3 !text-[13px]">
          Members share this workspace — its decks, media, and credit balance.
          Owners and admins can manage the team.
        </Paragraph>

        {!isPro ? (
          <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-indigo-100 bg-indigo-50/50 px-5 py-4">
            <div>
              <div className="font-semibold text-zinc-900">
                Team workspaces are a Pro feature
              </div>
              <div className="text-sm text-zinc-500">
                Upgrade to invite unlimited teammates to this workspace.
              </div>
            </div>
            <Button type="primary" onClick={() => navigate(paths.billing)}>
              Upgrade to Pro
            </Button>
          </div>
        ) : canManage ? (
          <Form
            form={form}
            layout="inline"
            onFinish={onInvite}
            initialValues={{ role: "member" }}
            className="gap-2"
          >
            <Form.Item
              name="email"
              className="!mb-2 flex-1"
              rules={[
                { required: true, message: "Enter an email." },
                { type: "email", message: "Invalid email." },
              ]}
            >
              <Input
                prefix={<MailOutlined className="text-zinc-400" />}
                placeholder="teammate@company.com"
                style={{ minWidth: 240 }}
              />
            </Form.Item>
            <Form.Item name="role" className="!mb-2">
              <Select options={ROLE_OPTIONS} style={{ width: 120 }} />
            </Form.Item>
            <Form.Item className="!mb-2">
              <Button
                type="primary"
                htmlType="submit"
                icon={<UserAddOutlined />}
                loading={invite.isPending}
              >
                Invite
              </Button>
            </Form.Item>
          </Form>
        ) : (
          <Text type="secondary" className="!text-[13px]">
            Only the workspace owner and admins can invite members.
          </Text>
        )}
      </div>

      {/* Members table */}
      <div>
        <Title level={5} className="!mb-3 flex items-center gap-2">
          <TeamOutlined /> Members
          <Tag className="!m-0">{data.members.length}</Tag>
        </Title>
        <Table
          rowKey="userId"
          size="middle"
          columns={memberColumns}
          dataSource={data.members}
          pagination={false}
        />
      </div>

      {/* Pending invites */}
      {data.invites.length > 0 && (
        <div>
          <Title level={5} className="!mb-3">
            Pending invites
          </Title>
          <div className="divide-y divide-zinc-100 rounded-xl border border-zinc-200">
            {data.invites.map((inv) => (
              <div
                key={inv.id}
                className="flex flex-wrap items-center justify-between gap-3 px-4 py-3"
              >
                <div className="min-w-0">
                  <div className="truncate font-medium text-zinc-800">
                    {inv.email}
                  </div>
                  <div className="text-[12px] text-zinc-400">
                    Invited as {inv.role} · expires{" "}
                    {new Date(inv.expiresAt).toLocaleDateString()}
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  {roleTag(inv.role)}
                  <Button
                    type="text"
                    size="small"
                    icon={<CopyOutlined />}
                    onClick={() => copyLink(inv)}
                  >
                    {copiedId === inv.id ? "Copied" : "Link"}
                  </Button>
                  {canManage && (
                    <Popconfirm
                      title="Revoke this invite?"
                      okText="Revoke"
                      okButtonProps={{ danger: true }}
                      onConfirm={() => onRevoke(inv.id)}
                    >
                      <Button
                        type="text"
                        size="small"
                        danger
                        icon={<DeleteOutlined />}
                      />
                    </Popconfirm>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {data.members.length <= 1 && data.invites.length === 0 && isPro && (
        <Empty
          image={Empty.PRESENTED_IMAGE_SIMPLE}
          description="No teammates yet — invite someone above."
        />
      )}
    </div>
  );
}
