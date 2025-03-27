"use client";

import React, { useEffect, useState } from "react";
import { useConfig } from "payload/components/utilities";

interface Table {
  name: string;
  rowCount: number;
}

interface MigrationStatus {
  inProgress: boolean;
  completedTables: string[];
  totalTables: number;
  currentTable?: string;
  progress: number;
  errors: { table: string; error: string }[];
}

const MigrationPanel: React.FC = () => {
  const { serverURL } = useConfig();
  const [wordpressTables, setWordpressTables] = useState<Table[]>([]);
  const [postgresTables, setPostgresTables] = useState<Table[]>([]);
  const [selectedTables, setSelectedTables] = useState<string[]>([]);
  const [migrationStatus, setMigrationStatus] =
    useState<MigrationStatus | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch tables on component mount
  useEffect(() => {
    const fetchTables = async () => {
      try {
        setLoading(true);
        const response = await fetch(
          `${serverURL}/api/wordpress-plugin/tables`,
        );

        if (!response.ok) {
          throw new Error("Failed to fetch database tables");
        }

        const data = await response.json();
        setWordpressTables(data.wordpress || []);
        setPostgresTables(data.postgres || []);
        setLoading(false);
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "An unknown error occurred",
        );
        setLoading(false);
      }
    };

    fetchTables();
  }, [serverURL]);

  // Toggle selection of a table
  const toggleTableSelection = (tableName: string) => {
    setSelectedTables((prev) =>
      prev.includes(tableName)
        ? prev.filter((t) => t !== tableName)
        : [...prev, tableName],
    );
  };

  // Select all tables
  const selectAllTables = () => {
    setSelectedTables(wordpressTables.map((t) => t.name));
  };

  // Deselect all tables
  const deselectAllTables = () => {
    setSelectedTables([]);
  };

  // Start migration
  const startMigration = async () => {
    try {
      const response = await fetch(
        `${serverURL}/api/wordpress-plugin/migrate`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            tables: selectedTables,
          }),
        },
      );

      if (!response.ok) {
        throw new Error("Failed to start migration");
      }

      // Set initial migration status
      setMigrationStatus({
        inProgress: true,
        completedTables: [],
        totalTables: selectedTables.length,
        progress: 0,
        errors: [],
      });

      // Poll for migration status updates
      pollMigrationStatus();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to start migration",
      );
    }
  };

  // Poll for migration status
  const pollMigrationStatus = async () => {
    // This would be implemented to periodically check migration status
    // For now, we'll simulate progress updates
    const mockProgress = () => {
      setMigrationStatus((prev) => {
        if (!prev) return null;
        if (prev.progress >= 100) {
          return {
            ...prev,
            inProgress: false,
            progress: 100,
            completedTables: selectedTables,
          };
        }

        const newProgress = Math.min(prev.progress + 10, 100);
        const completedCount = Math.floor(
          (selectedTables.length * newProgress) / 100,
        );

        return {
          ...prev,
          progress: newProgress,
          currentTable:
            selectedTables[Math.min(completedCount, selectedTables.length - 1)],
          completedTables: selectedTables.slice(0, completedCount),
          inProgress: newProgress < 100,
        };
      });
    };

    // Simulate progress updates every second
    const interval = setInterval(mockProgress, 1000);

    // Clear interval when progress reaches 100%
    const checkCompletion = setInterval(() => {
      if (migrationStatus?.progress === 100) {
        clearInterval(interval);
        clearInterval(checkCompletion);
      }
    }, 500);

    // Cleanup intervals on component unmount
    return () => {
      clearInterval(interval);
      clearInterval(checkCompletion);
    };
  };

  return (
    <div className="migration-panel">
      <div className="panel-content">
        <h2>WordPress to PostgreSQL Migration</h2>

        <p>
          This tool helps you migrate your data from WordPress to PostgreSQL.
          You can select which tables to migrate and track the progress.
        </p>

        {loading && <div className="loading">Loading database tables...</div>}

        {error && <div className="error">{error}</div>}

        {!loading && !error && (
          <>
            {migrationStatus?.inProgress ? (
              <div className="migration-progress">
                <h3>Migration in Progress</h3>

                <div className="progress-bar-container">
                  <div
                    className="progress-bar"
                    style={{ width: `${migrationStatus.progress}%` }}
                  />
                </div>

                <div className="progress-stats">
                  <p>Progress: {migrationStatus.progress}%</p>
                  <p>
                    Completed: {migrationStatus.completedTables.length} of{" "}
                    {migrationStatus.totalTables} tables
                  </p>
                  {migrationStatus.currentTable && (
                    <p>Current table: {migrationStatus.currentTable}</p>
                  )}
                </div>

                {migrationStatus.errors.length > 0 && (
                  <div className="migration-errors">
                    <h4>Errors</h4>
                    <ul>
                      {migrationStatus.errors.map((err, index) => (
                        <li key={index}>
                          {err.table}: {err.error}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            ) : (
              <div className="migration-setup">
                <div className="table-selection">
                  <div className="selection-header">
                    <h3>WordPress Tables</h3>
                    <div className="selection-actions">
                      <button
                        type="button"
                        onClick={selectAllTables}
                        className="select-all-btn"
                      >
                        Select All
                      </button>
                      <button
                        type="button"
                        onClick={deselectAllTables}
                        className="deselect-all-btn"
                      >
                        Deselect All
                      </button>
                    </div>
                  </div>

                  <div className="tables-list">
                    {wordpressTables.length === 0 ? (
                      <p>No WordPress tables found.</p>
                    ) : (
                      <ul>
                        {wordpressTables.map((table) => (
                          <li key={table.name}>
                            <label className="table-checkbox">
                              <input
                                type="checkbox"
                                checked={selectedTables.includes(table.name)}
                                onChange={() =>
                                  toggleTableSelection(table.name)
                                }
                              />
                              <span className="table-name">{table.name}</span>
                              <span className="table-count">
                                ({table.rowCount} rows)
                              </span>
                            </label>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>

                  <div className="migration-actions">
                    <button
                      type="button"
                      onClick={startMigration}
                      disabled={selectedTables.length === 0}
                      className="start-migration-btn"
                    >
                      Start Migration
                    </button>
                  </div>
                </div>

                <div className="existing-postgres-tables">
                  <h3>Existing PostgreSQL Tables</h3>
                  {postgresTables.length === 0 ? (
                    <p>No existing PostgreSQL tables found.</p>
                  ) : (
                    <ul>
                      {postgresTables.map((table) => (
                        <li key={table.name}>
                          <span className="table-name">{table.name}</span>
                          <span className="table-count">
                            ({table.rowCount} rows)
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
            )}
          </>
        )}

        <div className="plugin-info">
          <h3>Migration Information</h3>
          <p>
            The migration process will copy data from the WordPress database to
            PostgreSQL. It preserves relationships between tables where possible
            and maps WordPress data types to appropriate PostgreSQL data types.
          </p>
          <p>
            After migration, you can switch to PostgreSQL-only mode for better
            performance.
          </p>
        </div>
      </div>
    </div>
  );
};

export default MigrationPanel;
