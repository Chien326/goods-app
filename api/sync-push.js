// Vercel serverless function: 代理浏览器推送数据到 Supabase。
// 与 /api/sync-pull 同理：绕开客户端网络路径上对 *.supabase.co 的代理缓存/拦截。
// 手机端 push 直连 *.supabase.co 会被代理挡掉（和 pull 一样的根因），
// 改走同源 /api/sync-push 后，请求落在 *.vercel.app，代理无法命中缓存。
export default async function handler(req, res) {
    const ANON_KEY = process.env.SUPABASE_ANON_KEY
        || 'sb_publishable_T3iqyBHs4SFL1q2x5TILsw_H6VFCja0';
    const SUPABASE_URL = process.env.SUPABASE_URL
        || 'https://ytsldmkdoztgohovibdy.supabase.co';
    const SUPA = `${SUPABASE_URL}/rest/v1/goods_records`;

    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0');
    res.setHeader('Pragma', 'no-cache');

    if (req.method === 'OPTIONS') return res.status(204).end();
    if (req.method !== 'POST') return res.status(405).json({ error: 'method not allowed' });

    try {
        const rows = req.body;
        if (!Array.isArray(rows)) {
            return res.status(400).json({ error: 'body must be an array of rows' });
        }
        // PostgREST upsert: POST + Prefer: resolution=merge-duplicates → 按 PK(id) 冲突时更新
        const r = await fetch(SUPA, {
            method: 'POST',
            headers: {
                'apikey': ANON_KEY,
                'Authorization': 'Bearer ' + ANON_KEY,
                'Content-Type': 'application/json',
                'Prefer': 'resolution=merge-duplicates'
            },
            body: JSON.stringify(rows)
        });
        const text = await r.text();
        if (!r.ok && r.status !== 201 && r.status !== 204) {
            return res.status(r.status).json({ error: 'upstream ' + r.status, detail: text });
        }
        return res.status(200).json({ ok: true, pushed: rows.length });
    } catch (e) {
        return res.status(500).json({ error: (e && e.message) || String(e) });
    }
}