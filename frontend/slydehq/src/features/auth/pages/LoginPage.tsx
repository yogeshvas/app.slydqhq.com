import {
  ArrowLeftOutlined,
  GoogleOutlined,
  MailOutlined,
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
import { useEffect, useRef, useState } from "react";
import {
  Link,
  useLocation,
  useNavigate,
  useSearchParams,
} from "react-router-dom";
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

type Step = "email" | "otp";

const LoginPage = () => {
  useDocumentTitle("Log in");
  const navigate = useNavigate();
  const location = useLocation();
  const [params] = useSearchParams();
  const { message } = AntApp.useApp();

  const requestOtp = useRequestOtp();
  const verifyOtp = useVerifyOtp();

  const [step, setStep] = useState<Step>("email");
  const [email, setEmail] = useState("");
  const [cooldown, setCooldown] = useState(0);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [otpForm] = Form.useForm<{ otp: string }>();

  // Surface OAuth failures redirected back from the backend (?error=google).
  const shownError = useRef(false);
  useEffect(() => {
    if (params.get("error") === "google" && !shownError.current) {
      shownError.current = true;
      message.error("Google sign-in failed. Please try again.");
    }
  }, [params, message]);

  // Tick down the resend cooldown once a code has been sent.
  useEffect(() => {
    if (cooldown <= 0) return;
    const id = setInterval(() => setCooldown((s) => s - 1), 1000);
    return () => clearInterval(id);
  }, [cooldown]);

  // Return the user to wherever they were headed before the auth redirect.
  const from =
    (location.state as { from?: { pathname: string } } | null)?.from?.pathname ??
    paths.dashboard;

  const sendCode = async (to: string) => {
    try {
      await requestOtp.mutateAsync({ email: to });
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
      await verifyOtp.mutateAsync({ email, otp });
      navigate(from, { replace: true });
    } catch (error) {
      message.error(
        isApiError(error) ? error.message : "That code didn't work. Try again.",
      );
      otpForm.resetFields(["otp"]);
    }
  };

  const changeEmail = () => {
    setStep("email");
    setCooldown(0);
    otpForm.resetFields();
  };

  const onGoogle = () => {
    setGoogleLoading(true);
    redirectToGoogle();
  };

  return (
    <AuthLayout
      background={<ThreeDMarquee images={loginMarqueeImages} className="h-full" />}
      title={step === "email" ? "Sign in" : "Check your email"}
      subtitle={
        step === "email" ? (
          "Enter your email and we'll send you a one-time code."
        ) : (
          <>
            We sent a {OTP_LENGTH}-digit code to{" "}
            <span className="font-medium text-zinc-700">{email}</span>.
          </>
        )
      }
      footer={
        step === "email" ? (
          <>
            No account yet? Just enter your email — we&apos;ll set you up.{" "}
            <Link to={paths.signup} className="font-medium">
              Learn more
            </Link>
          </>
        ) : undefined
      }
    >
      <ConfigProvider theme={{ token: { fontSize: 14, controlHeight: 40 } }}>
        {step === "email" ? (
          <Form
            layout="vertical"
            requiredMark={false}
            onFinish={({ email: value }: { email: string }) => sendCode(value)}
            className="mt-7"
            disabled={requestOtp.isPending}
          >
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
                autoFocus
              />
            </Form.Item>

            <Form.Item style={{ marginBottom: 0, marginTop: 12 }}>
              <Button
                type="primary"
                htmlType="submit"
                block
                loading={requestOtp.isPending}
              >
                Send code
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
                Verify &amp; sign in
              </Button>
            </Form.Item>

            <div className="mt-4 flex items-center justify-between">
              <Button
                type="link"
                size="small"
                icon={<ArrowLeftOutlined />}
                onClick={changeEmail}
                style={{ padding: 0 }}
              >
                Change email
              </Button>
              <Button
                type="link"
                size="small"
                disabled={cooldown > 0 || requestOtp.isPending}
                loading={requestOtp.isPending}
                onClick={() => sendCode(email)}
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

export default LoginPage;
