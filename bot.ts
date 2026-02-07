import "dotenv/config";

import { SimplePool, finalizeEvent, nip19, getPublicKey } from "nostr-tools";
import type { Event } from "nostr-tools";

const RELAYS = process.env.NOSTR_RELAYS?.trim()?.split(/\s*\n\s*/);
if (!RELAYS) throw new Error("Set NOSTR_RELAYS");

const nsec = process.env.NOSTR_NSEC;
if (!nsec) throw new Error("Set NOSTR_NSEC");

const decoded = nip19.decode(nsec);
if (decoded.type !== "nsec") throw new Error("NOSTR_NSEC must be nsec...");
const sk = decoded.data as Uint8Array;

const pubkey = getPublicKey(sk);

const pool = new SimplePool({ enablePing: true, enableReconnect: true });
const seen = new Set<string>();

function replySign(ev: Event): string | undefined {
  const content = ev.content;
  if (!content) return;
  if (content.match(/\b[qQ][rR]\s*コード/)) {
    return 'ja';
  }
  if (content.match(/\b[qQ][rR]\s*codes?\b/)) {
    return 'en';
  }
}

function now() {
  return Math.floor(Date.now() / 1000);
}

function makeReplyEvent(target: Event, sign: string) {
  const tags: string[][] = [
    ["e", target.id, "", "reply"],
    ["p", target.pubkey],
  ];

  let content: string | undefined;
  switch(sign) {
    case 'ja':
      content = 'QRコードは株式会社デンソーウェーブの登録商標です。';
      break;
    case 'en':
      content = 'QR Code is a registered trademark of DENSO WAVE INCORPORATED in Japan and in other countries.';
      break;
    default:
      content = 'QR Code is a registered trademark of DENSO WAVE INCORPORATED in Japan and in other countries.';
  }

  return finalizeEvent(
    {
      kind: 1,
      created_at: now(),
      tags,
      content: content,
    },
    sk
  );
}

function main() {
  const sub = pool.subscribeMany(
    RELAYS,
    {
      kinds: [1],
      since: now(),
    },
    {
      onevent: async (ev: Event) => {
        if (ev.pubkey === pubkey) return;
        if (seen.has(ev.id)) return;

        const sign = replySign(ev);
        if (!sign) return;
        seen.add(ev.id);

        const reply = makeReplyEvent(ev, sign);

        await Promise.allSettled(pool.publish(RELAYS, reply));
        console.log("Replied to", ev.id);
      },
    }
  );

  process.on("SIGINT", async () => {
    sub.close();
    pool.close(RELAYS);
    process.exit(0);
  });
}

main()
