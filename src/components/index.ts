"use client";

import React from "react";

// Temporary placeholder components
const PostgresOnlyPanel = () =>
  React.createElement("div", null, "PostgreSQL Only Panel");
const SQLOnlyPanel = () => React.createElement("div", null, "SQL Only Panel");
const DualModePanel = () => React.createElement("div", null, "Dual Mode Panel");
const MigrationPanel = () =>
  React.createElement("div", null, "Migration Panel");

export { PostgresOnlyPanel, SQLOnlyPanel, DualModePanel, MigrationPanel };
