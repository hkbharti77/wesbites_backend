import { getAuditLogs } from '../services/audit.service.js';

export async function fetchAuditLogs(req, res) {
  try {
    const {
      page = 1,
      limit = 20,
      actorUserId,
      action,
      targetType,
      outcome,
      startDate,
      endDate,
    } = req.query;

    const result = await getAuditLogs({
      page,
      limit,
      actorUserId,
      action,
      targetType,
      outcome,
      startDate,
      endDate,
    });

    return res.status(200).json(result);
  } catch (err) {
    console.error('Fetch Audit Logs Error:', err);
    return res.status(500).json({ error: 'Failed to retrieve audit logs.', code: 'SERVER_ERROR' });
  }
}
