import { Button, ConfigProvider, type ButtonProps } from "antd";
import { bs, bsDarkText, type BsVariant } from "@/config/theme";

type Props = Omit<ButtonProps, "color" | "variant" | "type"> & {
  /** Bootstrap semantic color: primary | success | danger | … */
  bsVariant?: BsVariant;
  /** Render the outline variant (btn-outline-*). */
  outline?: boolean;
};

// A Bootstrap-accurate button. antd's global theme only carries ONE colorPrimary,
// so for the other 7 semantic colors we override colorPrimary in a nested
// ConfigProvider scoped to just this button, then use the v6 color/variant API.
export function BootstrapButton({
  bsVariant = "primary",
  outline = false,
  style,
  ...rest
}: Props) {
  const c = bs[bsVariant];
  const darkText = bsDarkText.includes(bsVariant);

  return (
    <ConfigProvider
      theme={{
        token: {
          colorPrimary: c.base,
          colorPrimaryHover: c.hover,
          colorPrimaryActive: c.active,
          colorPrimaryBorder: c.base,
        },
      }}
    >
      <Button
        color="primary"
        variant={outline ? "outlined" : "solid"}
        // Solid warning/info/light need dark text (Bootstrap does the same).
        style={!outline && darkText ? { color: "#212529", ...style } : style}
        {...rest}
      />
    </ConfigProvider>
  );
}
