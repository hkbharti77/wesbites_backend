import fs from 'fs';
import { connectDB, getDb } from '../db/connection.js';

// Parse Firestore REST API JSON value into clean JavaScript primitives
function parseFirestoreValue(val) {
  if (!val) return null;
  if ('stringValue' in val) return val.stringValue;
  if ('booleanValue' in val) return val.booleanValue;
  if ('integerValue' in val) return parseInt(val.integerValue, 10);
  if ('doubleValue' in val) return parseFloat(val.doubleValue);
  if ('timestampValue' in val) return new Date(val.timestampValue);
  if ('arrayValue' in val) {
    return (val.arrayValue.values || []).map(parseFirestoreValue);
  }
  if ('mapValue' in val) {
    const res = {};
    for (const [k, v] of Object.entries(val.mapValue.fields || {})) {
      res[k] = parseFirestoreValue(v);
    }
    return res;
  }
  if ('nullValue' in val) return null;
  return null;
}

function parseFirestoreDoc(doc) {
  const fields = doc.fields || {};
  const data = {};
  for (const [key, val] of Object.entries(fields)) {
    data[key] = parseFirestoreValue(val);
  }
  data._firestoreId = doc.name.split('/').pop();
  return data;
}

// CRM keywords to differentiate CRM-specific marketing posts from tech/portfolio posts
function determineChannel(category, title) {
  const text = `${category || ''} ${title || ''}`.toLowerCase();
  if (
    text.includes('whatsapp crm') ||
    text.includes('whatsapp business') ||
    text.includes('meta tech provider') ||
    text.includes('lead management') ||
    text.includes('sales & customer engagement')
  ) {
    return 'crm';
  }
  // Engineering, AI Technology, Architecture, Vector DBs, RAG, Web Dev -> Portfolio!
  return 'portfolio';
}

async function main() {
  console.log('--- Step 1: Loading Firebase credentials from .env ---');
  const envContent = fs.readFileSync('D:/xyzzz/My-portfillos/My-portfillos/.env', 'utf8');
  const env = {};
  envContent.split('\n').forEach(line => {
    const parts = line.trim().split('=');
    if (parts.length >= 2) {
      env[parts[0].trim()] = parts.slice(1).join('=').trim().replace(/^['"]|['"]$/g, '');
    }
  });

  const projectId = env['VITE_FIREBASE_PROJECT_ID'];
  const apiKey = env['VITE_FIREBASE_API_KEY'];

  if (!projectId || !apiKey) {
    throw new Error('Missing VITE_FIREBASE_PROJECT_ID or VITE_FIREBASE_API_KEY in .env');
  }

  console.log(`Connecting to Firestore project "${projectId}"...`);
  const url = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/blogs?pageSize=100&key=${apiKey}`;

  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Firestore fetch failed with HTTP ${res.status}: ${await res.text()}`);
  }

  const json = await res.json();
  const rawDocs = json.documents || [];
  console.log(`Successfully fetched ${rawDocs.length} blog documents from Firestore!`);

  console.log('--- Step 2: Connecting to MongoDB ---');
  await connectDB();
  const db = getDb();
  const postsCol = db.collection('cms_posts');

  let importedCount = 0;
  let updatedCount = 0;
  let portfolioCount = 0;
  let crmCount = 0;

  for (const rawDoc of rawDocs) {
    const doc = parseFirestoreDoc(rawDoc);

    const title = doc.title || 'Untitled Post';
    const slug = (doc.slug || doc.slugId || doc._firestoreId || '').trim();
    if (!slug) continue;

    const category = doc.category || doc.tag || 'AI Technology';
    const channel = determineChannel(category, title);
    if (channel === 'portfolio') portfolioCount++;
    else crmCount++;

    const excerpt = doc.excerpt || doc.summary || title;
    const content = doc.content || doc.body || '<p>' + excerpt + '</p>';
    const imageUrl = doc.imageUrl || doc.coverImage || doc.image || '/portfolio_crm.webp';
    const published = doc.published ?? true;
    const status = published ? 'published' : 'draft';
    const date = doc.date || (doc.createdAt ? new Date(doc.createdAt).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }) : 'October 2026');
    const readTime = doc.readTime || `${doc.readingTimeMinutes || 5} min read`;
    const author = doc.author || 'Himanshu Bharti';
    const tags = Array.isArray(doc.tags) ? doc.tags : (doc.tag ? [doc.tag] : [category]);

    const mongoDoc = {
      title,
      slug,
      excerpt,
      content,
      category,
      channel,
      tag: tags[0] || category,
      tags,
      author,
      date,
      readTime,
      readingTimeMinutes: parseInt(readTime, 10) || 5,
      coverImage: imageUrl,
      imageUrl,
      featuredImage: {
        url: imageUrl,
        alt: title,
      },
      pdfUrl: doc.pdfUrl || doc.pdf?.url || '',
      pdfName: doc.pdfName || doc.pdf?.name || '',
      isFeatured: Boolean(doc.isFeatured || doc.featured),
      published,
      status,
      publishedAt: doc.publishedAt ? new Date(doc.publishedAt) : (doc.createdAt ? new Date(doc.createdAt) : new Date()),
      createdAt: doc.createdAt ? new Date(doc.createdAt) : new Date(),
      updatedAt: doc.updatedAt ? new Date(doc.updatedAt) : new Date(),
      version: 1,
    };

    const existing = await postsCol.findOne({ slug });
    if (existing) {
      await postsCol.updateOne(
        { _id: existing._id },
        {
          $set: {
            ...mongoDoc,
            channel, // Update to the proper channel
            updatedAt: new Date(),
          },
        }
      );
      updatedCount++;
      console.log(`[UPDATED] [${channel.toUpperCase()}] ${title} (slug: ${slug})`);
    } else {
      await postsCol.insertOne(mongoDoc);
      importedCount++;
      console.log(`[INSERTED] [${channel.toUpperCase()}] ${title} (slug: ${slug})`);
    }
  }

  console.log('\n--- Step 3: Migration Complete Summary ---');
  console.log(`Total Firestore docs processed: ${rawDocs.length}`);
  console.log(`New posts inserted: ${importedCount}`);
  console.log(`Existing posts updated: ${updatedCount}`);
  console.log(`Assigned to Portfolio (My-portfillos): ${portfolioCount}`);
  console.log(`Assigned to CRM (GyanVaniAi): ${crmCount}`);

  // Final check of MongoDB counts
  const finalPortfolio = await postsCol.countDocuments({ channel: 'portfolio', status: 'published' });
  const finalCrm = await postsCol.countDocuments({ channel: 'crm', status: 'published' });
  const finalAll = await postsCol.countDocuments({ channel: 'all', status: 'published' });
  console.log(`\nFinal MongoDB Published Counts:`);
  console.log(`- Portfolio channel: ${finalPortfolio}`);
  console.log(`- CRM channel: ${finalCrm}`);
  console.log(`- Shared/All channel: ${finalAll}`);

  process.exit(0);
}

main().catch(err => {
  console.error('Migration failed:', err);
  process.exit(1);
});
