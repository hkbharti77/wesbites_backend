export function requirePermission(permissionKey) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        error: 'Authentication required.',
        code: 'UNAUTHENTICATED',
      });
    }

    // Super Admin has unrestricted access to all operations
    if (req.user.isSuperAdmin) {
      return next();
    }

    if (Array.isArray(req.user.permissions) && req.user.permissions.includes(permissionKey)) {
      return next();
    }

    return res.status(403).json({
      error: `Access Denied: You lack the required permission '${permissionKey}' for this action.`,
      code: 'FORBIDDEN',
      requiredPermission: permissionKey,
    });
  };
}

export function requireAnyPermission(permissionKeys = []) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        error: 'Authentication required.',
        code: 'UNAUTHENTICATED',
      });
    }

    if (req.user.isSuperAdmin) {
      return next();
    }

    const hasAny = permissionKeys.some(pk => req.user.permissions?.includes(pk));
    if (hasAny) {
      return next();
    }

    return res.status(403).json({
      error: 'Access Denied: You lack the required permissions for this action.',
      code: 'FORBIDDEN',
      requiredPermissions: permissionKeys,
    });
  };
}
