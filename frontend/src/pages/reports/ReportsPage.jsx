import { useState, useEffect } from "react";
import { Layout } from "@/shared/components/Layout";
import { useToast } from "@/shared/components/ToastProvider";
import { fetchWithAuth } from "@/shared/api/fetchWithAuth";
import { API_URL } from "@/shared/api/apiBase";
import { DataTable } from "@/shared/components/DataTable";

export function ReportsPage() {
  const { showToast } = useToast();
  const [summary, setSummary] = useState(null);
  const [warnings, setWarnings] = useState([]);
  const [unassignedEmployees, setUnassignedEmployees] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchReport = async () => {
      try {
        const response = await fetchWithAuth(`${API_URL}/reports/summary`);
        if (!response.ok) {
          throw new Error("Failed to fetch report");
        }
        const data = await response.json();
        setSummary(data.summary);
        setWarnings(data.warnings);

        // Extract unassigned employees from warnings
        const unassignedWarning = data.warnings.find((w) =>
          w.message?.includes("no department assigned"),
        );
        if (unassignedWarning) {
          setUnassignedEmployees(unassignedWarning.affectedItems || []);
        }
      } catch (error) {
        console.error("Error fetching report:", error);
        showToast("Failed to load report", "error");
      } finally {
        setIsLoading(false);
      }
    };

    fetchReport();
  }, [showToast]);

  if (isLoading) {
    return (
      <Layout title="Reports" description="Loading...">
        Loading report...
      </Layout>
    );
  }

  if (!summary) {
    return (
      <Layout title="Reports" description="System summary and insights.">
        No data available
      </Layout>
    );
  }

  return (
    <Layout title="Reports" description="System summary and insights.">
      {/* Summary Cards */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        <div className="bg-white p-4 rounded-lg shadow">
          <div className="text-sm text-gray-600">Total Departments</div>
          <div className="text-2xl font-bold">{summary.departments.total}</div>
          <div className="text-xs text-green-600">
            {summary.departments.active} active
          </div>
        </div>
        <div className="bg-white p-4 rounded-lg shadow">
          <div className="text-sm text-gray-600">Total Teams</div>
          <div className="text-2xl font-bold">{summary.teams.total}</div>
          <div className="text-xs text-green-600">
            {summary.teams.active} active
          </div>
        </div>
        <div className="bg-white p-4 rounded-lg shadow">
          <div className="text-sm text-gray-600">Total Positions</div>
          <div className="text-2xl font-bold">{summary.positions.total}</div>
          <div className="text-xs text-green-600">
            {summary.positions.active} active
          </div>
        </div>
        <div className="bg-white p-4 rounded-lg shadow">
          <div className="text-sm text-gray-600">Total Employees</div>
          <div className="text-2xl font-bold">{summary.employees.total}</div>
          <div className="text-xs text-yellow-600">
            {summary.employees.unassigned} unassigned
          </div>
        </div>
      </div>

      {/* Employee Status Breakdown */}
      <div className="bg-white p-4 rounded-lg shadow mb-6">
        <h3 className="text-lg font-semibold mb-4">
          Employee Status Breakdown
        </h3>
        <div className="grid grid-cols-4 gap-4">
          <div className="text-left">
            <div className="text-sm text-gray-600">Active</div>
            <div className="text-2xl font-bold text-green-600">
              {summary.employees.byStatus.ACTIVE}
            </div>
          </div>
          <div className="text-left">
            <div className="text-sm text-gray-600">On Leave</div>
            <div className="text-2xl font-bold text-yellow-600">
              {summary.employees.byStatus.ON_LEAVE}
            </div>
          </div>
          <div className="text-left">
            <div className="text-sm text-gray-600">Terminated</div>
            <div className="text-2xl font-bold text-red-600">
              {summary.employees.byStatus.TERMINATED}
            </div>
          </div>
          <div className="text-left">
            <div className="text-sm text-gray-600">Resigned</div>
            <div className="text-2xl font-bold text-gray-600">
              {summary.employees.byStatus.RESIGNED}
            </div>
          </div>
        </div>
      </div>

      {/* Warnings */}
      {warnings.length > 0 && (
        <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 mb-6">
          <h3 className="text-lg font-semibold mb-3">⚠️ Attention Required</h3>
          {warnings.map((warning, idx) => (
            <div key={idx} className="mb-3 text-sm">
              <div className="font-semibold">{warning.message}</div>
              {warning.affectedItems && warning.affectedItems.length > 0 && (
                <div className="text-gray-700 text-xs mt-1">
                  {warning.affectedItems.slice(0, 3).map((item, i) => (
                    <div key={i}>
                      • {item.name || item.title} (
                      {item.email || item.status || ""})
                    </div>
                  ))}
                  {warning.affectedItems.length > 3 && (
                    <div>• ... and {warning.affectedItems.length - 3} more</div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Unassigned Employees */}
      {unassignedEmployees.length > 0 && (
        <div className="bg-white p-4 rounded-lg shadow">
          <h3 className="text-lg font-semibold mb-4">Unassigned Employees</h3>
          <DataTable
            columns={[
              {
                key: "fullName",
                header: "Name",
                render: (row) => row.name || row.fullName,
              },
              { key: "email", header: "Email", render: (row) => row.email },
              {
                key: "action",
                header: "Action",
                render: (row) => (
                  <a
                    href={`/employments/assign?employeeId=${row.id || row._id}`}
                    className="text-zinc-800 hover:underline"
                  >
                    Assign Now
                  </a>
                ),
              },
            ]}
            data={unassignedEmployees}
          />
        </div>
      )}
    </Layout>
  );
}
