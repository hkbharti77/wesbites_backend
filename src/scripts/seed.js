import { ObjectId } from 'mongodb';
import { connectDB, closeDB } from '../db/connection.js';
import { hashPassword, normalizeEmail } from '../utils/crypto.js';
import dotenv from 'dotenv';

dotenv.config();

const SYSTEM_PERMISSIONS = [
  // Dashboard
  { key: 'dashboard.read', resource: 'dashboard', action: 'read', description: 'View executive dashboard metrics and summaries' },

  // Administrative Users
  { key: 'users.read', resource: 'users', action: 'read', description: 'View administrative users list and profiles' },
  { key: 'users.create', resource: 'users', action: 'create', description: 'Create new administrative user accounts' },
  { key: 'users.update', resource: 'users', action: 'update', description: 'Edit administrative user profile details and role assignments' },
  { key: 'users.deactivate', resource: 'users', action: 'deactivate', description: 'Deactivate or delete administrative accounts' },

  // Roles & Permissions
  { key: 'roles.read', resource: 'roles', action: 'read', description: 'View existing role definitions and assigned permissions' },
  { key: 'roles.create', resource: 'roles', action: 'create', description: 'Create custom administrative roles' },
  { key: 'roles.update', resource: 'roles', action: 'update', description: 'Modify custom role details and permission sets' },
  { key: 'roles.delete', resource: 'roles', action: 'delete', description: 'Delete non-system custom roles' },
  { key: 'roles.permissions.manage', resource: 'roles', action: 'manage', description: 'Grant or revoke permissions on roles' },
  { key: 'permissions.read', resource: 'permissions', action: 'read', description: 'View system-wide permissions catalog' },

  // Menus
  { key: 'menus.read', resource: 'menus', action: 'read', description: 'View administrative navigation menu configurations' },
  { key: 'menus.create', resource: 'menus', action: 'create', description: 'Add new menu items to the administration sidebar' },
  { key: 'menus.update', resource: 'menus', action: 'update', description: 'Update menu labels, routes, hierarchy, or ordering' },
  { key: 'menus.delete', resource: 'menus', action: 'delete', description: 'Remove menu items from the administration sidebar' },

  // Audit Logs
  { key: 'audit.read', resource: 'audit', action: 'read', description: 'Inspect security audit logs and event history' },

  // Settings
  { key: 'settings.read', resource: 'settings', action: 'read', description: 'View system and security settings' },
  { key: 'settings.update', resource: 'settings', action: 'update', description: 'Modify system and security settings' },

  // CMS Content Permissions
  { key: 'posts.read', resource: 'posts', action: 'read', description: 'View CMS articles and drafts' },
  { key: 'posts.create', resource: 'posts', action: 'create', description: 'Draft new CMS articles' },
  { key: 'posts.update', resource: 'posts', action: 'update', description: 'Edit existing CMS articles' },
  { key: 'posts.publish', resource: 'posts', action: 'publish', description: 'Publish or schedule CMS articles to live website' },
  { key: 'posts.delete', resource: 'posts', action: 'delete', description: 'Archive or remove CMS articles' },
  { key: 'categories.read', resource: 'categories', action: 'read', description: 'View content categories' },
  { key: 'categories.manage', resource: 'categories', action: 'manage', description: 'Create and edit content categories' },
  { key: 'media.read', resource: 'media', action: 'read', description: 'Browse uploaded media assets' },
  { key: 'media.upload', resource: 'media', action: 'upload', description: 'Upload images and media assets to Cloudinary' },
  { key: 'media.delete', resource: 'media', action: 'delete', description: 'Delete media assets' },
  { key: 'analytics.read', resource: 'analytics', action: 'read', description: 'Inspect blog performance and visitor telemetry' },
  { key: 'seo.read', resource: 'seo', action: 'read', description: 'View search ranking metrics and content refresh opportunities' },
  { key: 'cookies.read', resource: 'cookies', action: 'read', description: 'Inspect GDPR/DPDP cookie consent statistics' },
  { key: 'cookies.manage', resource: 'cookies', action: 'manage', description: 'Configure cookie banners and compliance rules' },

  // Newsletter & Subscribers
  { key: 'subscribers.read', resource: 'subscribers', action: 'read', description: 'View newsletter subscribers list and metrics' },
  { key: 'subscribers.manage', resource: 'subscribers', action: 'manage', description: 'Update subscriber status, resubscribe or toggle' },
  { key: 'subscribers.export', resource: 'subscribers', action: 'export', description: 'Export subscriber lists to secure CSV' },
  { key: 'subscribers.delete', resource: 'subscribers', action: 'delete', description: 'Permanently erase subscriber record (GDPR Art. 17)' },

  // Leads & Customer Inquiries
  { key: 'leads.read', resource: 'leads', action: 'read', description: 'View CRM leads and customer inquiries' },
  { key: 'leads.manage', resource: 'leads', action: 'manage', description: 'Update lead status, priority, and staff notes' },
  { key: 'leads.export', resource: 'leads', action: 'export', description: 'Export customer leads to secure CSV' },
  { key: 'leads.delete', resource: 'leads', action: 'delete', description: 'Permanently remove lead records (GDPR/DPDP erasure)' },

  // Dynamic Landing Page CMS
  { key: 'landing_page.read', resource: 'landing_page', action: 'read', description: 'View landing page builder, sections, drafts and revisions' },
  { key: 'landing_page.update', resource: 'landing_page', action: 'update', description: 'Edit and save landing page section drafts' },
  { key: 'landing_page.publish', resource: 'landing_page', action: 'publish', description: 'Publish landing page changes live or rollback versions' },
];

export async function seedDatabase() {
  console.log('🌱 Starting GyanVaniAi Admin Foundation Database Seeding...');
  const { db } = await connectDB();

  // 1. Seed Permissions (upsert idempotently)
  const permsCol = db.collection('admin_permissions');
  for (const perm of SYSTEM_PERMISSIONS) {
    await permsCol.updateOne(
      { key: perm.key },
      { $set: { ...perm, updatedAt: new Date() }, $setOnInsert: { createdAt: new Date() } },
      { upsert: true }
    );
  }
  console.log(`✅ ${SYSTEM_PERMISSIONS.length} system permissions verified/seeded.`);

  const allPermKeys = SYSTEM_PERMISSIONS.map(p => p.key);

  // 2. Define Initial Roles
  const ROLES_TO_SEED = [
    {
      key: 'super_admin',
      name: 'Super Admin',
      description: 'Unrestricted full access across all modules, settings, user management, and security configurations.',
      permissionKeys: allPermKeys,
      isSystemRole: true,
    },
    {
      key: 'admin',
      name: 'Admin',
      description: 'Comprehensive administrative access for day-to-day user, content, and menu management.',
      permissionKeys: allPermKeys.filter(k => !k.startsWith('roles.delete')),
      isSystemRole: true,
    },
    {
      key: 'editor',
      name: 'Editor',
      description: 'Content editorial workflow: create, edit, publish posts, manage categories and media.',
      permissionKeys: [
        'dashboard.read',
        'menus.read',
        'posts.read',
        'posts.create',
        'posts.update',
        'posts.publish',
        'categories.read',
        'categories.manage',
        'media.read',
        'media.upload',
        'analytics.read',
        'landing_page.read',
        'landing_page.update',
        'landing_page.publish',
      ],
      isSystemRole: true,
    },
    {
      key: 'marketing_manager',
      name: 'Marketing Manager',
      description: 'Marketing analytics, SEO growth dashboard, and content performance insights.',
      permissionKeys: [
        'dashboard.read',
        'menus.read',
        'analytics.read',
        'seo.read',
        'posts.read',
        'cookies.read',
        'subscribers.read',
        'subscribers.manage',
        'subscribers.export',
      ],
      isSystemRole: true,
    },
    {
      key: 'sales_manager',
      name: 'Sales Manager',
      description: 'Lead analytics, dashboard telemetry, and customer communications visibility.',
      permissionKeys: [
        'dashboard.read',
        'menus.read',
        'analytics.read',
        'subscribers.read',
        'leads.read',
        'leads.manage',
        'leads.export',
      ],
      isSystemRole: true,
    },
    {
      key: 'readonly_analyst',
      name: 'Read-Only Analyst',
      description: 'Read-only visibility for reporting, compliance audits, and system inspection.',
      permissionKeys: [
        'dashboard.read',
        'users.read',
        'roles.read',
        'permissions.read',
        'menus.read',
        'audit.read',
        'settings.read',
        'posts.read',
        'categories.read',
        'media.read',
        'analytics.read',
        'seo.read',
        'cookies.read',
        'subscribers.read',
      ],
      isSystemRole: true,
    },
  ];

  const rolesCol = db.collection('admin_roles');
  const roleMap = new Map();

  for (const role of ROLES_TO_SEED) {
    const res = await rolesCol.findOneAndUpdate(
      { key: role.key },
      {
        $set: {
          name: role.name,
          description: role.description,
          permissionKeys: role.permissionKeys,
          isSystemRole: true,
          updatedAt: new Date(),
        },
        $setOnInsert: { createdAt: new Date() },
      },
      { upsert: true, returnDocument: 'after' }
    );
    const doc = res.value || (await rolesCol.findOne({ key: role.key }));
    roleMap.set(role.key, doc._id);
  }
  console.log(`✅ ${ROLES_TO_SEED.length} system roles verified/seeded.`);

  // 3. Seed Default Dynamic Navigation Menus
  const MENUS_TO_SEED = [
    { label: 'Dashboard', icon: 'LayoutDashboard', routeKey: '/admin/dashboard', requiredPermission: 'dashboard.read', sortOrder: 10 },
    { label: 'Administrative Users', icon: 'Users', routeKey: '/admin/users', requiredPermission: 'users.read', sortOrder: 20 },
    { label: 'Roles & Access', icon: 'Shield', routeKey: '/admin/roles', requiredPermission: 'roles.read', sortOrder: 30 },
    { label: 'Permissions Catalog', icon: 'KeyRound', routeKey: '/admin/permissions', requiredPermission: 'permissions.read', sortOrder: 40 },
    { label: 'Dynamic Menus', icon: 'Menu', routeKey: '/admin/menus', requiredPermission: 'menus.read', sortOrder: 50 },
    { label: 'Security Audit Logs', icon: 'FileText', routeKey: '/admin/audit-logs', requiredPermission: 'audit.read', sortOrder: 60 },
    { label: 'System Settings', icon: 'Settings', routeKey: '/admin/settings', requiredPermission: 'settings.read', sortOrder: 70 },
    // CMS Modules
    { label: 'Landing Page Builder', icon: 'Layers', routeKey: '/admin/landing-page', requiredPermission: 'landing_page.read', sortOrder: 75 },
    { label: 'Articles Manager', icon: 'FileEdit', routeKey: '/admin/blog-manager', requiredPermission: 'posts.read', sortOrder: 80 },
    { label: 'Create New Article', icon: 'PenTool', routeKey: '/admin/create', requiredPermission: 'posts.create', sortOrder: 90 },
    { label: 'Media Library', icon: 'Image', routeKey: '/admin/media', requiredPermission: 'media.read', sortOrder: 100 },
    { label: 'Traffic Analytics', icon: 'BarChart3', routeKey: '/admin/blog/analytics', requiredPermission: 'analytics.read', sortOrder: 110 },
    { label: 'SEO Intelligence', icon: 'TrendingUp', routeKey: '/admin/blog/seo', requiredPermission: 'seo.read', sortOrder: 120 },
    { label: 'Cookie Consents', icon: 'ShieldCheck', routeKey: '/admin/cookies', requiredPermission: 'cookies.read', sortOrder: 130 },
    { label: 'Leads & Inquiries', icon: 'Inbox', routeKey: '/admin/leads', requiredPermission: 'leads.read', sortOrder: 131 },
    { label: 'Newsletter Subscribers', icon: 'Mail', routeKey: '/admin/subscribers', requiredPermission: 'subscribers.read', sortOrder: 132 },
    { label: 'Website Themes', icon: 'Palette', routeKey: '/admin/website-theme', requiredPermission: 'settings.read', sortOrder: 135 },
  ];

  const menusCol = db.collection('admin_menus');
  for (const m of MENUS_TO_SEED) {
    await menusCol.updateOne(
      { routeKey: m.routeKey },
      {
        $set: {
          label: m.label,
          icon: m.icon,
          requiredPermission: m.requiredPermission,
          sortOrder: m.sortOrder,
          enabled: true,
          updatedAt: new Date(),
        },
        $setOnInsert: {
          parentId: null,
          createdAt: new Date(),
        },
      },
      { upsert: true }
    );
  }
  console.log(`✅ ${MENUS_TO_SEED.length} default menu items verified/seeded.`);

  // 4. Provision Initial Super Admin
  const usersCol = db.collection('admin_users');
  const superAdminRoleId = roleMap.get('super_admin');

  const existingSuperAdmin = await usersCol.findOne({
    roleIds: superAdminRoleId,
    status: 'active',
  });

  if (!existingSuperAdmin) {
    const adminEmail = normalizeEmail(process.env.INITIAL_ADMIN_EMAIL || 'superadmin@gyanvaniai.com');
    const adminPassword = process.env.INITIAL_ADMIN_PASSWORD || 'SuperAdmin@GyanVani2026!';
    const adminName = process.env.INITIAL_ADMIN_NAME || 'GyanVani Super Admin';

    const passwordHash = await hashPassword(adminPassword);
    const now = new Date();

    const superAdminDoc = {
      name: adminName,
      emailNormalized: adminEmail,
      passwordHash,
      roleIds: [superAdminRoleId],
      status: 'active',
      lastLoginAt: null,
      passwordChangedAt: now,
      createdAt: now,
      updatedAt: now,
    };

    await usersCol.updateOne(
      { emailNormalized: adminEmail },
      { $set: superAdminDoc },
      { upsert: true }
    );

    console.log(`⭐ Initial Super Admin successfully provisioned!`);
    console.log(`   Email: ${adminEmail}`);
    console.log(`   Password: (provisioned from INITIAL_ADMIN_PASSWORD)`);
  } else {
    console.log(`ℹ️ An active Super Admin already exists (${existingSuperAdmin.emailNormalized}). Preserving existing credentials.`);
  }

  console.log('🎉 Database seeding completed successfully!\n');
}

// Allow direct CLI execution
if (process.argv[1] && process.argv[1].endsWith('seed.js')) {
  seedDatabase()
    .then(async () => {
      await closeDB();
      process.exit(0);
    })
    .catch(async (err) => {
      console.error('Seeding failed:', err);
      await closeDB();
      process.exit(1);
    });
}
