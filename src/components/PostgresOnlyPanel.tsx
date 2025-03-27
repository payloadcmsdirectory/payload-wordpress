"use client";

import React, { useEffect, useState } from "react";
import { useConfig } from "payload/components/utilities";

interface PostgresTable {
  name: string;
  rowCount: number;
}

const PostgresOnlyPanel: React.FC = () => {
  const { serverURL } = useConfig();
  const [tables, setTables] = useState<PostgresTable[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchTables = async () => {
      try {
        setLoading(true);
        // Fetch postgres tables from our API
        const response = await fetch(
          `${serverURL}/api/wordpress-plugin/tables`,
        );

        if (!response.ok) {
          throw new Error("Failed to fetch PostgreSQL tables");
        }

        const data = await response.json();
        setTables(data.postgres || []);
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

  return (
    <div className="postgres-only-panel">
      <div className="panel-content">
        <h2>WordPress Plugin - PostgreSQL Mode</h2>

        <p>
          Your Payload CMS is currently configured to use PostgreSQL as the
          database. The WordPress plugin is operating in PostgreSQL-only mode.
        </p>

        <div className="tables-section">
          <h3>PostgreSQL Tables</h3>

          {loading && <div className="loading">Loading tables...</div>}

          {error && <div className="error">{error}</div>}

          {!loading && !error && tables.length === 0 && (
            <p>No tables found in the PostgreSQL database.</p>
          )}

          {!loading && !error && tables.length > 0 && (
            <table className="tables-list">
              <thead>
                <tr>
                  <th>Table Name</th>
                  <th>Row Count</th>
                </tr>
              </thead>
              <tbody>
                {tables.map((table) => (
                  <tr key={table.name}>
                    <td>{table.name}</td>
                    <td>{table.rowCount}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <div className="plugin-info">
          <h3>Plugin Information</h3>
          <p>
            To configure this plugin or switch to a different mode, update your
            Payload config file. For more information, see the documentation.
          </p>
        </div>
      </div>
    </div>
  );
};

export default PostgresOnlyPanel;
