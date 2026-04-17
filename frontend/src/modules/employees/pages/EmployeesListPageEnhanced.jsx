import { useState, useMemo, useEffect } from "react";
import { Link } from "react-router-dom";
import { useAppDispatch, useAppSelector } from "@/shared/hooks/reduxHooks";
import { useToast } from "@/shared/components/ToastProvider";
import { fetchEmployeesThunk, deleteEmployeeThunk } from "../store";
import { DepartmentBadge, StatusBadge } from "@/shared/components/EntityBadges";
import {
  DataTable,
  createColumn,
  Skeleton,
  EmptyState,
  useConfirmDialog,
  PageHeader,
  Alert,
  FormField,
  Select,
} from "@/shared/components";
import {
  Users,
  UserPlus,
  Eye,
  Pencil,
  RefreshCw,
  Filter,
  UserMinus,
  Calendar,
  Mail,
  Phone,
  Building2,
} from "lucide-react";

/* ─── tiny helpers ─── */
const AVATAR_COLORS = [
  "from-violet-500 to-purple-600",
  "from-teal-500 to-cyan-600",
  "from-rose-500 to-pink-600",
  "from-amber-500 to-orange-600",
  "from-blue-500 to-indigo-600",
  "from-emerald-500 to-green-600",
  "from-fuchsia-500 to-pink-600",
  "from-sky-500 to-blue-600",
];

function getAvatarColor(name) {
  let h = 0;
  for (let i = 0; i < (name || "").length; i++)
    h = (Math.imul(31, h) + name.charCodeAt(i)) | 0;
  return AVATAR_COLORS[Math.abs(h) % AVATAR_COLORS.length];
}

function getInitials(name) {
  if (!name) return "?";
  const parts = name.trim().split(/\s+/);
  return (parts[0]?.[0] + (parts[1]?.[0] || "")).toUpperCase();
}

function formatDate(d) {
  if (!d) return null;
  return new Date(d).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export function EmployeesListPage() {
  const dispatch = useAppDispatch();
  const { showToast } = useToast();
  const employees = useAppSelector((s) => s.employees.items);
  const isLoading = useAppSelector((s) => s.employees.isLoading);

  const [selectedEmployees, setSelectedEmployees] = useState([]);
  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState({
    department: "",
    status: "",
    employmentType: "",
  });

  const { confirm, ConfirmDialog: ConfirmDialogComponent } = useConfirmDialog();

  // Fetch employees on mount
  useEffect(() => {
    void dispatch(fetchEmployeesThunk());
  }, [dispatch]);

  // Handle employee deletion
  const handleDelete = async (employee) => {
    const result = await confirm({
      title: "Delete Employee",
      description: `Are you sure you want to delete ${employee.fullName}? This action cannot be undone.`,
      variant: "destructive",
      isDestructive: true,
    });

    if (result) {
      try {
        await dispatch(deleteEmployeeThunk(employee._id)).unwrap();
        showToast("Employee deleted successfully", "success");
        setSelectedEmployees((prev) =>
          prev.filter((id) => id !== employee._id),
        );
      } catch (error) {
        showToast(error.message || "Failed to delete employee", "error");
      }
    }
  };

  // Handle bulk actions
  const handleBulkDelete = async () => {
    const result = await confirm({
      title: `Delete ${selectedEmployees.length} Employees`,
      description: `Are you sure you want to delete ${selectedEmployees.length} selected employees? This action cannot be undone.`,
      variant: "destructive",
      isDestructive: true,
    });

    if (result) {
      // Implement bulk delete logic
      showToast("Bulk delete not implemented yet", "info");
    }
  };

  // Filter employees
  const filteredEmployees = useMemo(() => {
    let filtered = employees || [];

    if (filters.department) {
      filtered = filtered.filter(
        (emp) => emp.department === filters.department,
      );
    }
    if (filters.status) {
      filtered = filtered.filter((emp) => emp.status === filters.status);
    }
    if (filters.employmentType) {
      filtered = filtered.filter(
        (emp) => emp.employmentType === filters.employmentType,
      );
    }

    return filtered;
  }, [employees, filters]);

  // Get unique departments for filter
  const departments = useMemo(() => {
    const depts = [
      ...new Set(employees?.map((emp) => emp.department).filter(Boolean)),
    ];
    return depts.sort();
  }, [employees]);

  // Table columns
  const columns = [
    createColumn("fullName", "Employee", {
      cell: (row) => (
        <div className="flex items-center gap-3">
          <div
            className={`w-10 h-10 rounded-full bg-gradient-to-br ${getAvatarColor(row.fullName)} flex items-center justify-center text-white font-medium shadow-sm`}
          >
            {getInitials(row.fullName)}
          </div>
          <div>
            <div className="font-medium text-zinc-900 dark:text-zinc-100">{row.fullName}</div>
            <div className="text-sm text-zinc-500 dark:text-zinc-400">{row.employeeCode}</div>
          </div>
        </div>
      ),
      sortable: true,
    }),
    createColumn("email", "Contact", {
      cell: (row) => (
        <div className="space-y-1">
          <div className="flex items-center gap-1 text-sm text-zinc-900 dark:text-zinc-100">
            <Mail className="w-3 h-3 text-zinc-400" />
            {row.email}
          </div>
          {row.phoneNumber && (
            <div className="flex items-center gap-1 text-sm text-zinc-500 dark:text-zinc-400">
              <Phone className="w-3 h-3 text-zinc-400" />
              {row.phoneNumber}
            </div>
          )}
        </div>
      ),
    }),
    createColumn("department", "Department", {
      cell: (row) => (
        <div className="flex items-center gap-2">
          <Building2 className="w-4 h-4 text-zinc-400" />
          <DepartmentBadge department={row.department} />
        </div>
      ),
      sortable: true,
    }),
    createColumn("position", "Position", {
      cell: (row) => (
        <span className="text-sm text-zinc-900 dark:text-zinc-100">{row.position}</span>
      ),
      sortable: true,
    }),
    createColumn("status", "Status", {
      cell: (row) => <StatusBadge status={row.status} />,
      sortable: true,
    }),
    createColumn("dateOfHire", "Start Date", {
      cell: (row) => (
        <div className="flex items-center gap-1 text-sm text-zinc-900 dark:text-zinc-100">
          <Calendar className="w-4 h-4 text-zinc-400" />
          {formatDate(row.dateOfHire)}
        </div>
      ),
      sortable: true,
    }),
    createColumn("actions", "Actions", {
      cell: (row) => (
        <div className="flex items-center gap-2">
          <Link
            to={`/employees/${row._id}`}
            className="p-1.5 text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-md transition-colors"
            title="View profile"
          >
            <Eye className="w-4 h-4" />
          </Link>
          <Link
            to={`/employees/${row._id}/edit`}
            className="p-1.5 text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-md transition-colors"
            title="Edit employee"
          >
            <Pencil className="w-4 h-4" />
          </Link>
          <button
            onClick={() => handleDelete(row)}
            className="p-1.5 text-zinc-600 dark:text-zinc-400 hover:text-red-600 hover:bg-red-50 rounded-md transition-colors"
            title="Delete employee"
          >
            <UserMinus className="w-4 h-4" />
          </button>
        </div>
      ),
      sortable: false,
    }),
  ];

  // Page actions
  const pageActions = (
    <div className="flex items-center gap-3">
      <button
        onClick={() => setShowFilters(!showFilters)}
        className="flex items-center gap-2 px-3 py-2 text-sm border border-zinc-300 rounded-md hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors"
      >
        <Filter className="w-4 h-4" />
        Filters
        {Object.values(filters).some((v) => v) && (
          <span className="w-2 h-2 bg-indigo-600 rounded-full"></span>
        )}
      </button>
      <button
        onClick={() => window.location.reload()}
        className="flex items-center gap-2 px-3 py-2 text-sm border border-zinc-300 rounded-md hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors"
      >
        <RefreshCw className="w-4 h-4" />
        Refresh
      </button>
      <Link
        to="/employees/create"
        className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-md hover:bg-indigo-700 transition-colors"
      >
        <UserPlus className="w-4 h-4" />
        Add Employee
      </Link>
    </div>
  );

  if (isLoading && !employees.length) {
    return (
      <div className="space-y-6">
        <PageHeader
          title="Employees"
          subtitle="Manage your workforce"
          actions={pageActions}
        />
        <Skeleton.PageSkeleton />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Employees"
        subtitle={`Manage your workforce (${filteredEmployees.length} total)`}
        actions={pageActions}
      />

      {/* Filters Panel */}
      {showFilters && (
        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg p-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <FormField label="Department">
              <Select
                value={filters.department}
                onChange={(e) =>
                  setFilters((prev) => ({
                    ...prev,
                    department: e.target.value,
                  }))
                }
              >
                <option value="">All departments</option>
                {departments.map((dept) => (
                  <option key={dept} value={dept}>
                    {dept}
                  </option>
                ))}
              </Select>
            </FormField>
            <FormField label="Status">
              <Select
                value={filters.status}
                onChange={(e) =>
                  setFilters((prev) => ({ ...prev, status: e.target.value }))
                }
              >
                <option value="">All statuses</option>
                <option value="ACTIVE">Active</option>
                <option value="ON_LEAVE">On Leave</option>
                <option value="TERMINATED">Terminated</option>
              </Select>
            </FormField>
            <FormField label="Employment Type">
              <Select
                value={filters.employmentType}
                onChange={(e) =>
                  setFilters((prev) => ({
                    ...prev,
                    employmentType: e.target.value,
                  }))
                }
              >
                <option value="">All types</option>
                <option value="FULL_TIME">Full Time</option>
                <option value="PART_TIME">Part Time</option>
                <option value="CONTRACT">Contract</option>
                <option value="INTERN">Intern</option>
              </Select>
            </FormField>
          </div>
          <div className="flex justify-end mt-4">
            <button
              onClick={() =>
                setFilters({ department: "", status: "", employmentType: "" })
              }
              className="text-sm text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100"
            >
              Clear filters
            </button>
          </div>
        </div>
      )}

      {/* Bulk Actions */}
      {selectedEmployees.length > 0 && (
        <Alert
          variant="info"
          dismissible
          onDismiss={() => setSelectedEmployees([])}
        >
          <div className="flex items-center justify-between">
            <span>{selectedEmployees.length} employees selected</span>
            <div className="flex items-center gap-3">
              <button
                onClick={() => setSelectedEmployees([])}
                className="text-sm text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100"
              >
                Clear selection
              </button>
              <button
                onClick={handleBulkDelete}
                className="text-sm text-red-600 hover:text-red-700 font-medium"
              >
                Delete selected
              </button>
            </div>
          </div>
        </Alert>
      )}

      {/* Data Table */}
      <DataTable
        data={filteredEmployees}
        columns={columns}
        isLoading={isLoading}
        searchable={true}
        sortable={true}
        pagination={true}
        pageSize={10}
        emptyState={
          <EmptyState
            icon={Users}
            title="No employees found"
            description={
              Object.values(filters).some((v) => v)
                ? "No employees match your current filters. Try adjusting your criteria."
                : "Get started by adding your first employee to the system."
            }
            action={
              !Object.values(filters).some((v) => v) && (
                <Link
                  to="/employees/create"
                  className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-md hover:bg-indigo-700 transition-colors"
                >
                  <UserPlus className="w-4 h-4" />
                  Add Employee
                </Link>
              )
            }
          />
        }
      />

      {/* Confirmation Dialog */}
      <ConfirmDialogComponent />
    </div>
  );
}
