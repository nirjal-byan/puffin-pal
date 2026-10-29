import type { BankImport } from "../types";

export function BankImportsTable({ imports }: { imports: BankImport[] }) {
  return (
    <section className="panel banking-table-panel">
      <header>
        <div>
          <h3>Import history</h3>
          <p>Every confirmed file is retained as an auditable batch.</p>
        </div>
      </header>
      <div className="table-scroll">
        <table className="banking-table">
          <thead>
            <tr>
              <th>File</th>
              <th>Date</th>
              <th>Rows</th>
              <th>Imported</th>
              <th>Duplicates</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {imports.map((row) => (
              <tr key={row.id}>
                <td>
                  <strong>{row.fileName}</strong>
                </td>
                <td>{new Date(row.createdAt).toLocaleString()}</td>
                <td>{row.rowCount}</td>
                <td>{row.importedCount}</td>
                <td>{row.duplicateCount}</td>
                <td>
                  <span className="status-pill matched">{row.status.replaceAll("_", " ")}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
