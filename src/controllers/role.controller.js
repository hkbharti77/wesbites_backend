import { ObjectId } from 'mongodb';
import { getDb } from '../db/connection.js';
import { logAuditEvent } from '../services/audit.service.js';

export async function getRoles(req, res) {
  try {
    const db = getDb();
    const rolesCol = db.collection('admin_roles');
    const roles = await rolesCol.find({}).sort({ isSystemRole: -1, name: 1 }).toArray();

    return res.status(200).json({
      roles: roles.map(r => ({
        id: r._id.toString(),
        key: r.key,
        name: r.name,
        description: r.description || '',
        permissionKeys: r.permissionKeys || [],
        isSystemRole: Boolean(r.isSystemRole),
        createdAt: r.createdAt,
        updatedAt: r.updatedAt,
      })),
    });
  } catch (err) {
    console.error('Get Roles Controller Error:', err);
    return res.status(500).json({ error: 'Failed to retrieve roles.', code: 'SERVER_ERROR' });
  }
}

export async function createRole(req, res) {
  try {
    const { key, name, description, permissionKeys = [] } = req.body || {};

    if (!key || !name) {
      return res.status(400).json({
        error: 'Role key and name are required.',
        code: 'VALIDATION_ERROR',
      });
    }

    const formattedKey = key.trim().toLowerCase().replace(/[^a-z0-9_]/g, '_');

    // Privilege escalation check: Non-Super Admin cannot create roles with permissions they don't possess
    if (!req.user.isSuperAdmin) {
      const callerPerms = new Set(req.user.permissions || []);
      const requestedPerms = Array.isArray(permissionKeys) ? permissionKeys : [];
      const unauthorizedPerms = requestedPerms.filter(p => !callerPerms.has(p));
      if (unauthorizedPerms.length > 0) {
        return res.status(403).json({
          error: `Privilege Escalation Blocked: You cannot grant permissions you do not possess (${unauthorizedPerms.join(', ')}).`,
          code: 'PRIVILEGE_ESCALATION_DENIED',
        });
      }
    }

    const db = getDb();
    const rolesCol = db.collection('admin_roles');

    const existing = await rolesCol.findOne({ key: formattedKey });
    if (existing) {
      return res.status(409).json({
        error: `Role with key '${formattedKey}' already exists.`,
        code: 'ROLE_KEY_EXISTS',
      });
    }

    const now = new Date();
    const newRole = {
      key: formattedKey,
      name: name.trim(),
      description: description ? description.trim() : '',
      permissionKeys: Array.isArray(permissionKeys) ? permissionKeys : [],
      isSystemRole: false,
      createdAt: now,
      updatedAt: now,
    };

    const result = await rolesCol.insertOne(newRole);
    const createdId = result.insertedId.toString();

    await logAuditEvent({
      actorUserId: req.user.id,
      actorEmail: req.user.email,
      action: 'ROLE_CREATED',
      targetType: 'admin_role',
      targetId: createdId,
      outcome: 'SUCCESS',
      metadata: { key: formattedKey, name: newRole.name, permissionsCount: newRole.permissionKeys.length },
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    });

    return res.status(201).json({
      success: true,
      role: {
        id: createdId,
        ...newRole,
      },
    });
  } catch (err) {
    console.error('Create Role Controller Error:', err);
    return res.status(500).json({ error: 'Failed to create role.', code: 'SERVER_ERROR' });
  }
}

export async function updateRole(req, res) {
  try {
    const { id } = req.params;
    const { name, description, permissionKeys } = req.body || {};

    if (!ObjectId.isValid(id)) {
      return res.status(400).json({ error: 'Invalid role ID format.', code: 'INVALID_ID' });
    }

    const db = getDb();
    const rolesCol = db.collection('admin_roles');
    const existing = await rolesCol.findOne({ _id: new ObjectId(id) });

    if (!existing) {
      return res.status(404).json({ error: 'Role not found.', code: 'NOT_FOUND' });
    }

    // System role protection: Only Super Admins can update system roles
    if (existing.isSystemRole && !req.user.isSuperAdmin) {
      return res.status(403).json({
        error: 'Access Denied: System roles can only be modified by a Super Admin.',
        code: 'SYSTEM_ROLE_PROTECTED',
      });
    }

    const updateFields = { updatedAt: new Date() };

    if (name) updateFields.name = name.trim();
    if (description !== undefined) updateFields.description = description.trim();
    if (Array.isArray(permissionKeys)) {
      // Super admin role retains all permissions
      if (existing.key === 'super_admin') {
        return res.status(400).json({
          error: 'Super Admin permissions are comprehensive and cannot be modified.',
          code: 'SUPER_ADMIN_IMMUTABLE',
        });
      }

      // Privilege escalation check: Non-Super Admin cannot assign permissions they don't possess
      if (!req.user.isSuperAdmin) {
        const callerPerms = new Set(req.user.permissions || []);
        const unauthorizedPerms = permissionKeys.filter(p => !callerPerms.has(p));
        if (unauthorizedPerms.length > 0) {
          return res.status(403).json({
            error: `Privilege Escalation Blocked: You cannot grant permissions you do not possess (${unauthorizedPerms.join(', ')}).`,
            code: 'PRIVILEGE_ESCALATION_DENIED',
          });
        }
      }

      updateFields.permissionKeys = permissionKeys;
    }

    await rolesCol.updateOne({ _id: new ObjectId(id) }, { $set: updateFields });

    await logAuditEvent({
      actorUserId: req.user.id,
      actorEmail: req.user.email,
      action: 'ROLE_UPDATED',
      targetType: 'admin_role',
      targetId: id,
      outcome: 'SUCCESS',
      metadata: { roleKey: existing.key, updatedFields: Object.keys(updateFields) },
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    });

    return res.status(200).json({
      success: true,
      message: 'Role updated successfully.',
    });
  } catch (err) {
    console.error('Update Role Controller Error:', err);
    return res.status(500).json({ error: 'Failed to update role.', code: 'SERVER_ERROR' });
  }
}

export async function deleteRole(req, res) {
  try {
    const { id } = req.params;
    if (!ObjectId.isValid(id)) {
      return res.status(400).json({ error: 'Invalid role ID format.', code: 'INVALID_ID' });
    }

    const db = getDb();
    const rolesCol = db.collection('admin_roles');
    const usersCol = db.collection('admin_users');

    const role = await rolesCol.findOne({ _id: new ObjectId(id) });
    if (!role) {
      return res.status(404).json({ error: 'Role not found.', code: 'NOT_FOUND' });
    }

    if (role.isSystemRole) {
      return res.status(403).json({
        error: 'System roles are integral to platform operation and cannot be deleted.',
        code: 'SYSTEM_ROLE_PROTECTED',
      });
    }

    // Check if any users currently have this role
    const usersWithRole = await usersCol.countDocuments({ roleIds: new ObjectId(id) });
    if (usersWithRole > 0) {
      return res.status(400).json({
        error: `Cannot delete role: ${usersWithRole} administrative users are currently assigned this role.`,
        code: 'ROLE_IN_USE',
      });
    }

    await rolesCol.deleteOne({ _id: new ObjectId(id) });

    await logAuditEvent({
      actorUserId: req.user.id,
      actorEmail: req.user.email,
      action: 'ROLE_DELETED',
      targetType: 'admin_role',
      targetId: id,
      outcome: 'SUCCESS',
      metadata: { roleKey: role.key },
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    });

    return res.status(200).json({
      success: true,
      message: 'Role deleted successfully.',
    });
  } catch (err) {
    console.error('Delete Role Controller Error:', err);
    return res.status(500).json({ error: 'Failed to delete role.', code: 'SERVER_ERROR' });
  }
}

export async function getPermissions(req, res) {
  try {
    const db = getDb();
    const permsCol = db.collection('admin_permissions');
    const permissions = await permsCol.find({}).sort({ resource: 1, action: 1 }).toArray();

    // Group by resource for clear UI rendering
    const grouped = {};
    for (const p of permissions) {
      const resName = p.resource || 'general';
      if (!grouped[resName]) {
        grouped[resName] = [];
      }
      grouped[resName].push({
        id: p._id.toString(),
        key: p.key,
        resource: p.resource,
        action: p.action,
        description: p.description || '',
      });
    }

    return res.status(200).json({
      permissions: permissions.map(p => ({
        id: p._id.toString(),
        key: p.key,
        resource: p.resource,
        action: p.action,
        description: p.description || '',
      })),
      grouped,
    });
  } catch (err) {
    console.error('Get Permissions Controller Error:', err);
    return res.status(500).json({ error: 'Failed to retrieve permissions.', code: 'SERVER_ERROR' });
  }
}
