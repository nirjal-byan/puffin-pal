import { Dropdown } from "@/components/ui/dropdown";
import { EXPENSE_CATEGORIES } from "../types";

export interface ExpenseFiltersValue {
  search: string;
  category: string;
  approvalStatus: string;
  period: string;
  sort: string;
  order: string;
}

export function ExpenseFilters({
  value,
  canCreate,
  onChange,
  onApply,
  onCreate,
}: {
  value: ExpenseFiltersValue;
  canCreate: boolean;
  onChange: (value: ExpenseFiltersValue) => void;
  onApply: () => void;
  onCreate: () => void;
}) {
  return (
    <section className="panel expense-filters">
      <form
        onSubmit={(event) => {
          event.preventDefault();
          onApply();
        }}
      >
        <label>
          Search
          <input
            value={value.search}
            onChange={(event) => onChange({ ...value, search: event.target.value })}
            placeholder="Title, vendor or notes"
          />
        </label>
        <label>
          Category
          <Dropdown
            name="categoryFilter"
            label="Category"
            value={value.category}
            onChange={(category) => onChange({ ...value, category })}
            searchable={false}
            options={[
              { value: "", label: "All categories" },
              ...EXPENSE_CATEGORIES.map((category) => ({ value: category, label: category })),
            ]}
          />
        </label>
        <label>
          Status
          <Dropdown
            name="statusFilter"
            label="Status"
            value={value.approvalStatus}
            onChange={(approvalStatus) => onChange({ ...value, approvalStatus })}
            searchable={false}
            options={[
              { value: "", label: "All statuses" },
              { value: "DRAFT", label: "Draft" },
              { value: "PENDING_APPROVAL", label: "Pending approval" },
              { value: "APPROVED", label: "Approved" },
              { value: "REJECTED", label: "Rejected" },
            ]}
          />
        </label>
        <label>
          Period
          <Dropdown
            name="periodFilter"
            label="Period"
            value={value.period}
            onChange={(period) => onChange({ ...value, period })}
            searchable={false}
            options={[
              { value: "", label: "All time" },
              { value: "last7", label: "Last 7 days" },
              { value: "last30", label: "Last 30 days" },
              { value: "thisMonth", label: "This month" },
              { value: "lastMonth", label: "Last month" },
              { value: "thisYear", label: "This year" },
            ]}
          />
        </label>
        <label>
          Sort
          <Dropdown
            name="sortFilter"
            label="Sort"
            value={`${value.sort}:${value.order}`}
            onChange={(next) => {
              const [sort, order] = next.split(":");
              onChange({ ...value, sort: sort!, order: order! });
            }}
            searchable={false}
            options={[
              { value: "date:desc", label: "Newest expense" },
              { value: "date:asc", label: "Oldest expense" },
              { value: "amount:desc", label: "Highest amount" },
              { value: "amount:asc", label: "Lowest amount" },
              { value: "title:asc", label: "Title A–Z" },
            ]}
          />
        </label>
        <button className="button secondary" type="submit">
          Apply filters
        </button>
        {canCreate && (
          <button className="button primary" type="button" onClick={onCreate}>
            + Create Expense
          </button>
        )}
      </form>
    </section>
  );
}
