// Default GyanVaniAi Enterprise Landing Page Schema and Baseline Content
// Preserves existing website layout, typography, 11 sections, verified data, and SEO metadata.

export function getDefaultLandingPage() {
  return {
    key: 'landing_page_default',
    version: 1,
    draftVersion: 1,
    status: 'published',
    publishedAt: new Date(),
    updatedAt: new Date(),
    seo: {
      title: 'Autonomous AI CRM & Revenue Operations | Gyan VaniAi',
      description: 'Autonomous AI CRM platform for high-velocity revenue teams. Capture, enrich, qualify, assign and convert leads with intelligent AI-powered workflows.',
      canonical: 'https://www.gyanvaniai.com/',
      image: 'https://www.gyanvaniai.com/hero_dashboard.webp',
      keywords: 'Autonomous AI CRM, Revenue Operations, WhatsApp CRM, AI Lead Qualification, Sales Automation',
      robots: 'index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1',
      aeoQuestion: 'What is Gyan VaniAi AI CRM Platform?',
      aeoAnswer: 'Gyan VaniAi is an Enterprise AI CRM platform with official Meta WhatsApp Coexistence support, sub-300ms RAG chatbots, conversational voice agents, and end-to-end sales automation.',
      aeoEntities: 'Gyan VaniAi, Enterprise CRM, WhatsApp Cloud API, Propensity Lead Scoring, Voice AI Agents',
      speakableHeadline: 'Gyan VaniAi provides enterprise autonomous AI CRM and sales orchestration software.',
    },
    sectionsOrder: [
      'hero',
      'trust',
      'features',
      'process',
      'industries',
      'omnichannel',
      'security',
      'portfolio',
      'faq',
      'contact',
    ],
    sections: {
      hero: {
        enabled: true,
        order: 10,
        aeoTargetQuery: 'What is Gyan VaniAi and how does its autonomous CRM operate?',
        aeoSummary: 'Gyan VaniAi automates enterprise sales pipelines with sub-42s WhatsApp auto-response, predictive lead propensity scoring, and official Meta Cloud API coexistence.',
        slides: [
          {
            id: 'slide-1',
            badge: 'AI-POWERED REVENUE PLATFORM',
            badgeIcon: 'Zap',
            titlePrefix: 'Autonomous AI CRM for ',
            titleGradient: 'high-velocity revenue teams',
            subtitle: 'Capture, enrich, qualify, assign and convert leads with intelligent AI-powered workflows.',
            imageDark: '/hero_robot_dark.webp',
            imageLight: '/hero_robot_light.webp',
            altText: 'Autonomous AI Humanoid Robot orchestrating enterprise CRM revenue operations',
            telemetry: [
              { dot: 'dot-emerald', icon: 'Zap', text: 'AI Lead Scoring: ', value: '98/100 Intent' },
              { dot: 'dot-cyan', icon: 'TrendingUp', text: 'Pipeline: ', value: '$2.4M ARR (+38%)' },
              { dot: 'dot-green', icon: 'MessageSquare', text: 'WhatsApp AI: ', value: '42s Auto-Response' },
            ],
          },
          {
            id: 'slide-2',
            badge: 'OFFICIAL WHATSAPP CLOUD API',
            badgeIcon: 'MessageSquare',
            titlePrefix: 'Zero-Latency AI Agents for ',
            titleGradient: 'instant customer conversion',
            subtitle: 'Engage high-intent prospects on WhatsApp in real-time with automated qualifying dialogues and instant CRM sync.',
            imageDark: '/hero_slide_2_dark.webp',
            imageLight: '/hero_slide_2_light.webp',
            altText: 'Humanoid AI Assistant managing multichannel WhatsApp conversations and CRM bookings',
            telemetry: [
              { dot: 'dot-emerald', icon: 'Zap', text: 'Avg Response: ', value: '< 3 seconds' },
              { dot: 'dot-cyan', icon: 'TrendingUp', text: 'Conversion Lift: ', value: '+4.2x Growth' },
              { dot: 'dot-green', icon: 'ShieldCheck', text: 'Official API: ', value: '99.99% Uptime' },
            ],
          },
          {
            id: 'slide-3',
            badge: 'PREDICTIVE REVENUE INTELLIGENCE',
            badgeIcon: 'TrendingUp',
            titlePrefix: 'Automated Pipeline & ML for ',
            titleGradient: 'modern enterprise sales',
            subtitle: 'Enrich incoming leads with 50+ firmographic data points and predict deal win probabilities with ML precision.',
            imageDark: '/hero_slide_3_dark.webp',
            imageLight: '/hero_slide_3_light.webp',
            altText: 'AI Robot analyzing 3D revenue forecasting curves and predictive sales pipelines',
            telemetry: [
              { dot: 'dot-emerald', icon: 'CheckCircle2', text: 'Win Probability: ', value: '88% Accuracy' },
              { dot: 'dot-cyan', icon: 'Layers', text: 'Firmographics: ', value: '50+ Live Signals' },
              { dot: 'dot-green', icon: 'Activity', text: 'Data Enrichment: ', value: 'Zero Manual Entry' },
            ],
          },
          {
            id: 'slide-4',
            badge: 'ENTERPRISE AGENTIC ORCHESTRATION',
            badgeIcon: 'Bot',
            titlePrefix: 'Autonomous Agent Pods for ',
            titleGradient: 'complex multi-tier workflows',
            subtitle: 'Deploy intelligent AI agent swarms that orchestrate cross-department handoffs, SLA monitoring, and ERP execution.',
            imageDark: '/hero_slide_4_dark.webp',
            imageLight: '/hero_slide_4_light.webp',
            altText: 'Enterprise AI Robot orchestrating neural network workflow nodes and automated agents',
            telemetry: [
              { dot: 'dot-emerald', icon: 'Bot', text: 'Active Agent Pods: ', value: '18 Swarms' },
              { dot: 'dot-cyan', icon: 'Activity', text: 'Cross-Team SLA: ', value: '99.4% Standard' },
              { dot: 'dot-green', icon: 'ShieldCheck', text: 'Security: ', value: 'SOC2 Type II Ready' },
            ],
          },
        ],
        primaryCta: {
          label: 'Book a Demo',
          action: 'modal',
          destination: '',
        },
        whatsappCta: {
          label: 'WhatsApp AI Demo',
          destination: 'https://wa.me/918700620913?text=Hi%20Gyan%20VaniAi%2C%20I%20would%20like%20to%20book%20a%20consultation.',
        },
        secondaryCta: {
          label: 'Explore Platform',
          destination: '#capabilities',
        },
      },
      trust: {
        enabled: true,
        order: 20,
        heading: 'Built to connect with your core tech stack',
        integrations: [
          { name: 'WhatsApp Cloud API', type: 'Meta Tech Provider' },
          { name: 'CRM Integrations', type: 'REST API & Webhooks' },
          { name: 'Custom Pipelines', type: 'Real-Time Sync' },
          { name: 'Zapier', type: 'Webhook Triggers' },
          { name: 'OpenAI / Claude', type: 'RAG Intelligence' },
          { name: 'MongoDB / PostgreSQL', type: 'Dedicated Isolated DB' },
        ],
        badges: [
          { label: 'SOC2 Ready Architecture', icon: 'ShieldCheck' },
          { label: 'Official Meta Tech Provider', icon: 'Zap' },
          { label: '99.9% Platform SLA', icon: 'Server' },
        ],
      },
      features: {
        enabled: true,
        order: 30,
        heading: 'Everything your revenue team needs, powered by AI',
        subtitle: 'Autonomous intelligence across the entire sales cycle, from first contact to deal closure.',
        capabilities: [
          {
            icon: 'Database',
            title: 'AI Lead Enrichment',
            description: 'Auto-enrich prospect profiles with verified business intelligence, company size, and technographics.',
            to: '/services/crm-development',
            tag: 'Intelligence',
          },
          {
            icon: 'UserCheck',
            title: 'Intelligent Lead Assignment',
            description: 'Route high-value leads to the best-suited reps instantly using dynamic skill-based matching.',
            to: '/services/crm-development',
            tag: 'Routing',
          },
          {
            icon: 'Activity',
            title: 'AI Intent Scoring',
            description: 'Analyze buyer sentiment and engagement signals in real-time to rank conversion readiness.',
            to: '/services/ai-agent-development',
            tag: 'Scoring',
          },
          {
            icon: 'Bot',
            title: 'RAG-Based AI Assistant',
            description: 'Query company knowledge, sales playbooks, and docs with verified facts and isolated enterprise context.',
            to: '/services/ai-chatbots',
            tag: 'RAG Knowledge',
          },
          {
            icon: 'MessageSquare',
            title: 'Omnichannel Communication',
            description: 'Engage prospects seamlessly across WhatsApp, voice calls, email, and web chat from a unified inbox.',
            to: '/services/whatsapp-coexistence',
            tag: 'Omnichannel',
          },
          {
            icon: 'Workflow',
            title: 'Sales Automation',
            description: 'Automate multi-step drip campaigns, task reminders, and deal pipeline status updates.',
            to: '/services/sales-automation',
            tag: 'Automation',
          },
          {
            icon: 'Target',
            title: 'Lead Qualification',
            description: 'Autonomous AI agents qualify inbound traffic 24/7 before booking meetings on rep calendars.',
            to: '/services/ai-agent-development',
            tag: '24/7 Agents',
          },
          {
            icon: 'BarChart3',
            title: 'Revenue Analytics',
            description: 'Gain real-time visibility into conversion velocity, rep performance, and pipeline revenue forecasts.',
            to: '/services/crm-development',
            tag: 'Analytics',
          },
        ],
        bottomCta: {
          text: 'Need a custom AI pipeline shaped for your sales org?',
          buttonText: 'Talk with an AI Architect',
          action: 'modal',
        },
      },
      process: {
        enabled: true,
        order: 40,
        title: 'How intelligent revenue automation works',
        subtitle: 'From raw prospect capture to closed-won revenue in seconds.',
        steps: [
          {
            stepNum: '01',
            category: 'Capture',
            icon: 'UserPlus',
            title: 'Inbound Capture',
            desc: 'Capture leads across WhatsApp, website forms, ad campaigns, and direct phone calls in real time.',
          },
          {
            stepNum: '02',
            category: 'AI Enrichment',
            icon: 'Database',
            title: 'Profile Enrichment',
            desc: 'Instant lookup attaches company size, revenue, industry, and contact firmographics automatically.',
          },
          {
            stepNum: '03',
            category: 'Intent Detection',
            icon: 'BrainCircuit',
            title: 'Buyer Intent NLP',
            desc: 'Natural language analysis classifies buyer purchase urgency, budget signals, and specific pain points.',
          },
          {
            stepNum: '04',
            category: 'Lead Scoring',
            icon: 'Activity',
            title: 'Propensity Scoring',
            desc: 'Predictive algorithm assigns real-time deal conversion score from 1 to 100.',
          },
          {
            stepNum: '05',
            category: 'Smart Routing',
            icon: 'Users',
            title: 'Intelligent Assignment',
            desc: 'Instant rule and skill-based matching assigns the opportunity to the ideal sales representative.',
          },
          {
            stepNum: '06',
            category: '24/7 AI Agent',
            icon: 'Bot',
            title: 'Autonomous Outreach',
            desc: 'AI agent responds in seconds, answers questions from approved playbooks, and books calendar meetings.',
          },
          {
            stepNum: '07',
            category: 'Human Handoff',
            icon: 'Headset',
            title: 'Seamless Rep Handoff',
            desc: 'Sales reps take over with full conversation summary, customer history, and objection preparation.',
          },
          {
            stepNum: '08',
            category: 'Closed-Won',
            icon: 'CheckCircle2',
            title: 'Revenue Conversion',
            desc: 'Deal closed with automated contract triggers, ERP synchronization, and client onboarding sequences.',
          },
        ],
        footer: {
          label: 'Enterprise Workflow Execution',
          title: 'Enterprise Reliability Standards',
          desc: 'Every step is verified by automated SLA triggers and chronological security audit logging.',
          buttonText: 'Explore Pipeline Architecture',
          buttonUrl: '/services/crm-development',
        },
      },
      industries: {
        enabled: true,
        order: 50,
        title: 'Built for the way your industry sells',
        subtitle: 'Tailored data models, compliance guardrails, and communication workflows for your sector.',
        list: [
          {
            icon: 'Laptop',
            name: 'SaaS & Technology',
            desc: 'Product-led trial conversions, subscription tracking, and automated onboarding drips.',
            to: '/industries/enterprise',
          },
          {
            icon: 'Home',
            name: 'Real Estate',
            desc: 'Instant WhatsApp lead capture, automated site-visit scheduling, and broker routing.',
            to: '/industries/real-estate',
          },
          {
            icon: 'Building2',
            name: 'Healthcare',
            desc: 'Patient intake automation, doctor appointment booking, and WhatsApp reminders.',
            to: '/industries/healthcare',
          },
          {
            icon: 'ShoppingBag',
            name: 'E-commerce & Retail',
            desc: 'WhatsApp catalog messaging, cart recovery sequences, and order dispatch updates.',
            to: '/industries/retail',
          },
          {
            icon: 'Landmark',
            name: 'Finance & FinTech',
            desc: 'Encrypted client communication, KYC verification workflows, and compliance audit trails.',
            to: '/industries/finance',
          },
          {
            icon: 'GraduationCap',
            name: 'Education & EdTech',
            desc: 'Student enrollment tracking, automated admissions counsel, and WhatsApp alerts.',
            to: '/industries/education',
          },
          {
            icon: 'Factory',
            name: 'Manufacturing',
            desc: 'Distributor quotation pipelines, multi-warehouse sync, and automated order tracking.',
            to: '/industries/manufacturing',
          },
          {
            icon: 'Briefcase',
            name: 'Professional Services',
            desc: 'Legal and consulting intake, client matter tracking, and automated retainers.',
            to: '/industries/legal',
          },
        ],
      },
      omnichannel: {
        enabled: true,
        order: 60,
        title: 'One AI agent. Every customer conversation.',
        subtitle: 'Unify your communication channels into an autonomous revenue engine with continuous CRM memory.',
        centerNode: {
          tag: 'Central Engine',
          title: 'Gyan VaniAi Brain',
          statusText: 'Autonomous Neural Orchestrator',
        },
        channels: [
          {
            id: 'whatsapp',
            icon: 'MessageSquare',
            title: 'WhatsApp Business',
            highlight: 'Coexistence Mode',
            desc: 'Keep your mobile app active while deploying AI auto-replies and shared team inboxes on the same number.',
            to: '/services/whatsapp-coexistence',
            stat: '< 3s Latency',
          },
          {
            id: 'voice',
            icon: 'PhoneCall',
            title: 'AI Voice Agents',
            highlight: 'Sub-300ms Latency',
            desc: 'Human-like conversational phone bots that handle inbound support and outbound qualification calls.',
            to: '/services/voice-bot-assistant',
            stat: '99.4% ASR Accuracy',
          },
          {
            id: 'email',
            icon: 'Mail',
            title: 'Email & Sequences',
            highlight: 'Context-Aware',
            desc: 'Personalized outreach, smart follow-up triggers, and instant reply parsing directly into CRM stages.',
            to: '/services/crm-development',
            stat: 'Automated Drips',
          },
          {
            id: 'chat',
            icon: 'MessageCircle',
            title: 'Website Live Chat',
            highlight: 'RAG Grounded',
            desc: 'Instant answers from your verified knowledge base with smooth human escalation when needed.',
            to: '/services/ai-chatbots',
            stat: '0-Hallucination',
          },
          {
            id: 'sms',
            icon: 'Smartphone',
            title: 'SMS & WhatsApp Calling',
            highlight: 'Global Reach',
            desc: 'Direct voice calls over WhatsApp and broadcast SMS templates with full delivery tracking.',
            to: '/services/whatsapp-calling-agent',
            stat: 'Global Gateways',
          },
          {
            id: 'crm',
            icon: 'Database',
            title: 'Unified CRM Context',
            highlight: 'Single Timeline',
            desc: 'Every call audio transcript, WhatsApp message, and email thread synced to the customer record in real time.',
            to: '/services/crm-development',
            stat: 'Real-Time Sync',
          },
        ],
      },
      security: {
        enabled: true,
        order: 70,
        title: 'Enterprise security without enterprise complexity',
        subtitle: 'Engineered from the ground up for strict data privacy, dedicated environment isolation, and regulatory compliance.',
        cards: [
          {
            icon: 'KeyRound',
            title: 'Role-Based Access Control',
            desc: 'Granular permissions by team, role, and branch location to prevent unauthorized data exposure.',
          },
          {
            icon: 'Database',
            title: 'Dedicated Environment & Data Isolation',
            desc: 'Vector stores and operational databases are siloed in dedicated environments with strict cryptographic access boundaries.',
          },
          {
            icon: 'Lock',
            title: 'End-to-End Data Encryption',
            desc: 'All communications encrypted in transit with TLS 1.3 and at rest with military-grade AES-256.',
          },
          {
            icon: 'FileText',
            title: 'Immutable Audit Logs',
            desc: 'Complete chronological audit trails for every rep action, AI response, and webhook event.',
          },
          {
            icon: 'ShieldCheck',
            title: 'Meta Tech Provider Verification',
            desc: 'Official Meta Cloud API integration adhering strictly to Meta business and privacy compliance.',
          },
          {
            icon: 'Server',
            title: 'PII Masking & Privacy Guardrails',
            desc: 'Automatic redaction of sensitive payment and personal identification data before LLM processing.',
          },
        ],
        cta: {
          buttonText: 'Explore Security',
          buttonUrl: '/security',
        },
      },
      portfolio: {
        enabled: true,
        order: 80,
        title: 'Measurable revenue results in production',
        subtitle: 'Production systems engineered by our team, driving real operational efficiency and pipeline growth.',
        metrics: [
          {
            value: '40%',
            label: 'Faster Lead Response',
            desc: 'From hours to under 30 seconds across WhatsApp and web channels.',
            icon: 'Clock',
          },
          {
            value: '3x',
            label: 'More Qualified Pipeline',
            desc: 'Autonomous AI intent scoring and real-time enrichment.',
            icon: 'TrendingUp',
          },
          {
            value: '60%',
            label: 'Less Manual Data Entry',
            desc: 'Automated CRM status sync, transcript parsing, and task logging.',
            icon: 'Zap',
          },
          {
            value: '99.9%',
            label: 'Platform SLA Uptime',
            desc: 'Enterprise cloud architecture with sub-100ms API response times.',
            icon: 'ShieldCheck',
          },
        ],
        caseStudies: [
          {
            title: 'Hospital Patient Intake CRM',
            industry: 'Healthcare',
            challenge: 'Manual appointment scheduling and fragmented records across 4 clinic branches.',
            solution: 'Custom CRM with automated queue intake, electronic records, and WhatsApp patient follow-ups.',
            outcome: '65% faster check-in flow and 40% reduction in patient appointment drop-offs.',
            to: '/services/crm-development',
          },
          {
            title: 'EdTech 24/7 AI Learning Portal',
            industry: 'Education',
            challenge: 'Inconsistent student engagement and lack of centralized progress tracking.',
            solution: 'Custom LMS with an autonomous RAG-powered AI tutor for instant doubt resolution.',
            outcome: 'Increased student retention by 60% and automated 80% of routine mentor queries.',
            to: '/services/crm-development',
          },
          {
            title: 'Multi-Warehouse Supply Chain ERP',
            industry: 'Manufacturing',
            challenge: 'Inefficient multi-branch inventory tracking leading to stockouts and dispatch delays.',
            solution: 'Cloud ERP with live telemetry analytics and predictive restocking triggers.',
            outcome: 'Eliminated stockouts and reduced warehouse carrying costs by 25%.',
            to: '/services/crm-development',
          },
        ],
      },
      faq: {
        enabled: true,
        order: 90,
        title: 'Frequently Asked Questions',
        subtitle: 'Everything you need to know about our AI CRMs, integrations, and deployment timelines.',
        includeSchema: true,
        items: [
          {
            question: 'How long does a CRM project take?',
            answer: 'Timelines vary based on complexity. Standard CRM implementations take 2-4 weeks, while custom enterprise CRM systems with complex workflows can take 2-3 months.',
          },
          {
            question: 'Do you build custom software?',
            answer: 'Yes! We specialize in custom software development, including AI agents, HRMS, ERP systems, and business portals tailored to your exact operational needs.',
          },
          {
            question: 'Can you integrate with existing systems?',
            answer: 'Absolutely. Our solutions are designed to seamlessly integrate with your existing databases, legacy software, enterprise systems, Stripe, or SAP.',
          },
          {
            question: 'Do you provide post-launch support?',
            answer: 'Yes, we view deployment as the beginning of our partnership. We offer comprehensive maintenance, updates, security patching, and ongoing support.',
          },
          {
            question: 'Which industries do you specialize in?',
            answer: 'We have delivered solutions across Healthcare, Education, Manufacturing, Real Estate, Logistics, Finance, and Enterprise IT.',
          },
          {
            question: 'What is the difference between WhatsApp Coexistence and WhatsApp Business API?',
            answer: 'WhatsApp Coexistence lets you keep your personal WhatsApp app running on your existing number while Gyan VaniAi runs business automation in parallel — no number change needed. The standard WhatsApp Business API replaces personal access entirely. Our Coexistence solution is Meta Tech Provider certified and ideal for sales teams that need both personal and business messaging on one device.',
          },
          {
            question: 'How much does an AI CRM system cost?',
            answer: 'Pricing depends on features and team size. Our AI CRM packages start from ₹8,000/month for India-based clients and $99/month for international clients. Enterprise custom builds are scoped per project with a detailed technical proposal.',
          },
          {
            question: 'Is my data secure? What compliance standards do you follow?',
            answer: 'All our platforms are built with SOC2 Type II readiness, end-to-end encryption, and role-based access control. Your data is never used to train third-party AI models. We support GDPR compliance for EU clients and follow ISO 27001 security best practices across all deployments.',
          },
        ],
      },
      contact: {
        enabled: true,
        order: 100,
        eyebrow: 'Get in Touch',
        title: 'Ready to transform your revenue operations?',
        subtitle: 'See how AI can automate your lead management, qualification, enrichment and customer conversations.',
        checklist: [
          'Under 30-min response during business hours',
          'Dedicated Solutions Architect assigned to your use case',
          'Zero-commitment customized technical POC proposal',
        ],
        contactInfo: {
          email: 'contact@gyanvaniai.com',
          phone: '+91 8700620913',
          location: 'New Delhi, India',
        },
      },
      footer: {
        enabled: true,
        order: 110,
        tagline: 'Autonomous AI CRM and revenue operations software engineered for high-velocity teams.',
        socialLinks: {
          whatsapp: 'https://wa.me/918700620913?text=Hi%20Gyan%20VaniAi%2C%20I%20would%20like%20to%20connect%20regarding%20your%20AI%20CRM%20solutions.',
          email: 'mailto:contact@gyanvaniai.com',
          maps: 'https://maps.app.goo.gl/Ts3kKh9L8fe4m9AP6',
          facebook: 'https://www.facebook.com/gyanvaniai/',
          linkedin: 'https://www.linkedin.com/company/gyan-vaniai',
          github: 'https://github.com/gyanvaniai',
          twitter: '',
        },
        copyright: '© 2026 Gyan VaniAi. All rights reserved.',
      },
    },
  };
}

// Security & URL Validation
const SAFE_URL_PATTERN = /^(https?:\/\/|\/|#|mailto:|tel:)/i;
const SCRIPT_TAG_PATTERN = /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi;
const UNSAFE_PROTOCOL_PATTERN = /^(javascript:|data:|vbscript:)/i;

export function sanitizeString(val) {
  if (typeof val !== 'string') return val;
  // Disallow <script> tags and direct script execution
  return val.replace(SCRIPT_TAG_PATTERN, '').trim();
}

export function isSafeUrl(url) {
  if (!url || typeof url !== 'string') return true;
  const trimmed = url.trim();
  if (!trimmed) return true;
  if (UNSAFE_PROTOCOL_PATTERN.test(trimmed)) return false;
  return SAFE_URL_PATTERN.test(trimmed);
}

// Deep sanitization of all nested strings and URL fields
export function sanitizeLandingPageDoc(doc) {
  if (!doc || typeof doc !== 'object') return doc;

  if (Array.isArray(doc)) {
    return doc.map(item => sanitizeLandingPageDoc(item));
  }

  const clean = {};
  for (const [key, val] of Object.entries(doc)) {
    if (typeof val === 'string') {
      clean[key] = sanitizeString(val);
    } else if (val && typeof val === 'object' && !(val instanceof Date)) {
      clean[key] = sanitizeLandingPageDoc(val);
    } else {
      clean[key] = val;
    }
  }
  return clean;
}

// Validation function before publishing
export function validateForPublish(doc) {
  const errors = [];

  if (!doc) {
    return ['Landing page content is missing.'];
  }

  // SEO validation
  if (!doc.seo?.title || doc.seo.title.trim().length < 5) {
    errors.push('SEO Title is required (min 5 characters).');
  }
  if (!doc.seo?.description || doc.seo.description.trim().length < 10) {
    errors.push('SEO Meta Description is required (min 10 characters).');
  }

  // URL checks across sections
  const checkUrlField = (url, fieldLabel) => {
    if (url && !isSafeUrl(url)) {
      errors.push(`${fieldLabel} contains an invalid or unsafe URL (${url}). Only http://, https://, /, #, mailto:, and tel: are permitted.`);
    }
  };

  const sections = doc.sections || {};

  // Hero validation
  if (sections.hero?.enabled) {
    if (!sections.hero.slides || sections.hero.slides.length === 0) {
      errors.push('Hero section must contain at least one slide.');
    } else {
      sections.hero.slides.forEach((slide, idx) => {
        if (!slide.titlePrefix && !slide.titleGradient) {
          errors.push(`Hero Slide #${idx + 1} requires a headline title.`);
        }
        checkUrlField(slide.imageDark, `Hero Slide #${idx + 1} Dark Image`);
        checkUrlField(slide.imageLight, `Hero Slide #${idx + 1} Light Image`);
      });
    }
    checkUrlField(sections.hero.primaryCta?.destination, 'Hero Primary CTA');
    checkUrlField(sections.hero.whatsappCta?.destination, 'Hero WhatsApp CTA');
    checkUrlField(sections.hero.secondaryCta?.destination, 'Hero Secondary CTA');
  }

  // Process validation
  if (sections.process?.enabled) {
    checkUrlField(sections.process.footer?.buttonUrl, 'Process Footer URL');
  }

  // Security validation
  if (sections.security?.enabled) {
    checkUrlField(sections.security.cta?.buttonUrl, 'Security Explore URL');
  }

  // Footer validation
  if (sections.footer?.enabled) {
    const sl = sections.footer.socialLinks || {};
    checkUrlField(sl.whatsapp, 'Footer WhatsApp URL');
    checkUrlField(sl.email, 'Footer Email URL');
    checkUrlField(sl.maps, 'Footer Maps URL');
    checkUrlField(sl.facebook, 'Footer Facebook URL');
    checkUrlField(sl.linkedin, 'Footer LinkedIn URL');
    checkUrlField(sl.github, 'Footer GitHub URL');
  }

  return errors;
}
