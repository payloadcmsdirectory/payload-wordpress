import type { DatabaseAdapter } from "payload/database";
import { postgresAdapter } from "@payloadcms/db-postgres";
import mysql from "mysql2/promise";

export interface WordPressAdapterOptions {
  mode: "sql-only" | "both" | "migration";
  wordpressConfig: {
    host: string;
    user: string;
    password: string;
    database: string;
    port?: number;
    prefix?: string;
  };
  postgresConfig: {
    pool: {
      connectionString: string;
    };
    migrationDir?: string;
  };
  collectionMapping?: Record<string, "postgres" | "wordpress">;
  globalMapping?: Record<string, "postgres" | "wordpress">;
}

export const wordpressAdapter = (
  options: WordPressAdapterOptions,
): DatabaseAdapter => {
  // Set defaults for options
  const config = {
    prefix: options.wordpressConfig.prefix || "wp_",
    port: options.wordpressConfig.port || 3306,
    collectionMapping: options.collectionMapping || {},
    globalMapping: options.globalMapping || {},
  };

  // Initialize MySQL pool
  const mysqlPool = mysql.createPool({
    host: options.wordpressConfig.host,
    user: options.wordpressConfig.user,
    password: options.wordpressConfig.password,
    database: options.wordpressConfig.database,
    port: config.port,
  });

  // Initialize Postgres adapter if needed
  let postgresDB: DatabaseAdapter | null = null;
  if (options.mode === "both" || options.mode === "migration") {
    postgresDB = postgresAdapter(options.postgresConfig);
  }

  // In SQL-only mode, we only use the WordPress database
  // In both mode, we use both databases depending on mapping
  // In migration mode, we use both databases and provide migration utilities

  // Implement the adapter interface
  const adapter: DatabaseAdapter = {
    // Connect to database
    async connect() {
      // Test MySQL connection
      const connection = await mysqlPool.getConnection();
      connection.release();

      // If using postgres, also connect to it
      if (postgresDB) {
        await postgresDB.connect();
      }

      return null;
    },

    // Find documents
    async find({ collection, query, ...rest }) {
      // Determine which database to use for this collection
      const databaseType = getDatabaseForCollection(
        collection,
        config.collectionMapping,
        options.mode,
      );

      if (databaseType === "postgres" && postgresDB) {
        // If postgres, delegate to postgres adapter
        return postgresDB.find({ collection, query, ...rest });
      }

      // Otherwise use WordPress database
      // This is a simplified example - real implementation would need to translate
      // Payload's query format to SQL queries against WordPress tables

      // Convert post_type based on collection name
      const postType = mapCollectionToPostType(collection);

      // Build basic query
      // NOTE: This is a simplified version and would need to be expanded
      const sqlQuery = `
        SELECT p.*, pm.meta_key, pm.meta_value 
        FROM ${config.prefix}posts p
        LEFT JOIN ${config.prefix}postmeta pm ON p.ID = pm.post_id
        WHERE p.post_type = ?
        LIMIT ? OFFSET ?
      `;

      // Execute query
      const [rows] = await mysqlPool.execute(sqlQuery, [
        postType,
        query.limit || 10,
        query.skip || 0,
      ]);

      // Format results to match Payload expectations
      return formatWordPressResults(rows, collection);
    },

    // Find a single document
    async findOne({ collection, query, ...rest }) {
      const databaseType = getDatabaseForCollection(
        collection,
        config.collectionMapping,
        options.mode,
      );

      if (databaseType === "postgres" && postgresDB) {
        return postgresDB.findOne({ collection, query, ...rest });
      }

      // WordPress implementation
      const postType = mapCollectionToPostType(collection);

      // Build query for a single document
      const sqlQuery = `
        SELECT p.*, pm.meta_key, pm.meta_value 
        FROM ${config.prefix}posts p
        LEFT JOIN ${config.prefix}postmeta pm ON p.ID = pm.post_id
        WHERE p.post_type = ?
        LIMIT 1
      `;

      // Execute query
      const [rows] = await mysqlPool.execute(sqlQuery, [postType]);

      // Format results
      const results = formatWordPressResults(rows, collection);
      return results[0] || null;
    },

    // Find by ID
    async findByID({ collection, id, ...rest }) {
      const databaseType = getDatabaseForCollection(
        collection,
        config.collectionMapping,
        options.mode,
      );

      if (databaseType === "postgres" && postgresDB) {
        return postgresDB.findByID({ collection, id, ...rest });
      }

      // WordPress implementation
      const sqlQuery = `
        SELECT p.*, pm.meta_key, pm.meta_value 
        FROM ${config.prefix}posts p
        LEFT JOIN ${config.prefix}postmeta pm ON p.ID = pm.post_id
        WHERE p.ID = ?
      `;

      // Execute query
      const [rows] = await mysqlPool.execute(sqlQuery, [id]);

      // Format result
      const results = formatWordPressResults(rows, collection);
      return results[0] || null;
    },

    // Create document
    async create({ collection, data, ...rest }) {
      const databaseType = getDatabaseForCollection(
        collection,
        config.collectionMapping,
        options.mode,
      );

      if (databaseType === "postgres" && postgresDB) {
        return postgresDB.create({ collection, data, ...rest });
      }

      // WordPress implementation
      const postType = mapCollectionToPostType(collection);

      // Separate post data from meta data
      const { title, content, status, ...metaData } = data;

      // Insert post
      const [result] = await mysqlPool.execute(
        `INSERT INTO ${config.prefix}posts (post_title, post_content, post_status, post_type) 
         VALUES (?, ?, ?, ?)`,
        [
          title || "",
          content || "",
          mapPayloadStatusToWordPress(status),
          postType,
        ],
      );

      const postId = result.insertId;

      // Insert meta data
      for (const [key, value] of Object.entries(metaData)) {
        await mysqlPool.execute(
          `INSERT INTO ${config.prefix}postmeta (post_id, meta_key, meta_value) VALUES (?, ?, ?)`,
          [
            postId,
            key,
            typeof value === "object" ? JSON.stringify(value) : String(value),
          ],
        );
      }

      // Fetch the created document
      return this.findByID({ collection, id: postId, ...rest });
    },

    // Update document
    async update({ collection, id, data, ...rest }) {
      const databaseType = getDatabaseForCollection(
        collection,
        config.collectionMapping,
        options.mode,
      );

      if (databaseType === "postgres" && postgresDB) {
        return postgresDB.update({ collection, id, data, ...rest });
      }

      // WordPress implementation
      // Separate post data from meta data
      const { title, content, status, ...metaData } = data;

      // Update post
      await mysqlPool.execute(
        `UPDATE ${config.prefix}posts 
         SET post_title = ?, post_content = ?, post_status = ? 
         WHERE ID = ?`,
        [title, content, mapPayloadStatusToWordPress(status), id],
      );

      // Update meta data
      for (const [key, value] of Object.entries(metaData)) {
        // Check if meta already exists
        const [existingMeta] = await mysqlPool.execute(
          `SELECT meta_id FROM ${config.prefix}postmeta WHERE post_id = ? AND meta_key = ?`,
          [id, key],
        );

        if (existingMeta.length > 0) {
          // Update existing meta
          await mysqlPool.execute(
            `UPDATE ${config.prefix}postmeta SET meta_value = ? WHERE post_id = ? AND meta_key = ?`,
            [
              typeof value === "object" ? JSON.stringify(value) : String(value),
              id,
              key,
            ],
          );
        } else {
          // Insert new meta
          await mysqlPool.execute(
            `INSERT INTO ${config.prefix}postmeta (post_id, meta_key, meta_value) VALUES (?, ?, ?)`,
            [
              id,
              key,
              typeof value === "object" ? JSON.stringify(value) : String(value),
            ],
          );
        }
      }

      // Fetch the updated document
      return this.findByID({ collection, id, ...rest });
    },

    // Delete document
    async delete({ collection, id, ...rest }) {
      const databaseType = getDatabaseForCollection(
        collection,
        config.collectionMapping,
        options.mode,
      );

      if (databaseType === "postgres" && postgresDB) {
        return postgresDB.delete({ collection, id, ...rest });
      }

      // WordPress implementation
      // First get the document to return
      const doc = await this.findByID({ collection, id, ...rest });

      // Delete meta
      await mysqlPool.execute(
        `DELETE FROM ${config.prefix}postmeta WHERE post_id = ?`,
        [id],
      );

      // Delete post
      await mysqlPool.execute(
        `DELETE FROM ${config.prefix}posts WHERE ID = ?`,
        [id],
      );

      return doc;
    },

    // Additional methods required for the adapter interface
    async init() {
      if (postgresDB) {
        await postgresDB.init();
      }
      return null;
    },

    // Migration utilities
    async migrate() {
      if (postgresDB) {
        return postgresDB.migrate();
      }
      return null;
    },

    // Expose the MySQL pool and Postgres adapter for direct access
    mysql: mysqlPool,
    postgres: postgresDB,

    // Add custom utilities for this adapter
    tables: {
      posts: `${config.prefix}posts`,
      postmeta: `${config.prefix}postmeta`,
      users: `${config.prefix}users`,
      usermeta: `${config.prefix}usermeta`,
      terms: `${config.prefix}terms`,
      term_relationships: `${config.prefix}term_relationships`,
      term_taxonomy: `${config.prefix}term_taxonomy`,
    },

    // Custom method to get WordPress tables
    async getWordPressTables() {
      const [tables] = await mysqlPool.execute(
        `SHOW TABLES LIKE '${config.prefix}%'`,
      );
      return tables;
    },

    // Method to migrate from WordPress to Postgres
    async migrateWordPressToPostgres(collections: string[] = []) {
      if (!postgresDB) {
        throw new Error("PostgreSQL adapter is not initialized");
      }

      // For each collection to migrate
      for (const collection of collections) {
        // Get all documents from WordPress
        const docs = await this.find({
          collection,
          query: { limit: 1000 }, // Use pagination for large datasets
        });

        // Insert into Postgres
        for (const doc of docs) {
          await postgresDB.create({
            collection,
            data: doc,
          });
        }
      }

      return { success: true };
    },
  };

  return adapter;
};

// Helper function to determine which database to use for a collection
function getDatabaseForCollection(
  collection: string,
  mapping: Record<string, "postgres" | "wordpress">,
  mode: "sql-only" | "both" | "migration",
): "postgres" | "wordpress" {
  if (mode === "sql-only") {
    return "wordpress";
  }

  // Check mapping
  if (mapping[collection]) {
    return mapping[collection];
  }

  // Default to WordPress in both mode
  return "wordpress";
}

// Helper to format WordPress posts to Payload documents
function formatWordPressResults(rows: any[], collection: string) {
  // Group by post ID
  const postMap: Record<string, any> = {};

  if (!Array.isArray(rows)) {
    return [];
  }

  rows.forEach((row) => {
    if (!postMap[row.ID]) {
      postMap[row.ID] = {
        id: row.ID,
        title: row.post_title,
        content: row.post_content,
        status: mapWordPressStatusToPayload(row.post_status),
        createdAt: row.post_date,
        updatedAt: row.post_modified,
        meta: {},
      };
    }

    // Add meta data
    if (row.meta_key && row.meta_value) {
      postMap[row.ID].meta[row.meta_key] = row.meta_value;
    }
  });

  return Object.values(postMap);
}

// Helper to map collection name to WordPress post_type
function mapCollectionToPostType(collection: string): string {
  // Simple mapping - could be expanded
  switch (collection) {
    case "pages":
      return "page";
    case "posts":
      return "post";
    case "media":
      return "attachment";
    default:
      return collection;
  }
}

// Map Payload status to WordPress status
function mapPayloadStatusToWordPress(status: string | undefined): string {
  if (!status) return "publish";

  switch (status) {
    case "published":
      return "publish";
    case "draft":
      return "draft";
    default:
      return status;
  }
}

// Map WordPress status to Payload status
function mapWordPressStatusToPayload(status: string): string {
  switch (status) {
    case "publish":
      return "published";
    case "draft":
      return "draft";
    default:
      return status;
  }
}
