import { useMemo, useState, useEffect } from "react";
import { DataTable } from "@/shared/components/DataTable";
import { Filters } from "@/shared/components/Filters";
import { Layout } from "@/shared/components/Layout";
import { Pagination } from "@/shared/components/Pagination";
import { Link } from "react-router-dom";
import { useAppSelector, useAppDispatch } from "@/shared/hooks/reduxHooks";
import { fetchPositionsThunk } from "../store";
import { DepartmentBadge, StatusBadge } from "@/shared/components/EntityBadges";

export function PositionsListPage() {
  const dispatch = useAppDispatch();
  const positions = useAppSelector((state) => state.positions?.items || []);
  const departments = useAppSelector((state) => state.departments?.items || []);
  const teams = useAppSelector((state) => state.teams?.items || []);
  const isLoading = useAppSelector(
    (state) => state.positions?.isLoading || false,
  );

  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const pageSize = 5;

  useEffect(() => {
    dispatch(fetchPositionsThunk({}));
  }, [dispatch]);

  // Map department and team names to position data
  const positionsWithNames = useMemo(
    () =>
      positions.map((position) => ({
        ...position,
        departmentName:
          departments.find((d) => d.id === position.departmentId)?.name ||
          "Unknown Department",
        teamName:
          position.teamId && teams.find((t) => t.id === position.teamId)?.name
            ? teams.find((t) => t.id === position.teamId)?.name
            : "—",
      })),
    [positions, departments, teams],
  );

  const filtered = useMemo(
    () =>
      positionsWithNames.filter((position) =>
        position.title.toLowerCase().includes(search.toLowerCase()),
      ),
    [positionsWithNames, search],
  );

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const paged = filtered.slice((page - 1) * pageSize, page * pageSize);

  return (
    <Layout
      title="Positions List"
      description="View current positions and role seniority."
    >
      <div className="mb-4 flex justify-between items-center">
        <Filters
          placeholder="Search positions..."
          search={search}
          onSearchChange={setSearch}
        />
        <Link
          to="/positions/create"
          className="px-3 py-2 bg-zinc-900 text-white text-sm font-medium rounded-md hover:bg-zinc-800"
        >
          + Create Position
        </Link>
      </div>

      {isLoading ? (
        <div className="text-center py-8 text-gray-600">
          Loading positions...
        </div>
      ) : positions.length === 0 ? (
        <div className="text-center py-8 text-gray-600">
          No positions found.{" "}
          <Link
            to="/positions/create"
            className="text-zinc-700 hover:underline"
          >
            Create one
          </Link>
        </div>
      ) : (
        <>
          <DataTable
            columns={[
              { key: "title", header: "Title", render: (row) => row.title },
              {
                key: "level",
                header: "Level",
                render: (row) => (
                  <span className="px-2 py-1 bg-gray-100 rounded text-sm">
                    {row.level}
                  </span>
                ),
              },
              {
                key: "departmentName",
                header: "Department",
                render: (row) => <DepartmentBadge name={row.departmentName} />,
              },
              {
                key: "teamName",
                header: "Team",
                render: (row) => row.teamName,
              },
              {
                key: "status",
                header: "Status",
                render: (row) => <StatusBadge status={row.status} />,
              },
              {
                key: "actions",
                header: "Actions",
                render: (row) => (
                  <Link
                    to={`/positions/${row.id}/edit`}
                    className="text-zinc-700 hover:underline"
                  >
                    Edit
                  </Link>
                ),
              },
            ]}
            data={paged}
          />
          <Pagination
            currentPage={page}
            totalPages={totalPages}
            onPageChange={setPage}
          />
        </>
      )}
    </Layout>
  );
}
