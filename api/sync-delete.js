// Vercel serverless function: 代理浏览器清空 Supabase 全表（forceSync 用）。
// 同样绕开客户端对 *.supabase.co 的代理问题。
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
        // id=not.is.null 是 PostgREST 全表删除的正确语法（id=neq. 不会真的删除）
        const r = await fetch(`${SUPA}?id=not.is.null`, {
            method: 'DELETE',
            headers: {
                'apikey': ANON_KEY,
                'Authorization': 'Bearer ' + ANON_KEY
            }
        });
        const text = await r.text();
        if (!r.ok && r.status !== 204) {
            return res.status(r.status).json({ error: 'upstream ' + r.status, detail: text });
        }
        return res.status(200).json({ ok: true, deleted: true });
    } catch (e) {
        return res.status(500).json({ error: (e && e.message) || String(e) });
    }
}