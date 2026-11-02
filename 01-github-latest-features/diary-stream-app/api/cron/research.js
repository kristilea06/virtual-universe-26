const crypto = require('crypto');
const { getDatabase, updateAiCommunityFeed } = require('../../server');

module.exports = async function handler(req, res) {
  const secret = process.env.CRON_SECRET || '';
  const authorization = req.headers.authorization || '';
  const expectedAuthorization = `Bearer ${secret}`;
  const provided = Buffer.from(authorization);
  const expected = Buffer.from(expectedAuthorization);

  if (!secret) {
    return res.status(503).json({ ok: false, message: 'Scheduled research updates are not configured.' });
  }
  if (provided.length !== expected.length || !crypto.timingSafeEqual(provided, expected)) {
    return res.status(401).json({ ok: false, message: 'Unauthorized' });
  }

  try {
    const database = await getDatabase();
    const result = await updateAiCommunityFeed(database);
    return res.status(200).json({ ok: true, ...result });
  } catch (error) {
    console.error('Scheduled research update failed:', error);
    return res.status(500).json({ ok: false, message: 'Scheduled research update failed.' });
  }
};
