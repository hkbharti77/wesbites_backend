import { ObjectId } from 'mongodb';
import { getDb } from '../db/connection.js';

export const SUPER_ADMIN_ROLE_KEY = 'super_admin';

/**
 * Resolves all effective permission keys for a given user doc
 */
export async function resolveUserPermissions(user) {
  if (!user || !user.roleIds || user.roleIds.length === 0) {
    return { roles: [], permissions: [], isSuperAdmin: false };
  }

  const db = getDb();
  const rolesCol = db.collection('admin_roles');

  const roleObjectIds = user.roleIds.map(id =>
    typeof id === 'string' ? new ObjectId(id) : id
  );

  const roles = await rolesCol.find({ _id: { $in: roleObjectIds } }).toArray();

  const isSuperAdmin = roles.some(r => r.key === SUPER_ADMIN_ROLE_KEY);

  let permissionKeys = new Set();

  if (isSuperAdmin) {
    // Super admin automatically inherits all available permissions in the system
    const permsCol = db.collection('admin_permissions');
    const allPerms = await permsCol.find({}).toArray();
    allPerms.forEach(p => permissionKeys.add(p.key));
  } else {
    for (const r of roles) {
      if (Array.isArray(r.permissionKeys)) {
        r.permissionKeys.forEach(pk => permissionKeys.add(pk));
      }
    }
  }

  return {
    roles: roles.map(r => ({
      id: r._id.toString(),
      key: r.key,
      name: r.name,
      isSystemRole: Boolean(r.isSystemRole),
    })),
    permissions: Array.from(permissionKeys),
    isSuperAdmin,
  };
}

/**
 * Ensures that the system always has at least one active Super Admin.
 * Returns true if action is allowed; throws error if it violates the safety rule.
 */
export async function ensureLastSuperAdminProtected(targetUserId, willBeDeactivatedOrDemoted) {
  if (!willBeDeactivatedOrDemoted) return true;

  const db = getDb();
  const rolesCol = db.collection('admin_roles');
  const usersCol = db.collection('admin_users');

  const superAdminRole = await rolesCol.findOne({ key: SUPER_ADMIN_ROLE_KEY });
  if (!superAdminRole) return true;

  const targetId = typeof targetUserId === 'string' ? new ObjectId(targetUserId) : targetUserId;
  const targetUser = await usersCol.findOne({ _id: targetId });
  if (!targetUser) return true;

  const hasSuperAdminRole = targetUser.roleIds?.some(
    rid => rid.toString() === superAdminRole._id.toString()
  );

  // If target user is not a Super Admin, action is safe
  if (!hasSuperAdminRole) return true;

  // Count active Super Admins excluding this user
  const otherSuperAdminsCount = await usersCol.countDocuments({
    _id: { $ne: targetId },
    status: 'active',
    roleIds: superAdminRole._id,
  });

  if (otherSuperAdminsCount === 0) {
    const error = new Error('Operation rejected: Cannot deactivate, demote, or delete the last active Super Admin account.');
    error.statusCode = 400;
    error.code = 'LAST_SUPER_ADMIN_PROTECTED';
    throw error;
  }

  return true;
}
