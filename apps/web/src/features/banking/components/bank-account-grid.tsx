import type { BankAccount } from "../types";

export function BankAccountGrid({ accounts }: { accounts: BankAccount[] }) {
  return (
    <section className="banking-card-grid">
      {accounts.map((account) => (
        <article className="panel banking-account-card" key={account.id}>
          <div>
            <span className="banking-account-icon">▰</span>
            <span className={`role-badge ${account.isActive ? "" : "muted"}`}>
              {account.isActive ? "Active" : "Inactive"}
            </span>
          </div>
          <h3>{account.displayName}</h3>
          <p>
            {account.bankName} · {account.maskedIdentifier}
          </p>
          <footer>
            <strong>{account.currency}</strong>
            <span>
              {account.accountHolder}
              {account.isDefault ? " · Default" : ""}
            </span>
          </footer>
        </article>
      ))}
      {!accounts.length && (
        <section className="panel empty-state">
          <h3>No bank accounts</h3>
          <p>Add a masked account before importing a statement.</p>
        </section>
      )}
    </section>
  );
}
