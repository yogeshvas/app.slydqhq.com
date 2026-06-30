import { useEffect, useRef, useState } from "react";
import { ArrowLeftOutlined, LockOutlined } from "@ant-design/icons";
import { App as AntApp, Button, Spin } from "antd";
import { useNavigate, useSearchParams } from "react-router-dom";
import { isApiError } from "@/lib/api-client";
import { paths } from "@/routes/paths";
import { useDocumentTitle } from "@/lib/use-document-title";
import { useAuthStore } from "@/features/auth/store/auth.store";
import { openCheckout } from "@/lib/razorpay";
import { billingApi } from "../api/billing.api";

/**
 * Dedicated, clean white checkout page. The busy app chrome (gradient, sidebar)
 * stays off this screen so the Razorpay modal sits on a calm background. It reads
 * the intent (?type=pack&pack=… or ?type=pro), creates the order/subscription, and
 * opens Razorpay Checkout. Returns to billing on success/cancel.
 */
const PaymentPage = () => {
  useDocumentTitle("Checkout");
  const navigate = useNavigate();
  const { message } = AntApp.useApp();
  const user = useAuthStore((s) => s.user);
  const [params] = useSearchParams();
  const type = params.get("type"); // "pack" | "pro"
  const packId = params.get("pack") ?? "";
  const [status, setStatus] = useState<"starting" | "open" | "error">("starting");
  const started = useRef(false);
  const paid = useRef(false);

  const back = () => navigate(paths.billing);
  const onCancel = () => {
    if (!paid.current) message.info("Payment cancelled.");
    back();
  };

  useEffect(() => {
    if (started.current) return;
    started.current = true;

    const run = async () => {
      try {
        if (type === "pack") {
          const order = await billingApi.recharge(packId);
          setStatus("open");
          await openCheckout({
            keyId: order.keyId ?? "",
            amount: order.amount,
            currency: order.currency,
            orderId: order.orderId,
            name: "Slyde HQ",
            description: `${order.credits} credits`,
            prefill: { email: user?.email, name: user?.name },
            onSuccess: () => {
              paid.current = true;
              message.success(`Payment successful — ${order.credits} credits added!`);
              setTimeout(back, 1200);
            },
            onFailure: (reason) => {
              paid.current = true; // suppress the dismiss "cancelled" toast
              message.error(reason ? `Payment failed: ${reason}` : "Payment failed.");
            },
            onDismiss: onCancel,
          });
        } else if (type === "pro") {
          const sub = await billingApi.subscribe();
          setStatus("open");
          await openCheckout({
            keyId: sub.keyId ?? "",
            currency: "INR",
            subscriptionId: sub.subscriptionId,
            name: "Slyde HQ Pro",
            description: "Monthly subscription",
            prefill: { email: user?.email, name: user?.name },
            onSuccess: () => {
              paid.current = true;
              message.success("🎉 Welcome to Pro! Activating your plan…");
              setTimeout(back, 1500);
            },
            onFailure: (reason) => {
              paid.current = true;
              message.error(reason ? `Payment failed: ${reason}` : "Payment failed.");
            },
            onDismiss: onCancel,
          });
        } else {
          back();
        }
      } catch (e) {
        setStatus("error");
        message.error(isApiError(e) ? e.message : "Couldn't start checkout.");
      }
    };
    void run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="grid min-h-screen place-items-center bg-white px-4">
      <div className="w-full max-w-sm text-center">
        <div className="mb-6 text-[18px] font-bold text-indigo-600">Slyde HQ</div>
        {status === "error" ? (
          <>
            <p className="text-[14px] text-zinc-600">
              We couldn’t start the payment. Please try again.
            </p>
            <Button className="!mt-4" onClick={back} icon={<ArrowLeftOutlined />}>
              Back to billing
            </Button>
          </>
        ) : (
          <>
            <Spin size="large" />
            <p className="mt-5 text-[14px] text-zinc-600">
              {status === "starting"
                ? "Preparing your secure checkout…"
                : "Complete the payment in the window."}
            </p>
            <p className="mt-2 flex items-center justify-center gap-1.5 text-[12px] text-zinc-400">
              <LockOutlined /> Secured by Razorpay
            </p>
            <Button type="text" className="!mt-6 !text-zinc-400" onClick={onCancel}>
              Cancel
            </Button>
          </>
        )}
      </div>
    </div>
  );
};

export default PaymentPage;
