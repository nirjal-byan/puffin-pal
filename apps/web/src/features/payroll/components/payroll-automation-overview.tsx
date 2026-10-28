import type { PayrollNotification, PayrollSchedule, PayrollScheduleOccurrence } from "../types";

export function PayrollAutomationActions({
  schedule,
  busy,
  onEdit,
  onTransition,
  onGenerate,
}: {
  schedule: PayrollSchedule | null;
  busy: boolean;
  onEdit: () => void;
  onTransition: () => void;
  onGenerate: () => void;
}) {
  return (
    <div className="form-actions">
      {schedule ? (
        <>
          <button className="button secondary" onClick={onEdit}>
            Edit
          </button>
          <button className="button secondary" disabled={busy} onClick={onTransition}>
            {schedule.status === "ACTIVE" ? "Pause" : "Resume"}
          </button>
          {schedule.status === "ACTIVE" && (
            <button className="button primary" onClick={onGenerate}>
              Generate due draft
            </button>
          )}
        </>
      ) : (
        <button className="button primary" onClick={onEdit}>
          Set up automation
        </button>
      )}
    </div>
  );
}

export function PayrollAutomationOverview({
  schedule,
  notifications,
  onRead,
}: {
  schedule: PayrollSchedule | null;
  notifications: PayrollNotification[];
  onRead: (id: string) => void;
}) {
  if (!schedule)
    return (
      <div className="payroll-automation-empty">
        <span className="payroll-feature-icon" aria-hidden="true">
          ↻
        </span>
        <div>
          <strong>Automation is not configured</strong>
          <p>Choose a cadence and PuffinPal will prepare calculated drafts for review.</p>
        </div>
      </div>
    );
  return (
    <div className="payroll-automation-grid">
      <article className="payroll-schedule-card">
        <div>
          <span className={`status-dot ${schedule.status.toLowerCase()}`} />
          <strong>{schedule.name}</strong>
        </div>
        <dl>
          <Detail
            label="Frequency"
            value={schedule.frequency.toLowerCase().replace("biweekly", "Every two weeks")}
          />
          <Detail label="Next draft" value={new Date(schedule.nextRunAt).toLocaleString()} />
          <Detail label="Timezone" value={schedule.timezone} />
          <Detail
            label="Last generated"
            value={
              schedule.lastSuccessfulAt
                ? new Date(schedule.lastSuccessfulAt).toLocaleString()
                : "Not yet"
            }
          />
        </dl>
        <p className="muted">
          Drafts are calculated automatically. Approval, finalization, payslips, and payments always
          require authorized action.
        </p>
      </article>
      <article className="payroll-reminders">
        <div className="panel-heading">
          <h3>Reminders</h3>
          <span className="muted">
            {notifications.filter((item) => !item.readAt).length} unread
          </span>
        </div>
        {notifications.length ? (
          notifications.slice(0, 4).map((item) => (
            <button
              key={item.id}
              className={item.readAt ? "is-read" : ""}
              onClick={() => onRead(item.id)}
            >
              <strong>{item.title}</strong>
              <span>{item.message}</span>
            </button>
          ))
        ) : (
          <p className="muted payroll-empty-copy">No payroll reminders.</p>
        )}
      </article>
    </div>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}

export function PayrollAutomationHistory({ history }: { history: PayrollScheduleOccurrence[] }) {
  if (!history.length) return null;
  return (
    <div className="payroll-automation-history">
      <div className="panel-heading">
        <h3>Automation history</h3>
        <span className="muted">Latest 20 attempts</span>
      </div>
      <div className="table-scroll">
        <table>
          <thead>
            <tr>
              <th>Period</th>
              <th>Source</th>
              <th>Result</th>
              <th>Attempts</th>
              <th>Details</th>
            </tr>
          </thead>
          <tbody>
            {history.map((item) => (
              <tr key={item.id}>
                <td>
                  {item.periodStart.slice(0, 10)} – {item.periodEnd.slice(0, 10)}
                </td>
                <td>{item.source.toLowerCase()}</td>
                <td>
                  <span className="role-badge">{item.status}</span>
                </td>
                <td>{item.attempts}</td>
                <td>{item.failureMessage ?? (item.payrollRunId ? "Draft created" : "Queued")}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
