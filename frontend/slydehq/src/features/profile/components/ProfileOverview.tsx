import { useEffect, useRef, useState } from "react";
import { CameraOutlined, UserOutlined } from "@ant-design/icons";
import { App as AntApp, Avatar, Button, Input, Spin, Switch, Tag } from "antd";
import { useNavigate } from "react-router-dom";
import { isApiError } from "@/lib/api-client";
import { useWorkspace } from "@/features/workspace/hooks/use-workspace";
import { useSuggestionPrefs } from "@/features/dashboard/suggestions";
import { profileApi } from "../api/profile.api";
import { useProfile, useUpdateProfile } from "../hooks/use-profile";

const ACCEPT = "image/png,image/jpeg,image/webp,image/avif";

/** Settings → Overview: edit display name + profile photo, plus preferences. */
export function ProfileOverview() {
  const { message } = AntApp.useApp();
  const navigate = useNavigate();
  const { data: workspace } = useWorkspace();
  const { data: profile, isLoading } = useProfile();
  const update = useUpdateProfile();
  const suggestionsOn = useSuggestionPrefs((s) => s.enabled);
  const setSuggestionsOn = useSuggestionPrefs((s) => s.setEnabled);

  const [name, setName] = useState("");
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (profile) setName(profile.name);
  }, [profile?.name]); // eslint-disable-line react-hooks/exhaustive-deps

  const dirty = profile && name.trim() && name.trim() !== profile.name;

  const saveName = async () => {
    if (!dirty) return;
    try {
      await update.mutateAsync({ name: name.trim() });
      message.success("Name updated.");
    } catch (e) {
      message.error(isApiError(e) ? e.message : "Couldn't update name.");
    }
  };

  const onAvatar = async (file?: File) => {
    if (!file) return;
    setUploading(true);
    try {
      const url = await profileApi.uploadAvatar(file);
      await update.mutateAsync({ avatar: url });
      message.success("Photo updated.");
    } catch (e) {
      message.error(isApiError(e) ? e.message : "Couldn't update photo.");
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  if (isLoading) {
    return (
      <div className="grid place-items-center py-12">
        <Spin />
      </div>
    );
  }

  const initials = profile?.name?.slice(0, 2).toUpperCase() ?? "U";

  return (
    <div className="max-w-3xl space-y-6">
      {/* Identity card */}
      <div className="rounded-xl border border-zinc-200 p-5">
        <div className="flex items-center gap-4">
          {/* Avatar with hover-to-change */}
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            className="group relative shrink-0 rounded-full"
            title="Change photo"
          >
            <Avatar
              size={64}
              src={profile?.avatar || undefined}
              icon={!profile?.avatar ? <UserOutlined /> : undefined}
              className="bg-amber-400 text-xl text-zinc-900"
            >
              {!profile?.avatar ? initials : null}
            </Avatar>
            <span className="absolute inset-0 grid place-items-center rounded-full bg-black/45 text-white opacity-0 transition group-hover:opacity-100">
              {uploading ? <Spin size="small" /> : <CameraOutlined />}
            </span>
          </button>
          <input
            ref={fileRef}
            type="file"
            accept={ACCEPT}
            hidden
            onChange={(e) => void onAvatar(e.target.files?.[0])}
          />

          <div className="min-w-0 flex-1">
            <div className="text-[12px] font-medium text-zinc-500">Display name</div>
            <div className="mt-1 flex max-w-sm gap-2">
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                onPressEnter={() => void saveName()}
                maxLength={60}
                placeholder="Your name"
              />
              <Button
                type="primary"
                disabled={!dirty}
                loading={update.isPending}
                onClick={() => void saveName()}
              >
                Save
              </Button>
            </div>
            <div className="mt-1.5 text-[13px] text-zinc-400">{profile?.email}</div>
          </div>

          <Tag className="self-start capitalize">{workspace?.plan ?? "free"} plan</Tag>
        </div>
      </div>

      {/* Upgrade CTA (free only) */}
      {workspace?.plan !== "pro" && (
        <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-zinc-300 px-5 py-4">
          <div>
            <div className="font-semibold text-zinc-900">
              Get more out of Slyde HQ with Pro
            </div>
            <div className="text-sm text-zinc-500">
              More AI credits, members, API access, and custom branding.
            </div>
          </div>
          <Button type="primary" onClick={() => navigate("/settings/billing")}>
            Upgrade to Pro
          </Button>
        </div>
      )}

      {/* Preferences */}
      <div className="flex items-center justify-between rounded-xl border border-zinc-200 px-5 py-4">
        <div>
          <div className="font-semibold text-zinc-900">Assistant suggestions</div>
          <div className="text-sm text-zinc-500">
            Show the friendly guide with deck ideas on your dashboard.
          </div>
        </div>
        <Switch checked={suggestionsOn} onChange={setSuggestionsOn} />
      </div>
    </div>
  );
}
