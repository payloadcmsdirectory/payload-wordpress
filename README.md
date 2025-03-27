# WordPress Database Adapter for PayloadCMS

This plugin provides a bridge between WordPress MySQL databases and PayloadCMS, allowing you to:

1. Use PostgreSQL as your primary database (postgres-only mode)
2. Use WordPress MySQL database as your primary database (sql-only mode)
3. Use both databases simultaneously, defining which collections use which database (both mode)
4. Migrate data from WordPress to PostgreSQL (migration mode)

## Installation

```bash
npm install @launchthat.apps/payload-wordpress

# or with yarn
yarn add @launchthat.apps/payload-wordpress

# or with pnpm
pnpm add @launchthat.apps/payload-wordpress
```

## Usage

```typescript
import { wordpressPlugin } from "@launchthat.apps/payload-wordpress";
import { buildConfig } from "payload/config";

export default buildConfig({
  // Your Payload config
  collections: [
    // Your collections
  ],

  // Add the WordPress plugin
  plugins: [
    wordpressPlugin({
      mode: "postgres-only", // 'postgres-only', 'sql-only', 'both', or 'migration'

      // WordPress database configuration
      wordpressConfig: {
        host: process.env.WORDPRESS_DB_HOST || "localhost",
        user: process.env.WORDPRESS_DB_USER || "root",
        password: process.env.WORDPRESS_DB_PASSWORD || "",
        database: process.env.WORDPRESS_DB_NAME || "wordpress",
        port: parseInt(process.env.WORDPRESS_DB_PORT || "3306", 10),
        prefix: process.env.WORDPRESS_DB_PREFIX || "wp_",
      },

      // PostgreSQL configuration
      postgresConfig: {
        pool: {
          connectionString:
            process.env.DATABASE_URI ||
            "postgresql://postgres:postgres@localhost:5432/payload",
        },
      },

      // Only needed in 'both' mode to define which collections use which database
      collectionMapping: {
        posts: "wordpress",
        pages: "wordpress",
        users: "postgres",
        // ... other collections
      },

      // Only needed in 'both' mode to define which globals use which database
      globalMapping: {
        header: "postgres",
        footer: "postgres",
        // ... other globals
      },
    }),
  ],
});
```

## Modes

### PostgreSQL Only Mode

In this mode, the plugin behaves exactly like the native PostgreSQL adapter, using PostgreSQL for all collections and globals.

### SQL Only Mode

In this mode, the plugin uses your WordPress MySQL database for all collections and globals, mapping Payload's data structure to WordPress tables.

### Both Mode

In this mode, you can specify which collections and globals should use PostgreSQL and which should use the WordPress database.

### Migration Mode

In this mode, both databases are connected, but the plugin provides a UI panel to migrate data from WordPress to PostgreSQL.

## Admin UI Panels

The plugin automatically adds an admin UI panel based on your selected mode:

- PostgreSQL Only Mode: Shows PostgreSQL database information
- SQL Only Mode: Shows WordPress database information
- Both Mode: Shows database mapping configuration
- Migration Mode: Provides UI for migrating from WordPress to PostgreSQL

## WordPress Database Mapping

When using the WordPress database, the plugin maps Payload's data model to WordPress tables:

- Collections map to WordPress post types in `wp_posts`
- Fields map to meta fields in `wp_postmeta`
- Users map to WordPress users in `wp_users` and `wp_usermeta`

## Development

### Prerequisites

- Node.js (>=18.20.2)
- pnpm (>=9)

### Building the Plugin

```bash
# Install dependencies
pnpm install

# Build the plugin
pnpm build
```

## License

MIT
