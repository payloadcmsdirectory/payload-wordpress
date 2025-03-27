"use client";

import React, { useEffect, useState } from "react";
import { useConfig } from "payload/components/utilities";

interface CollectionMapping {
  name: string;
  database: "postgres" | "wordpress";
}

interface DatabaseStats {
  wordpressTables: number;
  postgresTables: number;
  collectionMapping: CollectionMapping[];
  globalMapping: CollectionMapping[];
}

const DualModePanel: React.FC = () => {
  const { serverURL } = useConfig();
  const [stats, setStats] = useState<DatabaseStats | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        setLoading(true);

        // Fetch plugin status
        const statusResponse = await fetch(
          `${serverURL}/api/wordpress-plugin/status`,
        );
        if (!statusResponse.ok) {
          throw new Error("Failed to fetch plugin status");
        }

        const statusData = await statusResponse.json();

        // Fetch tables
        const tablesResponse = await fetch(
          `${serverURL}/api/wordpress-plugin/tables`,
        );
        if (!tablesResponse.ok) {
          throw new Error("Failed to fetch database tables");
        }

        const tablesData = await tablesResponse.json();

        // Combine data
        setStats({
          wordpressTables: tablesData.wordpress?.length || 0,
          postgresTables: tablesData.postgres?.length || 0,
          collectionMapping: Object.entries(
            statusData.collectionMapping || {},
          ).map(([name, database]) => ({
            name,
            database: database as "postgres" | "wordpress",
          })),
          globalMapping: Object.entries(statusData.globalMapping || {}).map(
            ([name, database]) => ({
              name,
              database: database as "postgres" | "wordpress",
            }),
          ),
        });

        setLoading(false);
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "An unknown error occurred",
        );
        setLoading(false);
      }
    };

    fetchStats();
  }, [serverURL]);

  return (
    <div className="dual-mode-panel">
      <div className="panel-content">
        <h2>WordPress Plugin - Dual Database Mode</h2>

        <p>
          Your Payload CMS is currently configured to use both PostgreSQL and
          WordPress SQL databases. Each collection or global can be assigned to
          either database.
        </p>

        {loading && <div className="loading">Loading configuration...</div>}

        {error && <div className="error">{error}</div>}

        {!loading && !error && stats && (
          <div className="stats-container">
            <div className="database-stats">
              <h3>Database Statistics</h3>
              <div className="stats-grid">
                <div className="stat-item">
                  <span className="stat-label">WordPress Tables</span>
                  <span className="stat-value">{stats.wordpressTables}</span>
                </div>
                <div className="stat-item">
                  <span className="stat-label">PostgreSQL Tables</span>
                  <span className="stat-value">{stats.postgresTables}</span>
                </div>
              </div>
            </div>

            <div className="collection-mapping">
              <h3>Collection Database Mapping</h3>
              {stats.collectionMapping.length === 0 ? (
                <p>No collection mappings configured.</p>
              ) : (
                <table className="mapping-table">
                  <thead>
                    <tr>
                      <th>Collection</th>
                      <th>Database</th>
                    </tr>
                  </thead>
                  <tbody>
                    {stats.collectionMapping.map((mapping) => (
                      <tr key={mapping.name}>
                        <td>{mapping.name}</td>
                        <td className={`db-${mapping.database}`}>
                          {mapping.database}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>

            <div className="global-mapping">
              <h3>Global Database Mapping</h3>
              {stats.globalMapping.length === 0 ? (
                <p>No global mappings configured.</p>
              ) : (
                <table className="mapping-table">
                  <thead>
                    <tr>
                      <th>Global</th>
                      <th>Database</th>
                    </tr>
                  </thead>
                  <tbody>
                    {stats.globalMapping.map((mapping) => (
                      <tr key={mapping.name}>
                        <td>{mapping.name}</td>
                        <td className={`db-${mapping.database}`}>
                          {mapping.database}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        )}

        <div className="plugin-info">
          <h3>Plugin Information</h3>
          <p>
            In dual mode, you can choose which database stores each collection
            or global. This allows you to migrate gradually from WordPress to
            PostgreSQL.
          </p>
          <p>
            To update the database mapping, modify the collectionMapping and
            globalMapping options in your Payload config file.
          </p>
        </div>
      </div>
    </div>
  );
};

export default DualModePanel;
