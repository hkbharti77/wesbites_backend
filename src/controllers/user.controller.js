import { ObjectId } from 'mongodb';
import { getDb } from '../db/connection.js';
import { hashPassword, normalizeEmail } from '../utils/crypto.js';
import {
  resolveUserPermissions,
  ensureLastSuperAdminProtected,
  SUPER_ADMIN_ROLE_KEY,
} from '../services/rbac.service.js';
import { revokeAllUserSessions } from '../services/session.service.js';
import { logAuditEvent } from '../services/audit.service.js';

export async function getUsers(req, res) {
  try {
    const {
      page = 1,
      limit = 10,
      search = '',
      status = '',
      roleId = '',
      sortBy = 'createdAt',
      sortDir = 'desc',
    } = req.query;

    const db = getDb();
    const usersCol = db.collection('admin_users');
    const rolesCol = db.collection('admin_roles');

    const filter = {};

    if (search && search.trim()) {
      const term = search.trim();
      filter.$or = [
        { name: { $regex: term, $options: 'i' } },
        { emailNormalized: { $regex: term.toLowerCase(), $options: 'i' } },
      ];
    }

    if (status) {
      filter.status = status;
    }

    if (roleId) {
      filter.roleIds = new ObjectId(roleId);
    }

    const pageNum = Math.max(1, parseInt(page, 10));
    const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10)));
    const skip = (pageNum - 1) * limitNum;

    const sortOrder = sortDir === 'asc' ? 1 : -1;
    const sort = { [sortBy]: sortOrder };

    const [total, rawUsers, allRoles] = await Promise.all([
      usersCol.countDocuments(filter),
      usersCol.find(filter).sort(sort).skip(skip).limit(limitNum).toArray(),
      rolesCol.find({}).toArray(),
    ]);

    const roleMap = new Map(allRoles.map(r => [r._id.toString(), r]));

    const users = rawUsers.map(u => {
      const userRoles = (u.roleIds || [])
        .map(rid => roleMap.get(rid.toString()))
        .filter(Boolean)
        .map(r => ({ id: r._id.toString(), key: r.key, name: r.name }));

      return {
        id: u._id.toString(),
        name: u.name,
        email: u.emailNormalized,
        status: u.status,
        roles: userRoles,
        lastLoginAt: u.lastLoginAt || null,
        passwordChangedAt: u.passwordChangedAt || null,
        createdAt: u.createdAt,
        updatedAt: u.updatedAt,
      };
    });

    return res.status(200).json({
      users,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        totalPages: Math.ceil(total / limitNum),
      },
    });
  } catch (err) {
    console.error('Get Users Controller Error:', err);
    return res.status(500).json({
      error: 'Failed to retrieve administrative users.',
      code: 'SERVER_ERROR',
    });
  }
}

export async function getUserById(req, res) {
  try {
    const { id } = req.params;
    if (!ObjectId.isValid(id)) {
      return res.status(400).json({ error: 'Invalid user ID format.', code: 'INVALID_ID' });
    }

    const db = getDb();
    const usersCol = db.collection('admin_users');
    const user = await usersCol.findOne({ _id: new ObjectId(id) });

    if (!user) {
      return res.status(404).json({ error: 'User not found.', code: 'NOT_FOUND' });
    }

    const { roles, permissions, isSuperAdmin } = await resolveUserPermissions(user);

    return res.status(200).json({
      user: {
        id: user._id.toString(),
        name: user.name,
        email: user.emailNormalized,
        status: user.status,
        roles,
        permissions,
        isSuperAdmin,
        lastLoginAt: user.lastLoginAt,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
      },
    });
  } catch (err) {
    console.error('Get User By ID Error:', err);
    return res.status(500).json({ error: 'Failed to retrieve user details.', code: 'SERVER_ERROR' });
  }
}

export async function createUser(req, res) {
  try {
    const { name, email, password, roleIds = [], status = 'active' } = req.body || {};

    if (!name || !email || !password) {
      return res.status(400).json({
        error: 'Name, email, and password are required fields.',
        code: 'VALIDATION_ERROR',
      });
    }

    if (password.length < 8) {
      return res.status(400).json({
        error: 'Password must be at least 8 characters long.',
        code: 'PASSWORD_TOO_SHORT',
      });
    }

    const emailNormalized = normalizeEmail(email);
    const db = getDb();
    const usersCol = db.collection('admin_users');
    const rolesCol = db.collection('admin_roles');

    // Check duplicate email
    const existing = await usersCol.findOne({ emailNormalized });
    if (existing) {
      return res.status(409).json({
        error: 'An administrative account with this email address already exists.',
        code: 'EMAIL_ALREADY_EXISTS',
      });
    }

    // Validate roleIds and prevent privilege escalation
    const roleObjectIds = [];
    if (Array.isArray(roleIds) && roleIds.length > 0) {
      for (const rId of roleIds) {
        if (!ObjectId.isValid(rId)) {
          return res.status(400).json({ error: `Invalid role ID: ${rId}`, code: 'INVALID_ROLE_ID' });
        }
        roleObjectIds.push(new ObjectId(rId));
      }

      const assignedRoles = await rolesCol.find({ _id: { $in: roleObjectIds } }).toArray();

      // Privilege escalation check: Non-Super Admin cannot assign Super Admin role
      const assignsSuperAdmin = assignedRoles.some(r => r.key === SUPER_ADMIN_ROLE_KEY);
      if (assignsSuperAdmin && !req.user.isSuperAdmin) {
        return res.status(403).json({
          error: 'Privilege Escalation Blocked: Only an active Super Admin can assign the Super Admin role.',
          code: 'PRIVILEGE_ESCALATION_DENIED',
        });
      }

      // Privilege escalation check: Non-Super Admin cannot assign roles with permissions they don't possess
      if (!req.user.isSuperAdmin) {
        const callerPerms = new Set(req.user.permissions || []);
        for (const role of assignedRoles) {
          const exceedingPerms = (role.permissionKeys || []).filter(p => !callerPerms.has(p));
          if (exceedingPerms.length > 0) {
            return res.status(403).json({
              error: `Privilege Escalation Blocked: Cannot assign role '${role.name}' which contains permissions you do not possess (${exceedingPerms.join(', ')}).`,
              code: 'PRIVILEGE_ESCALATION_DENIED',
            });
          }
        }
      }
    }

    const passwordHash = await hashPassword(password);
    const now = new Date();

    const newUserDoc = {
      name: name.trim(),
      emailNormalized,
      passwordHash,
      roleIds: roleObjectIds,
      status: status === 'inactive' ? 'inactive' : 'active',
      lastLoginAt: null,
      passwordChangedAt: now,
      createdAt: now,
      updatedAt: now,
    };

    const result = await usersCol.insertOne(newUserDoc);
    const createdId = result.insertedId.toString();

    await logAuditEvent({
      actorUserId: req.user.id,
      actorEmail: req.user.email,
      action: 'USER_CREATED',
      targetType: 'admin_user',
      targetId: createdId,
      outcome: 'SUCCESS',
      metadata: { name: newUserDoc.name, emailNormalized, roleCount: roleObjectIds.length },
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    });

    return res.status(201).json({
      success: true,
      user: {
        id: createdId,
        name: newUserDoc.name,
        email: emailNormalized,
        status: newUserDoc.status,
        roleIds: roleObjectIds.map(id => id.toString()),
        createdAt: now,
      },
    });
  } catch (err) {
    console.error('Create User Controller Error:', err);
    return res.status(500).json({ error: 'Failed to create administrative user.', code: 'SERVER_ERROR' });
  }
}

export async function updateUser(req, res) {
  try {
    const { id } = req.params;
    const { name, roleIds, status, password } = req.body || {};

    if (!ObjectId.isValid(id)) {
      return res.status(400).json({ error: 'Invalid user ID format.', code: 'INVALID_ID' });
    }

    const db = getDb();
    const usersCol = db.collection('admin_users');
    const rolesCol = db.collection('admin_roles');

    const existingUser = await usersCol.findOne({ _id: new ObjectId(id) });
    if (!existingUser) {
      return res.status(404).json({ error: 'User not found.', code: 'NOT_FOUND' });
    }

    // Protection check: Non-Super Admin cannot modify any Super Admin account
    const superAdminRole = await rolesCol.findOne({ key: SUPER_ADMIN_ROLE_KEY });
    const targetIsSuperAdmin = superAdminRole && existingUser.roleIds?.some(
      rid => rid.toString() === superAdminRole._id.toString()
    );

    if (targetIsSuperAdmin && !req.user.isSuperAdmin) {
      return res.status(403).json({
        error: 'Privilege Escalation Blocked: Non-Super Admins cannot modify or reset credentials for a Super Admin account.',
        code: 'SUPER_ADMIN_PROTECTED',
      });
    }

    const updateFields = { updatedAt: new Date() };

    if (name && typeof name === 'string') {
      updateFields.name = name.trim();
    }

    // Role updates & privilege escalation checks
    if (Array.isArray(roleIds)) {
      const roleObjectIds = [];
      for (const rId of roleIds) {
        if (!ObjectId.isValid(rId)) {
          return res.status(400).json({ error: `Invalid role ID: ${rId}`, code: 'INVALID_ROLE_ID' });
        }
        roleObjectIds.push(new ObjectId(rId));
      }

      const assignedRoles = await rolesCol.find({ _id: { $in: roleObjectIds } }).toArray();
      const assignsSuperAdmin = assignedRoles.some(r => r.key === SUPER_ADMIN_ROLE_KEY);

      if (assignsSuperAdmin && !req.user.isSuperAdmin) {
        return res.status(403).json({
          error: 'Privilege Escalation Blocked: Only a Super Admin can grant the Super Admin role.',
          code: 'PRIVILEGE_ESCALATION_DENIED',
        });
      }

      // Privilege escalation check: Non-Super Admin cannot assign roles with permissions they don't possess
      if (!req.user.isSuperAdmin) {
        const callerPerms = new Set(req.user.permissions || []);
        for (const role of assignedRoles) {
          const exceedingPerms = (role.permissionKeys || []).filter(p => !callerPerms.has(p));
          if (exceedingPerms.length > 0) {
            return res.status(403).json({
              error: `Privilege Escalation Blocked: Cannot assign role '${role.name}' which contains permissions you do not possess (${exceedingPerms.join(', ')}).`,
              code: 'PRIVILEGE_ESCALATION_DENIED',
            });
          }
        }
      }

      // Check if this action demotes a Super Admin
      const isDemoting = !assignsSuperAdmin;
      await ensureLastSuperAdminProtected(id, isDemoting);

      updateFields.roleIds = roleObjectIds;
    }

    // Status updates
    if (status && (status === 'active' || status === 'inactive')) {
      if (status === 'inactive') {
        // Protected check: Cannot deactivate the last Super Admin
        await ensureLastSuperAdminProtected(id, true);
        // Revoke all existing sessions immediately
        await revokeAllUserSessions(id);
      }
      updateFields.status = status;
    }

    // Password reset if supplied by admin
    if (password) {
      if (password.length < 8) {
        return res.status(400).json({
          error: 'New password must be at least 8 characters long.',
          code: 'PASSWORD_TOO_SHORT',
        });
      }
      updateFields.passwordHash = await hashPassword(password);
      updateFields.passwordChangedAt = new Date();
      // Revoke all sessions for this user on password change
      await revokeAllUserSessions(id);
    }

    await usersCol.updateOne({ _id: new ObjectId(id) }, { $set: updateFields });

    await logAuditEvent({
      actorUserId: req.user.id,
      actorEmail: req.user.email,
      action: 'USER_UPDATED',
      targetType: 'admin_user',
      targetId: id,
      outcome: 'SUCCESS',
      metadata: { updatedFields: Object.keys(updateFields) },
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    });

    return res.status(200).json({
      success: true,
      message: 'User profile updated successfully.',
    });
  } catch (err) {
    if (err.code === 'LAST_SUPER_ADMIN_PROTECTED') {
      return res.status(400).json({ error: err.message, code: err.code });
    }
    console.error('Update User Controller Error:', err);
    return res.status(500).json({ error: 'Failed to update administrative user.', code: 'SERVER_ERROR' });
  }
}

export async function deleteUser(req, res) {
  try {
    const { id } = req.params;
    if (!ObjectId.isValid(id)) {
      return res.status(400).json({ error: 'Invalid user ID format.', code: 'INVALID_ID' });
    }

    const db = getDb();
    const usersCol = db.collection('admin_users');
    const rolesCol = db.collection('admin_roles');

    const existingUser = await usersCol.findOne({ _id: new ObjectId(id) });
    if (!existingUser) {
      return res.status(404).json({ error: 'User not found.', code: 'NOT_FOUND' });
    }

    // Protection check: Non-Super Admin cannot delete a Super Admin account
    const superAdminRole = await rolesCol.findOne({ key: SUPER_ADMIN_ROLE_KEY });
    const targetIsSuperAdmin = superAdminRole && existingUser.roleIds?.some(
      rid => rid.toString() === superAdminRole._id.toString()
    );

    if (targetIsSuperAdmin && !req.user.isSuperAdmin) {
      return res.status(403).json({
        error: 'Access Denied: Only a Super Admin can delete a Super Admin account.',
        code: 'SUPER_ADMIN_PROTECTED',
      });
    }

    // Protection check: Cannot delete the last active Super Admin
    await ensureLastSuperAdminProtected(id, true);

    // Revoke sessions
    await revokeAllUserSessions(id);

    // Delete user
    const result = await usersCol.deleteOne({ _id: new ObjectId(id) });
    if (result.deletedCount === 0) {
      return res.status(404).json({ error: 'User not found.', code: 'NOT_FOUND' });
    }

    await logAuditEvent({
      actorUserId: req.user.id,
      actorEmail: req.user.email,
      action: 'USER_DELETED',
      targetType: 'admin_user',
      targetId: id,
      outcome: 'SUCCESS',
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    });

    return res.status(200).json({
      success: true,
      message: 'User account removed successfully.',
    });
  } catch (err) {
    if (err.code === 'LAST_SUPER_ADMIN_PROTECTED') {
      return res.status(400).json({ error: err.message, code: err.code });
    }
    console.error('Delete User Controller Error:', err);
    return res.status(500).json({ error: 'Failed to delete user account.', code: 'SERVER_ERROR' });
  }
}
