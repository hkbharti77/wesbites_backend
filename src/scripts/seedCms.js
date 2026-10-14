import { ObjectId } from 'mongodb';
import { connectDB, closeDB } from '../db/connection.js';
import { calculateReadingTime } from '../utils/slugify.js';
import dotenv from 'dotenv';

dotenv.config();

const INITIAL_CATEGORIES = [
  {
    name: 'WhatsApp CRM',
    slug: 'whatsapp-crm',
    description: 'WhatsApp Cloud API, Shared Inboxes, and Coexistence workflows',
    color: '#25d366',
    order: 1,
  },
  {
    name: 'AI Agents',
    slug: 'ai-agents',
    description: 'Autonomous multi-agent orchestration and LLM integrations',
    color: '#6366f1',
    order: 2,
  },
  {
    name: 'Enterprise Automation',
    slug: 'enterprise-automation',
    description: 'Workflow automation, CRM pipelines, and backend systems',
    color: '#0284c7',
    order: 3,
  },
  {
    name: 'Security & Compliance',
    slug: 'security-compliance',
    description: 'Data privacy, SOC2, GDPR, and enterprise security hardening',
    color: '#059669',
    order: 4,
  },
];

const INITIAL_POSTS = [
  {
    slug: 'whatsapp-business-api-automation',
    title: 'Meta WhatsApp Business API Automation: Complete Guide to Cloud API, Coexistence & WhatsApp CRM',
    excerpt: 'Comprehensive guide to official Meta WhatsApp Cloud API integration, WhatsApp Coexistence mode, bulk campaign broadcasts, and multi-agent shared inboxes.',
    content: `
      <h2>The Shift to Conversational Business on WhatsApp</h2>
      <p>Over 2.7 billion active users open WhatsApp daily, making it the highest-engagement customer channel worldwide. For modern sales and support teams, relying solely on email or standard SMS results in low open rates (15-20%) and sluggish response times. Official WhatsApp Business API automation delivers 98% message open rates, 45-60% click-through rates, and near-instant customer responses.</p>
      
      <h2>WhatsApp App vs. Cloud API vs. WhatsApp Coexistence</h2>
      <p>Understanding the difference between deployment surfaces is essential for growing revenue teams:</p>
      <ul>
        <li><strong>WhatsApp Business Mobile App:</strong> Designed for micro-businesses. Limited to 1 device plus 4 linked web sessions, maximum 256 broadcast contacts, and zero native CRM synchronization.</li>
        <li><strong>Standard WhatsApp Cloud API:</strong> High-throughput enterprise API hosted by Meta. Allows unlimited messaging tiers and multi-agent inboxes, but historically forced businesses to permanently delete their mobile app on that number.</li>
        <li><strong>WhatsApp Business Coexistence Mode:</strong> The modern standard developed by Meta. Enables businesses to run the standard WhatsApp Business mobile app and Gyan VaniAi WhatsApp Coexistence simultaneously on one single phone number without number migration or chat history loss.</li>
      </ul>

      <h2>Key Architectural Pillars of WhatsApp Automation</h2>
      <h3>1. Bidirectional Webhook Synchronization</h3>
      <p>When a prospect sends a message, Meta’s Cloud API fanout routes the packet simultaneously to the sales rep's phone app and the central WhatsApp CRM platform. If a rep replies from their phone, the message mirrors in the CRM timeline in real time.</p>

      <h3>2. 24/7 Sub-300ms AI Auto-Replies</h3>
      <p>Instead of leaving inquiries unanswered outside business hours, intelligent AI chatbots answer product questions, qualify buyer intent using BANT frameworks, and schedule meetings directly on calendar links.</p>

      <h3>3. Targeted Broadcast Campaigns with Zero Ban Risk</h3>
      <p>Unlike unofficial scrapers that get business numbers permanently banned by Meta, official Cloud API broadcasts use pre-approved Meta templates. Deliver personalized promotional updates, payment reminders, and order confirmations to 10,000+ opted-in customers safely.</p>
    `,
    category: 'WhatsApp CRM',
    tags: ['WhatsApp CRM', 'Cloud API', 'Coexistence', 'Automation'],
    status: 'published',
    isFeatured: true,
    featuredImage: {
      url: '/portfolio_crm.webp',
      alt: 'Meta WhatsApp Business API Dashboard',
    },
    seo: {
      metaTitle: 'Meta WhatsApp Business API Automation Guide',
      metaDescription: 'Complete technical guide to Meta WhatsApp Cloud API, coexistence architecture, and CRM integrations.',
      canonicalUrl: 'https://www.gyanvaniai.com/blog/whatsapp-business-api-automation',
      ogImage: '/portfolio_crm.webp',
      twitterCard: 'summary_large_image',
      keywords: ['WhatsApp CRM', 'Cloud API', 'Coexistence', 'Automation'],
    },
  },
  {
    slug: 'multi-agent-orchestration-future',
    title: 'The Future of Multi-Agent AI Orchestration in Enterprise Operations',
    excerpt: 'Discover how multi-agent AI frameworks decompose complex enterprise workflows, call APIs autonomously, and execute multi-step operations with zero human bottleneck.',
    content: `
      <h2>Beyond Single-Prompt Chatbots: The Multi-Agent Paradigm</h2>
      <p>While first-generation generative AI focused on conversational chatbots responding to single prompts, enterprise operational automation requires sequential reasoning, data verification, and autonomous tool calling across disparate software stacks. Multi-agent orchestration solves this by deploying specialized autonomous agents that collaborate as a virtual team.</p>

      <h2>The Anatomy of an Enterprise Multi-Agent System</h2>
      <p>Production multi-agent platforms built by Gyan VaniAi incorporate five foundational architectural layers:</p>
      <ol>
        <li><strong>Intent & Planning Agent:</strong> Ingests the incoming event (customer inquiry, ERP alert, lead form), evaluates required outcomes, and decomposes the goal into discrete sequential steps.</li>
        <li><strong>RAG Knowledge Agent:</strong> Interrogates tenant-isolated vector stores to retrieve verified organizational context, approved policies, and technical documentation.</li>
        <li><strong>Tool Calling Execution Agent:</strong> Interfaces with external APIs (CRMs, SQL databases, WhatsApp gateways) to mutate state safely.</li>
        <li><strong>Critique & Guardrail Agent:</strong> Verifies outputs for factual consistency, brand safety, and hallucination reduction before publishing.</li>
      </ol>
    `,
    category: 'AI Agents',
    tags: ['AI Agents', 'Automation', 'Enterprise', 'Multi-Agent'],
    status: 'published',
    isFeatured: true,
    featuredImage: {
      url: '/ai-agent-hero.webp',
      alt: 'Enterprise Multi-Agent Architecture',
    },
    seo: {
      metaTitle: 'The Future of Multi-Agent AI Orchestration',
      metaDescription: 'Technical breakdown of autonomous multi-agent frameworks in enterprise operational workflows.',
      canonicalUrl: 'https://www.gyanvaniai.com/blog/multi-agent-orchestration-future',
      ogImage: '/ai-agent-hero.webp',
      twitterCard: 'summary_large_image',
      keywords: ['AI Agents', 'Automation', 'Enterprise', 'Multi-Agent'],
    },
  },
];

export async function seedCms() {
  console.log('🌱 Seeding CMS Categories and Initial Published Articles...');
  const { db } = await connectDB();

  // 1. Seed Categories
  const categoriesCol = db.collection('cms_categories');
  const catMap = {};
  for (const cat of INITIAL_CATEGORIES) {
    const res = await categoriesCol.findOneAndUpdate(
      { slug: cat.slug },
      { $set: { ...cat, updatedAt: new Date() }, $setOnInsert: { createdAt: new Date() } },
      { upsert: true, returnDocument: 'after' }
    );
    catMap[cat.name] = res._id || res.value?._id;
  }
  console.log(`✅ ${INITIAL_CATEGORIES.length} CMS categories seeded/verified.`);

  // 2. Seed Posts
  const postsCol = db.collection('cms_posts');
  const revisionsCol = db.collection('cms_revisions');

  for (const post of INITIAL_POSTS) {
    const readingTime = calculateReadingTime(post.content);
    const categoryId = catMap[post.category] || null;

    const postDoc = {
      ...post,
      categoryId,
      readingTimeMinutes: readingTime,
      version: 1,
      publishedAt: new Date(),
      author: {
        name: 'Gyan VaniAi Product Team',
        email: 'editor@gyanvaniai.com',
        role: 'Editorial Director',
      },
      updatedAt: new Date(),
    };

    const existing = await postsCol.findOne({ slug: post.slug });
    if (!existing) {
      postDoc.createdAt = new Date();
      const insertRes = await postsCol.insertOne(postDoc);
      const postId = insertRes.insertedId;

      await revisionsCol.insertOne({
        postId,
        version: 1,
        snapshot: { ...postDoc, _id: postId },
        changeSummary: 'Initial seeded publication',
        author: { name: 'System Seeder', email: 'system@gyanvaniai.com' },
        createdAt: new Date(),
      });
      console.log(`  + Seeded article: ${post.title}`);
    } else {
      console.log(`  = Article already exists: ${post.slug}`);
    }
  }

  console.log('🎉 CMS Seeding completed cleanly!');
}

if (process.argv[1] && process.argv[1].endsWith('seedCms.js')) {
  seedCms()
    .then(() => closeDB())
    .catch((err) => {
      console.error('CMS Seeding failed:', err);
      process.exit(1);
    });
}
