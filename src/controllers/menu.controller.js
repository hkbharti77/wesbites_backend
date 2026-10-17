import { ObjectId } from 'mongodb';
import { getDb } from '../db/connection.js';
import { logAuditEvent } from '../services/audit.service.js';

// Approved, sanitized administration route keys to prevent arbitrary code or malicious navigation injection
export const APPROVED_ROUTES = new Set([
  '/admin/dashboard',
  '/admin/users',
  '/admin/roles',
  '/admin/permissions',
  '/admin/menus',
  '/admin/audit-logs',
  '/admin/settings',
  '/admin/create',
  '/admin/blog-manager',
  '/admin/blog/categories',
  '/admin/media',
  '/admin/portfolio-media',
  '/admin/blog/analytics',
  '/admin/blog/seo',
  '/admin/cookies',
  '/admin/subscribers',
  '/admin/leads',
  '/admin/website-theme',
  '/admin/403',
]);

export async function getMenus(req, res) {
  try {
    const db = getDb();
    const menusCol = db.collection('admin_menus');
    const items = await menusCol.find({}).sort({ sortOrder: 1, createdAt: 1 }).toArray();

    return res.status(200).json({
      menus: items.map(m => ({
        id: m._id.toString(),
        label: m.label,
        icon: m.icon || 'FileText',
        routeKey: m.routeKey || '',
        parentId: m.parentId ? m.parentId.toString() : null,
        requiredPermission: m.requiredPermission || null,
        sortOrder: m.sortOrder ?? 0,
        enabled: Boolean(m.enabled),
        createdAt: m.createdAt,
        updatedAt: m.updatedAt,
      })),
      approvedRoutes: Array.from(APPROVED_ROUTES),
    });
  } catch (err) {
    console.error('Get Menus Controller Error:', err);
    return res.status(500).json({ error: 'Failed to retrieve menus.', code: 'SERVER_ERROR' });
  }
}

/**
 * Filtered dynamic menu response returning ONLY items authorized for current user
 */
export async function getMenuConfig(req, res) {
  try {
    const user = req.user;
    const db = getDb();
    const menusCol = db.collection('admin_menus');

    // Fetch enabled items sorted by sortOrder
    const items = await menusCol.find({ enabled: true }).sort({ sortOrder: 1 }).toArray();

    // Filter items based on permissions
    const authorizedItems = items.filter(item => {
      // If no permission required, accessible to all authenticated admins
      if (!item.requiredPermission) return true;
      // Super admin has access to everything
      if (user.isSuperAdmin) return true;
      // Check user permissions
      return user.permissions?.includes(item.requiredPermission);
    });

    // Build hierarchy (nested tree: parents with children)
    const itemMap = new Map();
    const rootItems = [];

    authorizedItems.forEach(item => {
      const sanitized = {
        id: item._id.toString(),
        label: item.label,
        icon: item.icon || 'FileText',
        routeKey: item.routeKey || '',
        sortOrder: item.sortOrder ?? 0,
        children: [],
      };
      itemMap.set(item._id.toString(), sanitized);
    });

    authorizedItems.forEach(item => {
      const formatted = itemMap.get(item._id.toString());
      if (item.parentId && itemMap.has(item.parentId.toString())) {
        const parent = itemMap.get(item.parentId.toString());
        parent.children.push(formatted);
      } else {
        rootItems.push(formatted);
      }
    });

    return res.status(200).json({
      menus: rootItems,
    });
  } catch (err) {
    console.error('Get Menu Config Error:', err);
    // Safe fallback so the UI never bricks
    return res.status(200).json({
      menus: [
        { id: 'fb-dash', label: 'Dashboard', icon: 'LayoutDashboard', routeKey: '/admin/dashboard', children: [] },
        { id: 'fb-users', label: 'Users', icon: 'Users', routeKey: '/admin/users', children: [] },
      ],
      fallback: true,
    });
  }
}

export async function createMenuItem(req, res) {
  try {
    const { label, icon, routeKey, parentId, requiredPermission, sortOrder = 0, enabled = true } = req.body || {};

    if (!label) {
      return res.status(400).json({ error: 'Menu label is required.', code: 'VALIDATION_ERROR' });
    }

    // Validate routeKey against approved routes if supplied
    if (routeKey && !APPROVED_ROUTES.has(routeKey)) {
      return res.status(400).json({
        error: `Invalid routeKey: '${routeKey}' is not an approved admin route.`,
        code: 'INVALID_ROUTE_KEY',
        approvedRoutes: Array.from(APPROVED_ROUTES),
      });
    }

    const db = getDb();
    const menusCol = db.collection('admin_menus');

    let parentObjectId = null;
    if (parentId) {
      if (!ObjectId.isValid(parentId)) {
        return res.status(400).json({ error: 'Invalid parentId format.', code: 'INVALID_PARENT_ID' });
      }
      parentObjectId = new ObjectId(parentId);
      const parentExists = await menusCol.findOne({ _id: parentObjectId });
      if (!parentExists) {
        return res.status(404).json({ error: 'Parent menu item not found.', code: 'PARENT_NOT_FOUND' });
      }
    }

    const now = new Date();
    const newDoc = {
      label: label.trim(),
      icon: icon ? icon.trim() : 'FileText',
      routeKey: routeKey ? routeKey.trim() : '',
      parentId: parentObjectId,
      requiredPermission: requiredPermission ? requiredPermission.trim() : null,
      sortOrder: parseInt(sortOrder, 10) || 0,
      enabled: Boolean(enabled),
      createdAt: now,
      updatedAt: now,
    };

    const result = await menusCol.insertOne(newDoc);
    const createdId = result.insertedId.toString();

    await logAuditEvent({
      actorUserId: req.user.id,
      actorEmail: req.user.email,
      action: 'MENU_ITEM_CREATED',
      targetType: 'admin_menu',
      targetId: createdId,
      outcome: 'SUCCESS',
      metadata: { label: newDoc.label, routeKey: newDoc.routeKey },
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    });

    return res.status(201).json({
      success: true,
      menu: {
        id: createdId,
        ...newDoc,
        parentId: parentObjectId ? parentObjectId.toString() : null,
      },
    });
  } catch (err) {
    console.error('Create Menu Item Error:', err);
    return res.status(500).json({ error: 'Failed to create menu item.', code: 'SERVER_ERROR' });
  }
}

export async function updateMenuItem(req, res) {
  try {
    const { id } = req.params;
    const { label, icon, routeKey, parentId, requiredPermission, sortOrder, enabled } = req.body || {};

    if (!ObjectId.isValid(id)) {
      return res.status(400).json({ error: 'Invalid menu item ID.', code: 'INVALID_ID' });
    }

    const db = getDb();
    const menusCol = db.collection('admin_menus');
    const existing = await menusCol.findOne({ _id: new ObjectId(id) });

    if (!existing) {
      return res.status(404).json({ error: 'Menu item not found.', code: 'NOT_FOUND' });
    }

    const updateFields = { updatedAt: new Date() };

    if (label) updateFields.label = label.trim();
    if (icon) updateFields.icon = icon.trim();
    if (routeKey !== undefined) {
      if (routeKey && !APPROVED_ROUTES.has(routeKey)) {
        return res.status(400).json({
          error: `Invalid routeKey: '${routeKey}' is not an approved admin route.`,
          code: 'INVALID_ROUTE_KEY',
        });
      }
      updateFields.routeKey = routeKey ? routeKey.trim() : '';
    }

    if (parentId !== undefined) {
      if (parentId === null || parentId === '') {
        updateFields.parentId = null;
      } else {
        if (!ObjectId.isValid(parentId)) {
          return res.status(400).json({ error: 'Invalid parentId format.', code: 'INVALID_PARENT_ID' });
        }
        if (parentId === id) {
          return res.status(400).json({ error: 'Circular nesting rejected: An item cannot be its own parent.', code: 'CIRCULAR_PARENT' });
        }
        updateFields.parentId = new ObjectId(parentId);
      }
    }

    if (requiredPermission !== undefined) {
      updateFields.requiredPermission = requiredPermission ? requiredPermission.trim() : null;
    }

    if (sortOrder !== undefined) {
      updateFields.sortOrder = parseInt(sortOrder, 10) || 0;
    }

    if (enabled !== undefined) {
      updateFields.enabled = Boolean(enabled);
    }

    await menusCol.updateOne({ _id: new ObjectId(id) }, { $set: updateFields });

    await logAuditEvent({
      actorUserId: req.user.id,
      actorEmail: req.user.email,
      action: 'MENU_ITEM_UPDATED',
      targetType: 'admin_menu',
      targetId: id,
      outcome: 'SUCCESS',
      metadata: { label: existing.label, updatedFields: Object.keys(updateFields) },
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    });

    return res.status(200).json({
      success: true,
      message: 'Menu item updated successfully.',
    });
  } catch (err) {
    console.error('Update Menu Item Error:', err);
    return res.status(500).json({ error: 'Failed to update menu item.', code: 'SERVER_ERROR' });
  }
}

export async function deleteMenuItem(req, res) {
  try {
    const { id } = req.params;
    if (!ObjectId.isValid(id)) {
      return res.status(400).json({ error: 'Invalid menu item ID.', code: 'INVALID_ID' });
    }

    const db = getDb();
    const menusCol = db.collection('admin_menus');

    // Also update children to remove parent reference
    await menusCol.updateMany({ parentId: new ObjectId(id) }, { $set: { parentId: null } });

    const result = await menusCol.deleteOne({ _id: new ObjectId(id) });
    if (result.deletedCount === 0) {
      return res.status(404).json({ error: 'Menu item not found.', code: 'NOT_FOUND' });
    }

    await logAuditEvent({
      actorUserId: req.user.id,
      actorEmail: req.user.email,
      action: 'MENU_ITEM_DELETED',
      targetType: 'admin_menu',
      targetId: id,
      outcome: 'SUCCESS',
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    });

    return res.status(200).json({
      success: true,
      message: 'Menu item deleted successfully.',
    });
  } catch (err) {
    console.error('Delete Menu Item Error:', err);
    return res.status(500).json({ error: 'Failed to delete menu item.', code: 'SERVER_ERROR' });
  }
}

export async function reorderMenus(req, res) {
  try {
    const { items } = req.body || {}; // array of { id, sortOrder, parentId }

    if (!Array.isArray(items)) {
      return res.status(400).json({ error: 'Array of items required for reordering.', code: 'VALIDATION_ERROR' });
    }

    const db = getDb();
    const menusCol = db.collection('admin_menus');

    const bulkOps = items
      .filter(it => ObjectId.isValid(it.id))
      .map(it => ({
        updateOne: {
          filter: { _id: new ObjectId(it.id) },
          update: {
            $set: {
              sortOrder: parseInt(it.sortOrder, 10) || 0,
              parentId: it.parentId && ObjectId.isValid(it.parentId) ? new ObjectId(it.parentId) : null,
              updatedAt: new Date(),
            },
          },
        },
      }));

    if (bulkOps.length > 0) {
      await menusCol.bulkWrite(bulkOps);
    }

    await logAuditEvent({
      actorUserId: req.user.id,
      actorEmail: req.user.email,
      action: 'MENUS_REORDERED',
      targetType: 'admin_menu',
      outcome: 'SUCCESS',
      metadata: { count: bulkOps.length },
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    });

    return res.status(200).json({
      success: true,
      message: 'Menu order updated successfully.',
    });
  } catch (err) {
    console.error('Reorder Menus Error:', err);
    return res.status(500).json({ error: 'Failed to reorder menu items.', code: 'SERVER_ERROR' });
  }
}
