import type { Config } from "payload";

import type { WordPressAdapterOptions } from "./adapter";
import { wordpressAdapter } from "./adapter";

export interface WordPressPluginOptions {
  enabled?: boolean;
  mode?: "postgres-only" | "sql-only" | "both" | "migration";
  wordpressConfig?: {
    host: string;
    user: string;
    password: string;
    database: string;
    port?: number;
    prefix?: string;
  };
  postgresConfig?: {
    pool: {
      connectionString: string;
    };
    migrationDir?: string;
  };
  collectionMapping?: Record<string, "postgres" | "wordpress">;
  globalMapping?: Record<string, "postgres" | "wordpress">;
}

export const wordpressPlugin =
  (options: WordPressPluginOptions = {}) =>
  (incomingConfig: Config): Config => {
    // Clone the incoming config to avoid mutations
    const config = { ...incomingConfig };

    // Set defaults
    const pluginOptions: Required<WordPressPluginOptions> = {
      enabled: options.enabled ?? true,
      mode: options.mode ?? "postgres-only",
      wordpressConfig: options.wordpressConfig ?? {
        host: process.env.WORDPRESS_DB_HOST || "localhost",
        user: process.env.WORDPRESS_DB_USER || "root",
        password: process.env.WORDPRESS_DB_PASSWORD || "",
        database: process.env.WORDPRESS_DB_NAME || "wordpress",
        port: parseInt(process.env.WORDPRESS_DB_PORT || "3306", 10),
        prefix: process.env.WORDPRESS_DB_PREFIX || "wp_",
      },
      postgresConfig: options.postgresConfig ?? {
        pool: {
          connectionString:
            process.env.DATABASE_URI ||
            "postgresql://postgres:postgres@localhost:5432/payload",
        },
        migrationDir: options.postgresConfig?.migrationDir,
      },
      collectionMapping: options.collectionMapping ?? {},
      globalMapping: options.globalMapping ?? {},
    };

    // If plugin is disabled, return unmodified config
    if (!pluginOptions.enabled) return config;

    // Set up admin UI components
    if (config.admin) {
      config.admin.components = config.admin.components || {};
      // Add the appropriate component based on mode
      if (pluginOptions.mode === "postgres-only") {
        config.admin.components.beforeDashboard = [
          ...(config.admin.components.beforeDashboard || []),
          "@launchthat.apps/payload-wordpress/components/PostgresOnlyPanel",
        ];
      } else if (pluginOptions.mode === "sql-only") {
        config.admin.components.beforeDashboard = [
          ...(config.admin.components.beforeDashboard || []),
          "@launchthat.apps/payload-wordpress/components/SQLOnlyPanel",
        ];
      } else if (pluginOptions.mode === "both") {
        config.admin.components.beforeDashboard = [
          ...(config.admin.components.beforeDashboard || []),
          "@launchthat.apps/payload-wordpress/components/DualModePanel",
        ];
      } else if (pluginOptions.mode === "migration") {
        config.admin.components.beforeDashboard = [
          ...(config.admin.components.beforeDashboard || []),
          "@launchthat.apps/payload-wordpress/components/MigrationPanel",
        ];
      }
    }

    // Set up DB adapter based on mode
    if (pluginOptions.mode === "postgres-only") {
      // Use standard Postgres adapter
      const { postgresAdapter } = require("@payloadcms/db-postgres");
      config.db = postgresAdapter(pluginOptions.postgresConfig);
    } else {
      // Use custom WordPress adapter
      config.db = wordpressAdapter({
        mode: pluginOptions.mode,
        wordpressConfig: pluginOptions.wordpressConfig,
        postgresConfig: pluginOptions.postgresConfig,
        collectionMapping: pluginOptions.collectionMapping,
        globalMapping: pluginOptions.globalMapping,
      });
    }

    // Add plugin API routes
    config.endpoints = [
      ...(config.endpoints || []),
      {
        path: "/api/wordpress-plugin/status",
        method: "get",
        handler: (req, res) => {
          res.status(200).json({
            mode: pluginOptions.mode,
            enabled: pluginOptions.enabled,
            collectionMapping: pluginOptions.collectionMapping,
            globalMapping: pluginOptions.globalMapping,
          });
        },
      },
    ];

    // Add migration routes if in migration mode
    if (pluginOptions.mode === "migration") {
      config.endpoints = [
        ...config.endpoints,
        {
          path: "/api/wordpress-plugin/tables",
          method: "get",
          handler: (req, res) => {
            // TODO: Implement handler to get WordPress and PostgreSQL tables
            res.status(200).json({
              wordpress: [],
              postgres: [],
            });
          },
        },
        {
          path: "/api/wordpress-plugin/migrate",
          method: "post",
          handler: (req, res) => {
            // TODO: Implement migration handler
            res.status(200).json({
              status: "success",
              message: "Migration started",
            });
          },
        },
      ];
    }

    return config;
  };

export { wordpressAdapter };
export type { WordPressAdapterOptions };

// Export components
export * from "./components";

// Export default for convenience
export default wordpressPlugin;
