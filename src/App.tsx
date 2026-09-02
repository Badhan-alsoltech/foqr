/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from "react";
import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";
import { ErrorBoundary } from "./components/ErrorBoundary";
import Menu from "./components/Menu";
import Login from "./components/Login";
import AdminDashboard from "./components/AdminDashboard";
import TableHistory from "./components/TableHistory";

export default function App() {
  return (
    <ErrorBoundary>
      <Router>
        <Routes>
          <Route path="/" element={<Menu />} />
          <Route path="/:tableId" element={<Menu />} />
          <Route path="/table/:tableId" element={<Menu />} />
          <Route path="/login" element={<Login />} />
          <Route path="/admin" element={<AdminDashboard />} />
          <Route path="/admin/table-history/:tableId" element={<TableHistory />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Router>
    </ErrorBoundary>
  );
}

