import type { ReactNode } from "react";

interface PageHeaderProps {
  title: string;
  description?: string;
  badge?: string;
  actions?: ReactNode;
}

export function PageHeader({ title, description, badge, actions }: PageHeaderProps): React.ReactElement {
  return (
    <header className="flex flex-wrap items-end justify-between gap-4">
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <h1 className="font-display text-2xl font-semibold text-forest-800">{title}</h1>
          {badge && (
            <span className="rounded-full bg-forest-100 px-2.5 py-0.5 text-xs font-semibold text-forest-700">
              {badge}
            </span>
          )}
        </div>
        {description && <p className="mt-1 text-sm text-charcoal-400">{description}</p>}
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </header>
  );
}

type Tone = "forest" | "lagoon" | "bamboo" | "rose" | "charcoal";

const TONE_ICON: Record<Tone, string> = {
  forest: "text-forest-600",
  lagoon: "text-lagoon-500",
  bamboo: "text-bamboo-500",
  rose: "text-rose-500",
  charcoal: "text-charcoal-400",
};

interface StatCardProps {
  label: string;
  value: ReactNode;
  hint?: string;
  icon?: ReactNode;
  tone?: Tone;
  onClick?: () => void;
  active?: boolean;
}

/** การ์ดสถิติสไตล์เทมเพลต: ตัวเลขใหญ่ + ไอคอนเส้นบางมุมขวา บนพื้นขาวเงาอ่อน */
export function StatCard({ label, value, hint, icon, tone = "forest", onClick, active }: StatCardProps): React.ReactElement {
  const Comp = onClick ? "button" : "div";
  return (
    <Comp
      type={onClick ? "button" : undefined}
      onClick={onClick}
      className={`flex w-full items-center justify-between gap-3 rounded-2xl bg-white p-5 text-left shadow-panel ring-1 transition ${
        active ? "ring-forest-600" : "ring-transparent"
      } ${onClick ? "hover:ring-forest-200" : ""}`}
    >
      <div className="min-w-0">
        <p className="text-xs font-medium text-charcoal-400">{label}</p>
        <p className="mt-1 font-display text-2xl font-semibold text-charcoal-800">{value}</p>
        {hint && <p className="mt-0.5 text-xs text-charcoal-400">{hint}</p>}
      </div>
      {icon && <span className={`shrink-0 [&>svg]:h-9 [&>svg]:w-9 [&>svg]:stroke-[1.25] ${TONE_ICON[tone]}`}>{icon}</span>}
    </Comp>
  );
}

interface PanelProps {
  title?: string;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
}

/** กล่องเนื้อหามาตรฐาน (พื้นขาว มุมมน เงาอ่อน) */
export function Panel({ title, actions, children, className = "" }: PanelProps): React.ReactElement {
  return (
    <section className={`rounded-2xl bg-white p-5 shadow-panel ${className}`}>
      {(title || actions) && (
        <div className="mb-4 flex items-center justify-between gap-3">
          {title && <h2 className="font-display text-base font-semibold text-forest-800">{title}</h2>}
          {actions}
        </div>
      )}
      {children}
    </section>
  );
}
