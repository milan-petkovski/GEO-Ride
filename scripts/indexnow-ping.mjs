/**
 * @file scripts/indexnow-ping.mjs
 * @description Pings Bing, Yandex, Seznam, and Naver via the IndexNow protocol whenever /play or / is updated.
 * Usage: npm run indexnow
 */

const HOST = 'playgeoride.com';
const KEY = 'georide-indexnow-key';
const KEY_LOCATION = `https://${HOST}/${KEY}.txt`;
const URL_LIST = [
    `https://${HOST}/play`,
    `https://${HOST}/`,
    `https://${HOST}/llms.txt`,
    `https://${HOST}/llms-full.txt`,
    `https://${HOST}/sitemap.xml`
];

async function pingIndexNow() {
    const payload = {
        host: HOST,
        key: KEY,
        keyLocation: KEY_LOCATION,
        urlList: URL_LIST
    };

    try {
        const res = await fetch('https://api.indexnow.org/indexnow', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json; charset=utf-8' },
            body: JSON.stringify(payload)
        });
        console.log(`[IndexNow] Status: ${res.status} (${res.statusText})`);
        console.log(`[IndexNow] Submitted ${URL_LIST.length} URLs for ${HOST}`);
    } catch (err) {
        console.error('[IndexNow] Error submitting URLs:', err.message);
        process.exitCode = 1;
    }
}

pingIndexNow();
