/**
 * Multi-Channel Inbound Lead Notification Engine
 * Dispatches real-time alerts across Slack, Discord, and WhatsApp Webhook pipelines
 */

export async function dispatchMultiChannelLeadAlert({ lead, channel = 'crm' }) {
  const slackUrl = process.env.SLACK_WEBHOOK_URL;
  const discordUrl = process.env.DISCORD_WEBHOOK_URL;
  const whatsAppWebhook = process.env.WHATSAPP_ALERT_WEBHOOK;

  const isPortfolio = channel === 'portfolio';
  const headerTitle = isPortfolio
    ? `🎯 [PORTFOLIO INQUEST] ${lead.name}`
    : `🚀 [NEW CRM LEAD] ${lead.name}`;

  const sourceName = isPortfolio ? 'Himanshu Bharti Systems Studio' : 'Gyan Vani AI Technologies';
  const ndaText = lead.ndaRequired ? '⚠️ *MUTUAL NDA REQUESTED*' : 'Standard';

  const promises = [];

  // 1. Slack Webhook Dispatch
  if (slackUrl && slackUrl.startsWith('https://hooks.slack.com/')) {
    promises.push(
      fetch(slackUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: `${headerTitle} - ${lead.company || lead.email}`,
          blocks: [
            {
              type: 'header',
              text: { type: 'plain_text', text: headerTitle, emoji: true },
            },
            {
              type: 'section',
              fields: [
                { type: 'mrkdwn', text: `*Source:*\\n${sourceName}` },
                { type: 'mrkdwn', text: `*Inquest / Subject:*\\n${lead.subject || 'Website Inquiry'}` },
                { type: 'mrkdwn', text: `*Email:*\\n${lead.email}` },
                { type: 'mrkdwn', text: `*Phone:*\\n${lead.phone || 'Not provided'}` },
                { type: 'mrkdwn', text: `*Company:*\\n${lead.company || 'Not provided'}` },
                { type: 'mrkdwn', text: `*Protocol:*\\n${ndaText}` },
              ],
            },
            {
              type: 'section',
              text: {
                type: 'mrkdwn',
                text: `*Message Content:*\\n>${(lead.message || '').replace(/\\n/g, '\\n>')}`,
              },
            },
          ],
        }),
      }).catch((err) => console.warn('[Slack Webhook Error]:', err.message))
    );
  }

  // 2. Discord Webhook Dispatch
  if (discordUrl && discordUrl.startsWith('https://discord.com/api/webhooks/')) {
    promises.push(
      fetch(discordUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: isPortfolio ? 'Portfolio Inquests' : 'GyanVani CRM Bot',
          embeds: [
            {
              title: headerTitle,
              description: lead.message,
              color: isPortfolio ? 0x8a8f70 : 0x10b981,
              fields: [
                { name: 'Email', value: lead.email, inline: true },
                { name: 'Phone', value: lead.phone || 'N/A', inline: true },
                { name: 'Company', value: lead.company || 'N/A', inline: true },
                { name: 'Subject', value: lead.subject || 'Website Inquest', inline: false },
                { name: 'NDA Requested', value: lead.ndaRequired ? 'Yes (Bilateral)' : 'No', inline: true },
                { name: 'Channel', value: channel, inline: true },
              ],
              footer: { text: `DPDP Consent Verified (${lead.consentVersion || 'v1'})` },
              timestamp: new Date().toISOString(),
            },
          ],
        }),
      }).catch((err) => console.warn('[Discord Webhook Error]:', err.message))
    );
  }

  // 3. WhatsApp Notification Dispatch (Custom Webhook / WhatsApp Gateway)
  if (whatsAppWebhook && whatsAppWebhook.startsWith('http')) {
    const textMsg = `*${headerTitle}*\\n*Name:* ${lead.name}\\n*Email:* ${lead.email}\\n*Phone:* ${lead.phone || 'N/A'}\\n*Company:* ${lead.company || 'N/A'}\\n*Message:* ${lead.message}\\n*NDA:* ${lead.ndaRequired ? 'Yes' : 'No'}`;
    promises.push(
      fetch(whatsAppWebhook, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: textMsg,
          leadId: lead._id?.toString(),
          channel,
        }),
      }).catch((err) => console.warn('[WhatsApp Webhook Error]:', err.message))
    );
  }

  if (promises.length > 0) {
    await Promise.allSettled(promises);
  }
}

