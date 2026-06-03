import "dotenv/config";

import { SimplePool, finalizeEvent, nip19, getPublicKey } from "nostr-tools";

const RELAYS = process.env.NOSTR_RELAYS?.trim()?.split(/\s*\n\s*/);
if (!RELAYS) throw new Error("Set NOSTR_RELAYS");

const nsec = process.env.NOSTR_NSEC;
if (!nsec) throw new Error("NOSTR_NSEC is not set");

const decoded = nip19.decode(nsec);
if (decoded.type !== "nsec") throw new Error("NOSTR_NSEC must be nsec...");
const sk = decoded.data as Uint8Array;

const pubkey = getPublicKey(sk);

const ev = finalizeEvent(
  {
    kind: 1,
    created_at: Math.floor(Date.now() / 1000),
    tags: [
      ['client', 'client'],
    ],
    content: 'content',
  },
  sk
);

const pool = new SimplePool({ enablePing: true, enableReconnect: true });

async function main() {
  const pubs = pool.publish(RELAYS, ev);

  const results = await Promise.allSettled(pubs);
  for (const r of results) {
    if (r.status === "fulfilled") {
      console.log("OK:", r.value);
    } else {
      console.log("FAIL:", r.reason);
    }
  }

  pool.close(RELAYS);
}

main().catch(console.error);
