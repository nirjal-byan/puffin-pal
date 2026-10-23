"use client";

import type { Permission } from "@puffinpal/permissions";
import type { WorkspaceApi } from "../../../lib/api";
import { PayrollAutomation } from "./payroll-automation";
import { PayrollStatutory } from "./payroll-statutory";

export default function PayrollAutomationPage({
  api,
  permissions,
  onSaved,
}: {
  api: WorkspaceApi;
  permissions: readonly Permission[];
  onSaved: (message: string) => void;
}) {
  return (
    <div className="payroll-settings-page">
      <PayrollAutomation
        api={api}
        permissions={permissions}
        onSaved={onSaved}
        onRunsChanged={async () => undefined}
      />
      {permissions.includes("payroll:manage") && <PayrollStatutory api={api} />}
    </div>
  );
}
