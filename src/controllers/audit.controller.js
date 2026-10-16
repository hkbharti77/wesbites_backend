import { getAuditLogs, getAuditStats, exportAuditLogs } from '../services/audit.service.js';

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
      search,
      category,
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
      search,
      category,
    });

    return res.status(200).json(result);
  } catch (err) {
    console.error('Fetch Audit Logs Error:', err);
    return res.status(500).json({ error: 'Failed to retrieve audit logs.', code: 'SERVER_ERROR' });
  }
}

export async function fetchAuditStats(req, res) {
  try {
    const stats = await getAuditStats();
    return res.status(200).json(stats);
  } catch (err) {
    console.error('Fetch Audit Stats Error:', err);
    return res.status(500).json({ error: 'Failed to retrieve audit statistics.', code: 'SERVER_ERROR' });
  }
}

export async function exportAuditLogsController(req, res) {
  try {
    const {
      action,
      outcome,
      startDate,
      endDate,
      search,
      category,
      format = 'csv',
    } = req.query;

    const exportResult = await exportAuditLogs({
      action,
      outcome,
      startDate,
      endDate,
      search,
      category,
      format,
    });

    res.setHeader('Content-Type', exportResult.contentType);
    res.setHeader('Content-Disposition', `attachment; filename="${exportResult.filename}"`);
    return res.status(200).send(exportResult.data);
  } catch (err) {
    console.error('Export Audit Logs Error:', err);
    return res.status(500).json({ error: 'Failed to export audit logs.', code: 'SERVER_ERROR' });
  }
}

