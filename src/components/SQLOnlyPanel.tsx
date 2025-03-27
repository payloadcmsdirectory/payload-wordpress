"use client";

import React, { useEffect, useState } from "react";
import { useConfig } from "payload/components/utilities";

interface WordPressTable {
  name: string;
  rowCount: number;
}

const SQLOnlyPanel: React.FC = () => {
  const { serverURL } = useConfig();
  const [tables, setTables] = useState<WordPressTable[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchTables = async () => {
      try {
        setLoading(true);
        // Fetch WordPress tables from our API
        const response = await fetch(
          `${serverURL}/api/wordpress-plugin/tables`,
        );

        if (!response.ok) {
          throw new Error("Failed to fetch WordPress tables");
        }

        const data = await response.json();
        setTables(data.wordpress || []);
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
    <div className="sql-only-panel">
      <div className="panel-content">
        <h2>WordPress Plugin - SQL Mode</h2>

        <p>
          Your Payload CMS is currently configured to use the WordPress SQL
          database directly. The plugin is operating in SQL-only mode, which
          means all collections and globals are stored in the WordPress
          database.
        </p>

        <div className="tables-section">
          <h3>WordPress Tables</h3>

          {loading && <div className="loading">Loading tables...</div>}

          {error && <div className="error">{error}</div>}

          {!loading && !error && tables.length === 0 && (
            <p>No tables found in the WordPress database.</p>
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
            You are directly using the WordPress database with Payload CMS. This
            allows you to leverage Payload's admin UI and APIs while keeping
            your data in WordPress format.
          </p>
          <p>
            To configure this plugin or switch to a different mode, update your
            Payload config file. For more information, see the documentation.
          </p>
        </div>
      </div>
    </div>
  );
};

export default SQLOnlyPanel;
