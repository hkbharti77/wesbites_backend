import { connectDB, getDb } from '../src/db/connection.js';

const MODERN_MENU_NAMES = {
  '/admin/dashboard': { label: 'Dashboard', icon: 'LayoutDashboard' },
  '/admin/blog-manager': { label: 'Articles', icon: 'FileEdit' },
  '/admin/create': { label: 'New Article', icon: 'PenTool' },
  '/admin/media': { label: 'Media', icon: 'Image' },
  '/admin/portfolio-media': { label: 'Portfolio Assets', icon: 'Briefcase' },
  '/admin/blog/analytics': { label: 'Analytics', icon: 'BarChart3' },
  '/admin/blog/seo': { label: 'SEO', icon: 'TrendingUp' },
  '/admin/leads': { label: 'Leads', icon: 'Inbox' },
  '/admin/subscribers': { label: 'Subscribers', icon: 'Mail' },
  '/admin/website-theme': { label: 'Themes', icon: 'Palette' },
  '/admin/cookies': { label: 'Cookie Consent', icon: 'ShieldCheck' },
  '/admin/privacy-requests': { label: 'Privacy Requests', icon: 'ShieldAlert' },
  '/admin/users': { label: 'Users', icon: 'Users' },
  '/admin/roles': { label: 'Roles', icon: 'Shield' },
  '/admin/permissions': { label: 'Permissions', icon: 'KeyRound' },
  '/admin/menus': { label: 'Navigation', icon: 'Menu' },
  '/admin/audit-logs': { label: 'Audit Logs', icon: 'FileText' },
  '/admin/settings': { label: 'Settings', icon: 'Settings' },
  '/admin/landing-page': { label: 'Landing Page', icon: 'Layers' },
};

async function migrate() {
  await connectDB();
  const db = getDb();
  const menusCol = db.collection('admin_menus');

  console.log('🔄 Migrating sidebar menu names in database...');
  for (const [routeKey, config] of Object.entries(MODERN_MENU_NAMES)) {
    const res = await menusCol.updateMany(
      { routeKey },
      {
        $set: {
          label: config.label,
          icon: config.icon,
          updatedAt: new Date(),
        },
      }
    );
    if (res.matchedCount > 0) {
      console.log(`✅ Updated ${routeKey} -> "${config.label}" (matched: ${res.matchedCount})`);
    } else {
      console.log(`ℹ️ Route ${routeKey} not found in DB`);
    }
  }

  const updatedMenus = await menusCol.find({ enabled: true }).sort({ sortOrder: 1 }).toArray();
  console.log('\nAll enabled menus currently in DB:');
  updatedMenus.forEach((m) => console.log(`- [${m.routeKey}]: "${m.label}"`));

  process.exit(0);
}

migrate().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});
