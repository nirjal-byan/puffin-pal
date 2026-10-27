import type { Permission } from "@puffinpal/permissions";
import type { Client, FinancialRecord, Member, Profile, Session, WorkspaceApi } from "@/lib/api";
import type { Tab } from "@/lib/navigation";
import AccountsPayablePage from "@/features/accounts-payable/accounts-payable-page";
import BankingPage from "@/features/banking/banking-page";
import CashFlowPage from "@/features/cash-flow/components/cash-flow-page";
import ClientsPage from "@/features/clients/components/clients-page";
import OverviewPage from "@/features/dashboard/components/overview-page";
import EmployeesPage from "@/features/employees/components/employees-page";
import ExpensesPage from "@/features/expenses/components/expenses-page";
import FinancialReportsPage from "@/features/financial-reports/components/financial-reports-page";
import InvoicesPage from "@/features/invoices/components/invoices-page";
import PayrollAutomationPage from "@/features/payroll/components/automation-page";
import PayrollPage from "@/features/payroll/components/payroll-page";
import RetainersPage from "@/features/recurring-invoices/components/retainers-page";
import AccessPage from "@/features/settings/components/access-page";
import ChangePasswordPage from "@/features/settings/components/change-password-page";
import EditProfilePage from "@/features/settings/components/edit-profile-page";
import TeamPage from "@/features/team/components/team-page";
import AttendancePage from "@/features/workforce/components/attendance-page";
import LeavePage from "@/features/workforce/components/leave-page";
import OvertimePage from "@/features/workforce/components/overtime-page";
import WorkforcePage from "@/features/workforce/components/workforce-page";
import { CompanyLogoSettings } from "@/components/shared/company-logo-settings";

export function WorkspaceContent({
  session,
  tab,
  currentLabel,
  api,
  rows,
  loading,
  loadFailed,
  revision,
  offset,
  refreshing,
  navigate,
  reload,
  saved,
  notify,
  refreshAccess,
  onProfileChange,
  onError,
  onInvoicesDeleted,
}: {
  session: Session;
  tab: Tab;
  currentLabel: string;
  api: WorkspaceApi;
  rows: (Client | Member | FinancialRecord)[];
  loading: boolean;
  loadFailed: boolean;
  revision: number;
  offset: number;
  refreshing: boolean;
  navigate: (tab: Tab) => void;
  reload: () => void;
  saved: (message: string) => void;
  notify: (message: string) => void;
  refreshAccess: () => void;
  onProfileChange: (profile: Profile) => void;
  onError: (failure: unknown) => void;
  onInvoicesDeleted: () => void;
}) {
  const can = (permission: Permission) => session.permissions.includes(permission);
  const settings = tab === "password" ? ChangePasswordPage : EditProfilePage;
  const CurrentSettingsPage = settings;
  if (tab === "overview") return <OverviewPage session={session} navigate={navigate} api={api} />;
  if (tab === "profile" || tab === "password")
    return (
      <div
        className={
          tab === "profile" && can("organization:update") ? "profile-settings-columns" : undefined
        }
      >
        <CurrentSettingsPage
          key={tab}
          user={session.user}
          api={api}
          onProfileChange={onProfileChange}
          onSaved={notify}
        />
        {tab === "profile" && can("organization:update") && (
          <CompanyLogoSettings
            organization={session.organization}
            api={api}
            onProfileChange={onProfileChange}
            onSaved={notify}
          />
        )}
      </div>
    );
  if (tab === "access")
    return <AccessPage session={session} refreshAccess={refreshAccess} refreshing={refreshing} />;
  if (tab === "expenses")
    return (
      <ExpensesPage
        api={api}
        currency={session.organization.currency}
        permissions={session.permissions}
        onSaved={notify}
        onError={onError}
      />
    );
  if (tab === "retainers")
    return (
      <RetainersPage
        api={api}
        currency={session.organization.currency}
        permissions={session.permissions}
        onSaved={notify}
      />
    );
  if (tab === "employees")
    return (
      <EmployeesPage
        api={api}
        currency={session.organization.currency}
        permissions={session.permissions}
        onSaved={notify}
      />
    );
  if (tab === "workforce")
    return <WorkforcePage api={api} permissions={session.permissions} onSaved={notify} />;
  if (tab === "payroll")
    return <PayrollPage api={api} permissions={session.permissions} onSaved={notify} />;
  if (tab === "payroll-automation")
    return <PayrollAutomationPage api={api} permissions={session.permissions} onSaved={notify} />;
  if (tab === "attendance")
    return <AttendancePage api={api} permissions={session.permissions} onSaved={notify} />;
  if (tab === "leave")
    return <LeavePage api={api} permissions={session.permissions} onSaved={notify} />;
  if (tab === "overtime")
    return <OvertimePage api={api} permissions={session.permissions} onSaved={notify} />;
  if (tab === "cash-flow")
    return <CashFlowPage api={api} permissions={session.permissions} onSaved={notify} />;
  if (tab === "banking")
    return <BankingPage api={api} permissions={session.permissions} onSaved={notify} />;
  if (tab === "reports")
    return (
      <FinancialReportsPage
        api={api}
        currency={session.organization.currency}
        permissions={session.permissions}
        onError={onError}
      />
    );
  if (tab === "vendors" || tab === "accounts-payable")
    return (
      <AccountsPayablePage
        key={tab}
        api={api}
        permissions={session.permissions}
        initialView={tab === "vendors" ? "vendors" : "bills"}
        onSaved={notify}
      />
    );
  if (loading)
    return (
      <section className="panel loading" role="status">
        <span className="spinner" />
        Loading {currentLabel.toLowerCase()}…
      </section>
    );
  if (loadFailed)
    return (
      <section className="panel empty-state">
        <h3>We couldn’t load these records</h3>
        <p>Check the message above and try again.</p>
        <button type="button" className="button secondary" onClick={reload}>
          Try again
        </button>
      </section>
    );
  return (
    <>
      {tab === "clients" && (
        <ClientsPage
          key={`${revision}-${offset}`}
          clients={rows as Client[]}
          canCreate={can("clients:create")}
          canUpdate={can("clients:update")}
          canDelete={can("clients:delete")}
          api={api}
          onSaved={saved}
          onError={onError}
        />
      )}
      {tab === "members" && (
        <TeamPage
          members={rows as Member[]}
          role={session.role}
          api={api}
          onSaved={saved}
          onError={onError}
        />
      )}
      {tab === "invoices" && (
        <InvoicesPage
          key={`${tab}-${revision}-${offset}`}
          rows={rows as FinancialRecord[]}
          currency={session.organization.currency}
          permissions={session.permissions}
          onDeleted={onInvoicesDeleted}
          api={api}
        />
      )}
    </>
  );
}
