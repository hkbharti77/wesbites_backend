import { getDb } from '../db/connection.js';
import { logAuditEvent } from './audit.service.js';
import { pingIndexNowUrls } from './seoEngine.service.js';

let scheduledPublishTimer = null;

/**
 * Checks for scheduled articles that have reached their release date/time and publishes them.
 */
export async function processScheduledPosts() {
  try {
    const db = getDb();
    if (!db) return;

    const postsCol = db.collection('cms_posts');
    const now = new Date();

    const readyPosts = await postsCol
      .find({
        status: 'scheduled',
        $or: [
          { publishAt: { $lte: now } },
          { scheduledAt: { $lte: now } },
        ],
      })
      .toArray();

    if (readyPosts.length === 0) return;

    console.log(`[Scheduled Publisher] Found ${readyPosts.length} article(s) ready to publish.`);

    for (const post of readyPosts) {
      await postsCol.updateOne(
        { _id: post._id },
        {
          $set: {
            status: 'published',
            publishedAt: now,
            updatedAt: now,
          },
        }
      );

      console.log(`[Scheduled Publisher] Published article "${post.title}" (slug: ${post.slug}).`);

      // Trigger IndexNow pinging asynchronously
      const articleUrl = `https://www.gyanvaniai.com/blog/${post.slug}`;
      pingIndexNowUrls([articleUrl]).catch((err) =>
        console.warn(`[IndexNow Ping Failed for ${post.slug}]:`, err.message)
      );

      // Audit log entry
      await logAuditEvent({
        action: 'CMS_POST_SCHEDULED_PUBLISHED',
        targetType: 'POST',
        targetId: post._id.toString(),
        targetName: post.title,
        outcome: 'SUCCESS',
        metadata: {
          slug: post.slug,
          scheduledFor: post.publishAt || post.scheduledAt,
          publishedAt: now,
        },
      });
    }
  } catch (err) {
    console.error('[Scheduled Publisher Error]:', err.message);
  }
}

/**
 * Starts the scheduled publishing worker interval (runs every 60 seconds)
 */
export function startScheduledPublishWorker(intervalMs = 60000) {
  if (scheduledPublishTimer) return;
  scheduledPublishTimer = setInterval(processScheduledPosts, intervalMs);
  scheduledPublishTimer.unref(); // Ensure process can shut down cleanly without hanging
  console.log('⏰ Scheduled Article Publishing worker initialized (polling every 60s).');
}

export function stopScheduledPublishWorker() {
  if (scheduledPublishTimer) {
    clearInterval(scheduledPublishTimer);
    scheduledPublishTimer = null;
  }
}

