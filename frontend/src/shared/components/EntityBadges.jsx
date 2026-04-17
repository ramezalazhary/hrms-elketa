import {
  Building2,
  CheckCircle2,
  Plane,
  UserMinus,
  Ban,
  MinusCircle,
  Shield,
  Users,
  Briefcase,
  UserRound,
  Crown,
  Clock,
  AlertCircle,
  LogOut,
} from "lucide-react";

/** @param {string} s */
function hashString(s) {
  let h = 0;
  const str = String(s || "");
  for (let i = 0; i < str.length; i++) h = (Math.imul(31, h) + str.charCodeAt(i)) | 0;
  return Math.abs(h);
}

const DEPT_STYLES = [
  { wrap: "bg-sky-50 text-sky-900 border-sky-200", icon: "text-sky-600" },
  { wrap: "bg-violet-50 text-violet-900 border-violet-200", icon: "text-violet-600" },
  { wrap: "bg-emerald-50 text-emerald-900 border-emerald-200", icon: "text-emerald-600" },
  { wrap: "bg-amber-50 text-amber-900 border-amber-200", icon: "text-amber-600" },
  { wrap: "bg-rose-50 text-rose-900 border-rose-200", icon: "text-rose-600" },
  { wrap: "bg-cyan-50 text-cyan-900 border-cyan-200", icon: "text-cyan-600" },
  { wrap: "bg-indigo-50 text-indigo-900 border-indigo-200", icon: "text-indigo-600" },
  { wrap: "bg-fuchsia-50 text-fuchsia-900 border-fuchsia-200", icon: "text-fuchsia-600" },
];

/**
 * Stable color per department name + building icon.
 * @param {{ name: string, className?: string }} props
 */
export function DepartmentBadge({ name, className = "" }) {
  const label = name?.trim() || "—";
  const style = DEPT_STYLES[hashString(label) % DEPT_STYLES.length];
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-md border px-2 py-0.5 text-xs font-medium ${style.wrap} ${className}`}
    >
      <Building2 className={`h-3.5 w-3.5 shrink-0 ${style.icon}`} aria-hidden />
      <span className="truncate max-w-[14rem]">{label}</span>
    </span>
  );
}

const STATUS_CONFIG = {
  ACTIVE: {
    label: "Active",
    Icon: CheckCircle2,
    className: "bg-emerald-50 text-emerald-900 border-emerald-200",
    iconClass: "text-emerald-600",
  },
  ON_LEAVE: {
    label: "On leave",
    Icon: Plane,
    className: "bg-amber-50 text-amber-900 border-amber-200",
    iconClass: "text-amber-600",
  },
  RESIGNED: {
    label: "Resigned",
    Icon: UserMinus,
    className: "bg-slate-100 text-slate-800 border-slate-200",
    iconClass: "text-slate-500",
  },
  TERMINATED: {
    label: "Terminated",
    Icon: Ban,
    className: "bg-red-50 text-red-900 border-red-200",
    iconClass: "text-red-600",
  },
  PRESENT: {
    label: "Present",
    Icon: CheckCircle2,
    className: "bg-emerald-50 text-emerald-900 border-emerald-200",
    iconClass: "text-emerald-600",
  },
  LATE: {
    label: "Late",
    Icon: Clock,
    className: "bg-amber-50 text-amber-900 border-amber-200",
    iconClass: "text-amber-600",
  },
  ABSENT: {
    label: "Absent",
    Icon: Ban,
    className: "bg-red-50 text-red-900 border-red-200",
    iconClass: "text-red-600",
  },
  EXCUSED: {
    label: "Excused",
    Icon: CheckCircle2,
    className: "bg-teal-50 text-teal-900 border-teal-200",
    iconClass: "text-teal-600",
  },
  PARTIAL_EXCUSED: {
    label: "Partial excused",
    Icon: AlertCircle,
    className: "bg-violet-50 text-violet-900 border-violet-200",
    iconClass: "text-violet-600",
  },
  EARLY_DEPARTURE: {
    label: "Early departure",
    Icon: LogOut,
    className: "bg-orange-50 text-orange-900 border-orange-200",
    iconClass: "text-orange-600",
  },
  INCOMPLETE: {
    label: "Incomplete",
    Icon: AlertCircle,
    className: "bg-yellow-50 text-yellow-900 border-yellow-200",
    iconClass: "text-yellow-600",
  },
  OVERTIME: {
    label: "Overtime",
    Icon: Clock,
    className: "bg-blue-50 text-blue-900 border-blue-200",
    iconClass: "text-blue-600",
  },
};

/**
 * Employment / record status with icon.
 * @param {{ status?: string, className?: string }} props
 */
export function StatusBadge({ status, className = "" }) {
  const key = status && STATUS_CONFIG[status] ? status : "_OTHER";
  const conf =
    key === "_OTHER"
      ? {
          label: status || "—",
          Icon: MinusCircle,
          className: "bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 border-zinc-200 dark:border-zinc-800",
          iconClass: "text-zinc-500 dark:text-zinc-400",
        }
      : STATUS_CONFIG[status];

  const Icon = conf.Icon;
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-md border px-2 py-0.5 text-xs font-medium capitalize ${conf.className} ${className}`}
    >
      <Icon className={`h-3.5 w-3.5 shrink-0 ${conf.iconClass}`} aria-hidden />
      {conf.label}
    </span>
  );
}

const ROLE_CONFIG = {
  ADMIN: {
    label: "Admin",
    Icon: Crown,
    className: "bg-violet-50 text-violet-900 border-violet-200",
    iconClass: "text-violet-600",
    statInactive:
      "border-violet-200 bg-violet-50/40 hover:bg-violet-50 hover:border-violet-300",
    statActive: "border-violet-600 bg-violet-600 shadow-md",
    statCountInactive: "text-violet-950",
    statLabelInactive: "text-violet-700",
  },
  HR_STAFF: {
    label: "HR Staff",
    Icon: Users,
    className: "bg-emerald-50 text-emerald-900 border-emerald-200",
    iconClass: "text-emerald-600",
    statInactive:
      "border-emerald-200 bg-emerald-50/40 hover:bg-emerald-50 hover:border-emerald-300",
    statActive: "border-emerald-600 bg-emerald-600 shadow-md",
    statCountInactive: "text-emerald-950",
    statLabelInactive: "text-emerald-800",
  },
  HR_MANAGER: {
    label: "HR Manager",
    Icon: Users,
    className: "bg-emerald-100 text-emerald-900 border-emerald-300",
    iconClass: "text-emerald-700",
    statInactive:
      "border-emerald-300 bg-emerald-100/40 hover:bg-emerald-100 hover:border-emerald-400",
    statActive: "border-emerald-700 bg-emerald-700 shadow-md",
    statCountInactive: "text-emerald-950",
    statLabelInactive: "text-emerald-900",
  },
  MANAGER: {
    label: "Manager",
    Icon: Briefcase,
    className: "bg-sky-50 text-sky-900 border-sky-200",
    iconClass: "text-sky-600",
    statInactive: "border-sky-200 bg-sky-50/40 hover:bg-sky-50 hover:border-sky-300",
    statActive: "border-sky-600 bg-sky-600 shadow-md",
    statCountInactive: "text-sky-950",
    statLabelInactive: "text-sky-800",
  },
  TEAM_LEADER: {
    label: "Team Leader",
    Icon: Shield,
    className: "bg-amber-50 text-amber-900 border-amber-200",
    iconClass: "text-amber-600",
    statInactive:
      "border-amber-200 bg-amber-50/40 hover:bg-amber-50 hover:border-amber-300",
    statActive: "border-amber-600 bg-amber-600 shadow-md",
    statCountInactive: "text-amber-950",
    statLabelInactive: "text-amber-800",
  },
  EMPLOYEE: {
    label: "Employee",
    Icon: UserRound,
    className: "bg-zinc-100 dark:bg-zinc-800 text-zinc-800 dark:text-zinc-200 border-zinc-200 dark:border-zinc-800",
    iconClass: "text-zinc-500 dark:text-zinc-400",
    statInactive: "border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-800/50 hover:bg-zinc-100 dark:hover:bg-zinc-800 hover:border-zinc-300",
    statActive: "border-zinc-800 bg-zinc-800 shadow-md",
    statCountInactive: "text-zinc-900 dark:text-zinc-100",
    statLabelInactive: "text-zinc-600 dark:text-zinc-400",
  },
};

function normaliseRoleKey(r) {
  const role = String(r ?? "").trim().toUpperCase();
  if (r === 3 || role === "ADMIN") return "ADMIN";
  if (r === 2 || role === "MANAGER") return "MANAGER";
  if (role === "HR") return "HR";
  if (role === "HR_MANAGER") return "HR_MANAGER";
  if (role === "HR_STAFF") return "HR_STAFF";
  if (role === "TEAM_LEADER" || role === "TEAMLEADER" || role === "TL") return "TEAM_LEADER";
  return "EMPLOYEE";
}

/**
 * System role badge with icon (accounts / permissions).
 * @param {{ role: string | number, className?: string }} props
 */
export function RoleBadge({ role, className = "" }) {
  const key = normaliseRoleKey(role);
  const conf = ROLE_CONFIG[key] ?? ROLE_CONFIG.EMPLOYEE;
  const Icon = conf.Icon;
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium ${conf.className} ${className}`}
    >
      <Icon className={`h-3.5 w-3.5 shrink-0 ${conf.iconClass}`} aria-hidden />
      {conf.label}
    </span>
  );
}

/**
 * Role filter stat card (users admin).
 * @param {{ roleKey: string, selected: boolean, count: number, onToggle: () => void }} props
 */
export function RoleStatCard({ roleKey, selected, count, onToggle }) {
  const conf = ROLE_CONFIG[roleKey] ?? ROLE_CONFIG.EMPLOYEE;
  const Icon = conf.Icon;
  return (
    <button
      type="button"
      onClick={onToggle}
      className={`group flex flex-col gap-1 rounded-lg border p-4 text-left transition-colors ${
        selected ? conf.statActive : conf.statInactive
      }`}
    >
      <span
        className={`flex items-center gap-2 text-2xl font-semibold tabular-nums ${
          selected ? "text-white" : conf.statCountInactive
        }`}
      >
        <Icon
          className={`h-5 w-5 shrink-0 ${selected ? "text-white/90" : conf.iconClass}`}
          aria-hidden
        />
        {count}
      </span>
      <span
        className={`text-xs font-medium ${
          selected ? "text-white/85" : conf.statLabelInactive
        }`}
      >
        {conf.label}
      </span>
    </button>
  );
}

export { normaliseRoleKey, ROLE_CONFIG };
