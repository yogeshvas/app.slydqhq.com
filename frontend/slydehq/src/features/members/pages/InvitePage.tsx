import { useEffect } from "react";
import { TeamOutlined } from "@ant-design/icons";
import { App as AntApp, Avatar, Button, Result, Spin, Tag } from "antd";
import { useNavigate, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import AuthLayout from "@/components/layout/AuthLayout";
import { ThreeDMarquee } from "@/components/ui/3d-marquee";
import { loginMarqueeImages } from "@/features/auth/login-marquee-images";
import { isApiError } from "@/lib/api-client";
import { paths } from "@/routes/paths";
import { useDocumentTitle } from "@/lib/use-document-title";
import { useAuthStore } from "@/features/auth/store/auth.store";
import { workspaceApi } from "@/features/workspace/api/workspace.api";
import { useInviteMutation } from "../hooks/use-invite-mutation";
import { storeInviteToken } from "../invite-storage";

const InvitePage = () => {
  useDocumentTitle("Join workspace");
  const { token = "" } = useParams();
  const navigate = useNavigate();
  const { message } = AntApp.useApp();
  const isAuthed = useAuthStore((s) => s.isAuthenticated);

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ["invite", token],
    queryFn: () => workspaceApi.invitePreview(token),
    enabled: Boolean(token),
    retry: false,
  });

  const accept = useInviteMutation();

  // Always remember the token so it survives a sign-in round-trip.
  useEffect(() => {
    if (token) storeInviteToken(token);
  }, [token]);

  const onAccept = async () => {
    try {
      const ws = await accept.mutateAsync(token);
      message.success(`You've joined ${ws.name}!`);
      navigate(paths.dashboard, { replace: true });
    } catch (err) {
      message.error(
        isApiError(err) ? err.message : "Couldn't accept the invite.",
      );
    }
  };

  if (isLoading) {
    return (
      <div className="grid min-h-screen place-items-center bg-zinc-50">
        <Spin size="large" />
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div className="grid min-h-screen place-items-center bg-zinc-50 p-6">
        <Result
          status="warning"
          title="This invite link isn't valid"
          subTitle={
            isApiError(error)
              ? error.message
              : "It may have expired or already been used."
          }
          extra={
            <Button type="primary" onClick={() => navigate(paths.dashboard)}>
              Go to Slyde HQ
            </Button>
          }
        />
      </div>
    );
  }

  return (
    <AuthLayout
      background={<ThreeDMarquee images={loginMarqueeImages} className="h-full" />}
      title="You're invited"
      subtitle={
        <>
          <span className="font-medium text-zinc-700">{data.inviterName}</span>{" "}
          invited you to collaborate.
        </>
      }
    >
      <div className="mt-7 space-y-6">
        <div className="flex items-center gap-4 rounded-2xl border border-zinc-200 bg-white p-5">
          <Avatar
            size={48}
            icon={<TeamOutlined />}
            className="shrink-0 bg-indigo-500"
          />
          <div className="min-w-0">
            <div className="text-lg font-semibold leading-snug text-zinc-900">
              {data.workspaceName}
            </div>
            <div className="mt-0.5 text-[13px] text-zinc-500">
              Joining as <Tag className="!m-0 capitalize">{data.role}</Tag>
            </div>
          </div>
        </div>

        {isAuthed ? (
          <Button
            type="primary"
            block
            size="large"
            loading={accept.isPending}
            onClick={onAccept}
          >
            Accept invite
          </Button>
        ) : (
          <div className="space-y-3">
            <p className="text-[13px] text-zinc-500">
              Sign in or create a free account to join. We&apos;ll add you the
              moment you&apos;re in.
            </p>
            <Button
              type="primary"
              block
              size="large"
              onClick={() => navigate(paths.signup)}
            >
              Create an account to join
            </Button>
            <Button block size="large" onClick={() => navigate(paths.login)}>
              I already have an account
            </Button>
          </div>
        )}
      </div>
    </AuthLayout>
  );
};

export default InvitePage;
