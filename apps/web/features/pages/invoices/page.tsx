import type { ComponentProps } from "react";
import { FinancialPanel } from "../../../components/financial-panel";
import FinancialLayout from "./layout";
export default function FinancialPage(props: Omit<ComponentProps<typeof FinancialPanel>, "tab">) {
  return (
    <FinancialLayout>
      <FinancialPanel {...props} tab="invoices" />
    </FinancialLayout>
  );
}
