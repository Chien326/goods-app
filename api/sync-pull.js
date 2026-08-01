// Vercel serverless function: 代理浏览器去拉 Supabase。
// 目的：绕开客户端网络路径上（VPN/代理）对 *.supabase.co 的缓存。
// 浏览器 → *.vercel.app（用户已在用 + 加 ?_= cache-buster URL 每次不同 + 响应 no-store）
//   → Vercel 函数（每次冷启动 fresh 拉 Supabase，无用户代理介入）
//   → Supabase。
//
// 暴露的 SUPABASE_ANON_KEY 本就是 public/publishable key（设计上暴露给浏览器），
// 在这里再透传一次不会扩大攻击面（RLS 关闭，所有家庭设备匿名读写本就预期）。
export default async function handler(req, res) {
    const ANON_KEY = process.env.SUPABASE_ANON_KEY
        || 'sb_publishable_T3iqyBHs4SFL1q2x5TILsw_H6VFCja0';
    const SUPABASE_URL = process.env.SUPABASE_URL
        || 'https://ytsldmkdoztgohovibdy.supabase.co';
    const SUPA = `${SUPABASE_URL}/rest/v1/goods_records`;
    const authH = {
        'apikey': ANON_KEY,
        'Authorization': 'Bearer ' + ANON_KEY,
        'Cache-Control': 'no-cache'
    };

    // CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Cache-Buster');

    // 响应禁止缓存（兜底，防止 Vercel CDN / 浏览器 / 中间代理缓存）
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');

    if (req.method === 'OPTIONS') return res.status(204).end();
    if (req.method !== 'GET') return res.status(405).json({ error: 'method not allowed' });

    try {
        // 并行：count + 全量数据；强制每次 fresh
        const [cr, dr] = await Promise.all([
            fetch(`${SUPA}?select=count`, { headers: authH, cache: 'no-store' }),
            fetch(`${SUPA}?select=*&order=updated_at.asc`, { headers: authH, cache: 'no-store' })
        ]);
        if (!cr.ok) {
            return res.status(502).json({ error: 'count upstream ' + cr.status });
        }
        if (!dr.ok) {
            return res.status(502).json({ error: 'pull upstream ' + dr.status });
        }
        const cj = await cr.json();
        const rows = await dr.json();
        const total = Array.isArray(cj) && cj[0] ? parseInt(cj[0].count, 10) : null;
        return res.status(200).json({ total: total, rows: rows });
    } catch (e) {
        return res.status(500).json({ error: (e && e.message) || String(e) });
    }
}