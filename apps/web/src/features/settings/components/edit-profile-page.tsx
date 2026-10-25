import type { ComponentProps } from "react";
import { SettingsPanel } from "@/components/shared/settings-panel";
import SettingsLayout from "./edit-profile-layout";
export default function SettingsPage(props: Omit<ComponentProps<typeof SettingsPanel>, "mode">) {
  return (
    <SettingsLayout>
      <SettingsPanel {...props} mode="profile" />
    </SettingsLayout>
  );
}
