import { useMemo, useState, useEffect } from "react";
import { DataTable } from "@/shared/components/DataTable";
import { Filters } from "@/shared/components/Filters";
import { Layout } from "@/shared/components/Layout";
import { Pagination } from "@/shared/components/Pagination";
import { useNavigate } from "react-router-dom";
import { useAppDispatch, useAppSelector } from "@/shared/hooks/reduxHooks";
import { fetchTeamsThunk } from "../store";
import { DepartmentBadge, StatusBadge } from "@/shared/components/EntityBadges";

export function TeamsListPage() {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const teams = useAppSelector((state) => state.teams?.items || []);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const pageSize = 10;

  useEffect(() => {
    dispatch(fetchTeamsThunk());
  }, [dispatch]);

  const filtered = useMemo(
    () =>
      teams.filter((team) =>
        team.name?.toLowerCase().includes(search.toLowerCase()),
      ),
    [teams, search],
  );

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const paged = filtered.slice((page - 1) * pageSize, page * pageSize);

  return (
    <Layout
      title="Teams"
      description="Manage organizational teams and units."
      actions={[
        {
          label: "Create Team",
          onClick: () => navigate("/teams/create"),
          variant: "primary",
        },
      ]}
    >
      <Filters
        placeholder="Search teams..."
        search={search}
        onSearchChange={setSearch}
      />
      <DataTable
        columns={[
          { key: "name", header: "Team Name", render: (row) => row.name },
          {
            key: "department",
            header: "Department",
            render: (row) => (
              <DepartmentBadge name={row.departmentId?.name || "—"} />
            ),
          },
          {
            key: "managerEmail",
            header: "Team Head",
            render: (row) => (
              <span className="text-zinc-600 dark:text-zinc-400 font-medium">{row.managerEmail || "—"}</span>
            ),
          },
          {
            key: "members",
            header: "Members",
            render: (row) => (
              <span className="inline-flex items-center rounded-full bg-zinc-100 dark:bg-zinc-800 px-2.5 py-0.5 text-xs font-semibold text-zinc-600 dark:text-zinc-400">
                {(row.members || []).length} Members
              </span>
            ),
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
              <button
                onClick={() => navigate(`/teams/${row.id}/edit`)}
                className="text-zinc-800 dark:text-zinc-200 hover:underline"
              >
                Edit
              </button>
            ),
          },
        ]}
        data={paged}
      />
      <Pagination page={page} totalPages={totalPages} onPageChange={setPage} />
    </Layout>
  );
}
