import {
  GoogleOutlined,
  LockOutlined,
  MailOutlined,
  UserOutlined,
} from "@ant-design/icons";
import {
  App as AntApp,
  Button,
  ConfigProvider,
  Divider,
  Form,
  Input,
} from "antd";
import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import AuthLayout from "@/components/layout/AuthLayout";
import { isApiError } from "@/lib/api-client";
import { paths } from "@/routes/paths";
import { useDocumentTitle } from "@/lib/use-document-title";
import { useSignup } from "../hooks/use-auth";
import { redirectToGoogle } from "../google-auth";
import type { SignupPayload } from "../types/auth.types";

const SignupPage = () => {
  useDocumentTitle("Sign up");
  const navigate = useNavigate();
  const { message } = AntApp.useApp();
  const signup = useSignup();
  const [googleLoading, setGoogleLoading] = useState(false);

  const onGoogle = () => {
    setGoogleLoading(true);
    redirectToGoogle();
  };

  const onFinish = async (values: SignupPayload) => {
    try {
      await signup.mutateAsync(values);
      navigate(paths.dashboard, { replace: true });
    } catch (error) {
      message.error(
        isApiError(error) ? error.message : "Unable to sign up. Try again.",
      );
    }
  };

  return (
    <AuthLayout
      title="Create your account"
      subtitle="Start crafting proposals in minutes."
      footer={
        <>
          Already have an account?{" "}
          <Link to={paths.login} className="font-medium">
            Sign in
          </Link>
        </>
      }
    >
      <ConfigProvider theme={{ token: { fontSize: 14, controlHeight: 40 } }}>
        <Form<SignupPayload>
          layout="vertical"
          requiredMark={false}
          onFinish={onFinish}
          className="mt-7"
          disabled={signup.isPending}
        >
          <Form.Item
            name="name"
            label="Full name"
            rules={[{ required: true, message: "Please enter your name." }]}
          >
            <Input
              prefix={<UserOutlined className="text-zinc-400" />}
              placeholder="Jane Doe"
              autoComplete="name"
            />
          </Form.Item>

          <Form.Item
            name="email"
            label="Email"
            rules={[
              { required: true, message: "Please enter your email." },
              { type: "email", message: "That doesn't look like a valid email." },
            ]}
          >
            <Input
              prefix={<MailOutlined className="text-zinc-400" />}
              placeholder="you@company.com"
              autoComplete="email"
            />
          </Form.Item>

          <Form.Item
            name="password"
            label="Password"
            rules={[
              { required: true, message: "Please create a password." },
              { min: 8, message: "Use at least 8 characters." },
            ]}
            style={{ marginBottom: 20 }}
          >
            <Input.Password
              prefix={<LockOutlined className="text-zinc-400" />}
              placeholder="••••••••"
              autoComplete="new-password"
            />
          </Form.Item>

          <Button
            type="primary"
            htmlType="submit"
            block
            loading={signup.isPending}
          >
            Create account
          </Button>

          <Divider plain style={{ margin: "16px 0", fontSize: 12, color: "#9ca3af" }}>
            or
          </Divider>

          <Button
            block
            icon={<GoogleOutlined />}
            onClick={onGoogle}
            loading={googleLoading}
          >
            Continue with Google
          </Button>
        </Form>
      </ConfigProvider>
    </AuthLayout>
  );
};

export default SignupPage;
