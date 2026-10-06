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
import SuperAdminDashboard from "./components/SuperAdminDashboard";
import SuperAdminLogin from "./components/SuperAdminLogin";
import ServerDownScreen from "./components/ServerDownScreen";

export default function App() {
  return (
    <ErrorBoundary>
      <Router>
        <Routes>
          {/* Server Down / Maintenance Screen */}
          <Route path="/server-down" element={<ServerDownScreen />} />
          <Route path="/offline" element={<ServerDownScreen />} />
          <Route path="/maintenance" element={<ServerDownScreen />} />

          {/* Super Admin Central Command */}
          <Route path="/super-admin" element={<SuperAdminDashboard />} />
          <Route path="/super-admin/login" element={<SuperAdminLogin />} />
          {/* Typo & Alias Redirects */}
          <Route path="/supar-admin" element={<Navigate to="/super-admin" replace />} />
          <Route path="/supar-admin/login" element={<Navigate to="/super-admin/login" replace />} />
          <Route path="/suparadmin" element={<Navigate to="/super-admin" replace />} />
          <Route path="/suparadmin/login" element={<Navigate to="/super-admin/login" replace />} />
          <Route path="/superadmin" element={<Navigate to="/super-admin" replace />} />
          <Route path="/superadmin/login" element={<Navigate to="/super-admin/login" replace />} />

          {/* Restaurant Specific Handover Routes */}
          <Route path="/r/:restaurantSlug/server-down" element={<ServerDownScreen />} />
          <Route path="/r/:restaurantSlug" element={<Menu />} />
          <Route path="/r/:restaurantSlug/:tableId" element={<Menu />} />
          <Route path="/r/:restaurantSlug/table/:tableId" element={<Menu />} />
          <Route path="/r/:restaurantSlug/login" element={<Login />} />
          <Route path="/r/:restaurantSlug/admin" element={<AdminDashboard />} />
          <Route path="/r/:restaurantSlug/admin/table-history/:tableId" element={<TableHistory />} />

          {/* Direct & Legacy Routes */}
          <Route path="/login" element={<Login />} />
          <Route path="/admin" element={<AdminDashboard />} />
          <Route path="/admin/table-history/:tableId" element={<TableHistory />} />
          <Route path="/table/:tableId" element={<Menu />} />
          <Route path="/:tableId" element={<Menu />} />
          <Route path="/" element={<Menu />} />
          <Route path="*" element={<ServerDownScreen errorCode="404 RESTAURANT ENDPOINT NOT FOUND" customMessage="The page or restaurant server endpoint you requested cannot be located. The server might be resting or the URL link may have moved." />} />
        </Routes>
      </Router>
    </ErrorBoundary>
  );
}

