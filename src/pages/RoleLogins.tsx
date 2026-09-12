/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { Navigate } from 'react-router-dom';

export function UserLogin() {
  return <Navigate to="/login?tab=user" replace />;
}

export function DriverLogin() {
  return <Navigate to="/login?tab=driver" replace />;
}

export function AdminLogin() {
  return <Navigate to="/admin-login" replace />;
}
