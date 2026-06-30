import { useMemo } from "react";
import { App as AntApp, Form, Input, Modal, Select } from "antd";
import { isApiError } from "@/lib/api-client";
import { useSendFeedback } from "./use-feedback";

interface Props {
  open: boolean;
  onClose: () => void;
}

const CATEGORIES = [
  { value: "Bug", label: "🐞 I found a bug (squash it!)" },
  { value: "Idea", label: "💡 I have a genius idea" },
  { value: "Question", label: "❓ I have a question" },
  { value: "Love", label: "❤️ Just here to say hi" },
  { value: "Other", label: "💬 Something else entirely" },
];

// The cat asks for feedback in a slightly different mood each time it opens.
const PLACEHOLDERS = [
  "Tell us anything… the cat is listening (and judging, a little).",
  "Spotted a bug? Describe the crime scene 🕵️",
  "Wild idea? We love wild ideas. Type it before it escapes.",
  "Be honest — the cat can handle constructive criticism. Probably.",
  "What would make Slyde HQ 10× better for you?",
];

const SUCCESS_LINES = [
  "Message sent! The cat is on it. 🐾",
  "Got it! The cat carried your note to the team. 📨",
  "Sent! You've made one developer (and one cat) very happy. 😺",
];

const pick = <T,>(arr: T[]): T => arr[Math.floor(Math.random() * arr.length)]!;

/** A playful support/feedback form — delivered server-side to the team inbox. */
export function FeedbackModal({ open, onClose }: Props) {
  const { message } = AntApp.useApp();
  const [form] = Form.useForm<{ category: string; message: string }>();
  const send = useSendFeedback();

  // Freeze one random placeholder per opening so it doesn't flicker on re-render.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const placeholder = useMemo(() => pick(PLACEHOLDERS), [open]);

  const onSubmit = async (values: { category: string; message: string }) => {
    try {
      await send.mutateAsync(values);
      message.success(pick(SUCCESS_LINES));
      form.resetFields();
      onClose();
    } catch (error) {
      message.error(
        isApiError(error)
          ? error.message
          : "The cat dropped your message 🙀 — try again?",
      );
    }
  };

  return (
    <Modal
      open={open}
      onCancel={onClose}
      title={null}
      okText="Send it 🚀"
      cancelText="Maybe later"
      onOk={() => form.submit()}
      confirmLoading={send.isPending}
      destroyOnHidden
      width={460}
    >
      {/* Mascot + heading */}
      <div className="relative -mx-6 -mt-4 mb-4 overflow-hidden rounded-t-lg bg-gradient-to-br from-indigo-50 to-sky-50 px-6 pb-5 pt-6">
        <img
          src="/cat.png"
          alt=""
          aria-hidden
          className="cat-peek pointer-events-none absolute -bottom-1 right-3 w-20 select-none drop-shadow-md"
        />
        <div className="max-w-[78%]">
          <h3 className="!m-0 text-[17px] font-semibold text-zinc-900">
            Pssst… got feedback? 🐱
          </h3>
          <p className="!mb-0 mt-1 text-[13px] text-zinc-500">
            Bugs, ideas, or just a hello — it lands straight in our inbox and we
            read every single one.
          </p>
        </div>
      </div>

      <Form
        form={form}
        layout="vertical"
        requiredMark={false}
        onFinish={onSubmit}
        initialValues={{ category: "Idea" }}
      >
        <Form.Item name="category" label="What's the vibe?">
          <Select options={CATEGORIES} />
        </Form.Item>
        <Form.Item
          name="message"
          label="Spill the beans"
          rules={[
            { required: true, message: "The cat needs at least a few words 🐾" },
            { min: 5, message: "A liiittle more detail, please." },
          ]}
        >
          <Input.TextArea rows={5} maxLength={2000} showCount placeholder={placeholder} />
        </Form.Item>
      </Form>
    </Modal>
  );
}
