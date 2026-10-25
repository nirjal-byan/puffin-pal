import type { ComponentProps } from "react";
import { FinancialPanel } from "./financial-panel";
import FinancialLayout from "./invoices-layout";
export default function FinancialPage(props: Omit<ComponentProps<typeof FinancialPanel>, "tab">) {
  return (
    <FinancialLayout>
      <FinancialPanel {...props} tab="invoices" />
    </FinancialLayout>
  );
}
