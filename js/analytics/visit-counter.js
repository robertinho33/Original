export async function recordStoreVisit() {
    try {
        const key='fp-visit-session-v1', now=Date.now();
        let session; try { session=JSON.parse(sessionStorage.getItem(key)); } catch {}
        if (!session || typeof session.id!=='string' || !Number.isFinite(session.startedAt) || now-session.startedAt>=30*60000 || session.startedAt>now) {
            session={id:crypto.randomUUID(),startedAt:now};
            sessionStorage.setItem(key,JSON.stringify(session));
        }
        await fetch('/api/storefront/engagement/visit',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({session:session.id,consent:true}),keepalive:true});
    } catch { /* An unavailable counter must not interrupt shopping. */ }
}
