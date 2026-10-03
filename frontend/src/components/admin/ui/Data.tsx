"use client";

import { useEffect, type ReactNode } from "react";
import { X } from "lucide-react";

export interface Column<T> {
  key: string;
  header: string;
  className?: string;
  render: (row: T) => ReactNode;
}

interface DataTableProps<T> {
  columns: Column<T>[];
  rows: T[];
  rowKey: (row: T) => string | number;
  empty?: ReactNode;
}

/** ตารางมาตรฐาน: หัวตารางเล็กสีเทา แถวแบ่งด้วยเส้นบาง ไม่มีขอบหนัก */
export function DataTable<T>({ columns, rows, rowKey, empty }: DataTableProps<T>): React.ReactElement {
  if (rows.length === 0 && empty) return <>{empty}</>;
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[720px] text-left text-sm">
        <thead>
          <tr className="border-b border-charcoal-100 text-xs font-medium text-charcoal-400">
            {columns.map((c) => (
              <th key={c.key} className={`px-4 py-3 font-medium ${c.className ?? ""}`}>
                {c.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={rowKey(row)} className="border-b border-charcoal-50 last:border-0 hover:bg-cream-100/60">
              {columns.map((c) => (
                <td key={c.key} className={`px-4 py-3 align-middle text-charcoal-700 ${c.className ?? ""}`}>
                  {c.render(row)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

interface FormFieldProps {
  label: string;
  htmlFor?: string;
  hint?: string;
  error?: string;
  required?: boolean;
  children: ReactNode;
}

export function FormField({ label, htmlFor, hint, error, required, children }: FormFieldProps): React.ReactElement {
  return (
    <div className="space-y-1.5">
      <label htmlFor={htmlFor} className="block text-sm font-medium text-charcoal-700">
        {label}
        {required && <span className="ml-0.5 text-rose-500">*</span>}
      </label>
      {children}
      {error ? (
        <p className="text-xs text-rose-600">{error}</p>
      ) : (
        hint && <p className="text-xs text-charcoal-400">{hint}</p>
      )}
    </div>
  );
}

interface ModalProps {
  open: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
  widthClass?: string;
}

export function Modal({ open, title, onClose, children, footer, widthClass = "max-w-lg" }: ModalProps): React.ReactElement | null {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-forest-950/40" onClick={onClose} />
      <div role="dialog" aria-modal="true" aria-label={title} className={`relative max-h-[90vh] w-full overflow-y-auto rounded-2xl bg-white shadow-2xl ${widthClass}`}>
        <div className="flex items-center justify-between border-b border-charcoal-100 px-6 py-4">
          <h3 className="font-display text-lg font-semibold text-forest-800">{title}</h3>
          <button type="button" onClick={onClose} aria-label="ปิด" className="rounded-lg p-1 text-charcoal-400 hover:bg-charcoal-50">
            <X size={18} />
          </button>
        </div>
        <div className="px-6 py-5">{children}</div>
        {footer && <div className="flex justify-end gap-2 border-t border-charcoal-100 px-6 py-4">{footer}</div>}
      </div>
    </div>
  );
}
