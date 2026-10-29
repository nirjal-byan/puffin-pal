import { useState } from "react";
import { AppModal } from "@/components/ui/app-modal";
import type { Department } from "../types/employee.types";

export function DepartmentModal({
  departments,
  isSaving,
  onSave,
  onDelete,
  onClose,
}: {
  departments: Department[];
  isSaving: boolean;
  onSave: (name: string, department?: Department) => void;
  onDelete: (department: Department) => void;
  onClose: () => void;
}) {
  const [editing, setEditing] = useState<Department | null>(null);
  const [name, setName] = useState("");
  function startEdit(department?: Department) {
    setEditing(department ?? null);
    setName(department?.name ?? "");
  }
  return (
    <AppModal title="Departments" badge="Organization" onClose={onClose}>
      <form
        className="department-form"
        onSubmit={(event) => {
          event.preventDefault();
          onSave(name, editing ?? undefined);
        }}
      >
        <label>
          {editing ? "Rename department" : "New department"}
          <input
            required
            maxLength={100}
            value={name}
            onChange={(event) => setName(event.target.value)}
          />
        </label>
        <div className="row-actions">
          <button className="button primary compact" disabled={isSaving}>
            {editing ? "Save name" : "Add department"}
          </button>
          {editing && (
            <button type="button" className="button secondary compact" onClick={() => startEdit()}>
              Cancel
            </button>
          )}
        </div>
      </form>
      <div className="department-list">
        {departments.map((department) => (
          <div key={department.id}>
            <strong>{department.name}</strong>
            <div className="row-actions">
              <button className="text-button" onClick={() => startEdit(department)}>
                Rename
              </button>
              <button className="text-button danger-text" onClick={() => onDelete(department)}>
                Delete
              </button>
            </div>
          </div>
        ))}
      </div>
    </AppModal>
  );
}
