import {
  ArrowLeftOutlined,
  GoogleOutlined,
  MailOutlined,
  UserOutlined,
} from "@ant-design/icons";
import {
  Alert,
  App as AntApp,
  Button,
  ConfigProvider,
  Divider,
  Form,
  Input,
} from "antd";
import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import AuthLayout from "@/components/layout/AuthLayout";
import { ThreeDMarquee } from "@/components/ui/3d-marquee";
import { isApiError } from "@/lib/api-client";
import { paths } from "@/routes/paths";
import { useDocumentTitle } from "@/lib/use-document-title";
import { loginMarqueeImages } from "../login-marquee-images";
import { useRequestOtp, useVerifyOtp } from "../hooks/use-auth";
import { redirectToGoogle } from "../google-auth";

const OTP_LENGTH = 6;
const RESEND_COOLDOWN_SECONDS = 60; // mirrors backend OTP_RESEND_COOLDOWN_SECONDS

type Step = "details" | "otp";

const SignupPage = () => {
  useDocumentTitle("Sign up");
  const navigate = useNavigate();
  const { message } = AntApp.useApp();

  const requestOtp = useRequestOtp();
  const verifyOtp = useVerifyOtp();

  const [step, setStep] = useState<Step>("details");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [cooldown, setCooldown] = useState(0);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [otpForm] = Form.useForm<{ otp: string }>();

  // Tick down the resend cooldown once a code has been sent.
  useEffect(() => {
    if (cooldown <= 0) return;
    const id = setInterval(() => setCooldown((s) => s - 1), 1000);
    return () => clearInterval(id);
  }, [cooldown]);

  const onGoogle = () => {
    setGoogleLoading(true);
    redirectToGoogle();
  };

  const sendCode = async (to: string, displayName: string) => {
    try {
      await requestOtp.mutateAsync({ email: to });
      setName(displayName);
      setEmail(to);
      setStep("otp");
      setCooldown(RESEND_COOLDOWN_SECONDS);
      message.success(`We sent a ${OTP_LENGTH}-digit code to ${to}.`);
    } catch (error) {
      message.error(
        isApiError(error) ? error.message : "Couldn't send the code. Try again.",
      );
    }
  };

  const onVerify = async ({ otp }: { otp: string }) => {
    try {
      // `name` is applied only if this is a brand-new account.
      await verifyOtp.mutateAsync({ email, otp, name });
      navigate(paths.dashboard, { replace: true });
    } catch (error) {
      message.error(
        isApiError(error) ? error.message : "That code didn't work. Try again.",
      );
      otpForm.resetFields(["otp"]);
    }
  };

  const editDetails = () => {
    setStep("details");
    setCooldown(0);
    otpForm.resetFields();
  };

  return (
    <AuthLayout
      background={<ThreeDMarquee images={loginMarqueeImages} className="h-full" />}
      title={step === "details" ? "Create your account" : "Check your email"}
      subtitle={
        step === "details" ? (
          "Start crafting proposals in minutes — no password needed."
        ) : (
          <>
            We sent a {OTP_LENGTH}-digit code to{" "}
            <span className="font-medium text-zinc-700">{email}</span>.
          </>
        )
      }
      footer={
        step === "details" ? (
          <>
            Already have an account?{" "}
            <Link to={paths.login} className="font-medium">
              Sign in
            </Link>
          </>
        ) : undefined
      }
    >
      <ConfigProvider theme={{ token: { fontSize: 14, controlHeight: 40 } }}>
        {step === "details" ? (
          <Form
            layout="vertical"
            requiredMark={false}
            onFinish={({ name: n, email: e }: { name: string; email: string }) =>
              sendCode(e, n)
            }
            className="mt-7"
            disabled={requestOtp.isPending}
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
                autoFocus
              />
            </Form.Item>

            <Form.Item
              name="email"
              label="Email"
              extra={
                <span className="text-[12px] text-zinc-400">
                  No password needed — we&apos;ll email you a {OTP_LENGTH}-digit
                  code.
                </span>
              }
              rules={[
                { required: true, message: "Please enter your email." },
                {
                  type: "email",
                  message: "That doesn't look like a valid email.",
                },
              ]}
            >
              <Input
                prefix={<MailOutlined className="text-zinc-400" />}
                placeholder="you@company.com"
                autoComplete="email"
              />
            </Form.Item>

            <Form.Item style={{ marginBottom: 0, marginTop: 12 }}>
              <Button
                type="primary"
                htmlType="submit"
                block
                loading={requestOtp.isPending}
              >
                Create account
              </Button>
            </Form.Item>

            <Divider
              plain
              style={{ margin: "16px 0", fontSize: 12, color: "#9ca3af" }}
            >
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
        ) : (
          <Form
            form={otpForm}
            layout="vertical"
            requiredMark={false}
            onFinish={onVerify}
            className="mt-7"
            disabled={verifyOtp.isPending}
          >
            <Alert
              type="info"
              showIcon
              className="mb-5"
              message={
                <span className="text-[13px]">
                  Enter the code from your email. It expires in 10 minutes.
                </span>
              }
            />

            <Form.Item
              name="otp"
              label="Verification code"
              rules={[
                { required: true, message: "Enter the code from your email." },
                { len: OTP_LENGTH, message: `The code is ${OTP_LENGTH} digits.` },
              ]}
            >
              <Input.OTP
                length={OTP_LENGTH}
                autoFocus
                // Auto-submit the moment all digits are entered.
                onChange={(value) => {
                  if (value.length === OTP_LENGTH) otpForm.submit();
                }}
              />
            </Form.Item>

            <Form.Item style={{ marginBottom: 0 }}>
              <Button
                type="primary"
                htmlType="submit"
                block
                loading={verifyOtp.isPending}
              >
                Verify &amp; create account
              </Button>
            </Form.Item>

            <div className="mt-4 flex items-center justify-between">
              <Button
                type="link"
                size="small"
                icon={<ArrowLeftOutlined />}
                onClick={editDetails}
                style={{ padding: 0 }}
              >
                Edit details
              </Button>
              <Button
                type="link"
                size="small"
                disabled={cooldown > 0 || requestOtp.isPending}
                loading={requestOtp.isPending}
                onClick={() => sendCode(email, name)}
                style={{ padding: 0 }}
              >
                {cooldown > 0 ? `Resend in ${cooldown}s` : "Resend code"}
              </Button>
            </div>
          </Form>
        )}
      </ConfigProvider>
    </AuthLayout>
  );
};

export default SignupPage;
