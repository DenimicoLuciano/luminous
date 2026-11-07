// LumiCoin Core client — Luminous's connection to the unified Lumiworld
// LUMI ledger. Core is the single source of truth for LumiCoin balances of
// Lumiail-linked users: every product reads the same wallet and posts every
// earn / spend / transfer to it, so the number is identical everywhere.
//
// The client is ENV-GATED: it is enabled only when BOTH LUMICOIN_CORE_URL
// and LUMICOIN_PRODUCT_KEY are set. When disabled — or when any call fails
// (network error, non-200) — every helper returns null and callers fall back
// to the local wallet exactly as before. Core can never break Luminous.

const BASE = (process.env.LUMICOIN_CORE_URL || '').replace(/\/+$/, '');
const KEY = process.env.LUMICOIN_PRODUCT_KEY || '';
const PRODUCT = 'luminous';
const TIMEOUT_MS = 10000;

function enabled() {
  return !!(BASE && KEY);
}

async function call(method, pathname, body) {
  if (!enabled()) return null;
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), TIMEOUT_MS);
  try {
    const r = await fetch(BASE + pathname, {
      method,
      headers: { 'Content-Type': 'application/json', 'x-product-key': KEY },
      body: body ? JSON.stringify(body) : undefined,
      signal: ctl.signal,
    });
    if (!r.ok) return null;
    return await r.json();
  } catch (e) {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

// GET the unified wallet for a Lumiail address →
// { lumiail_address, balance, pending, available, total_earned, total_spent } | null
async function getWallet(address) {
  if (!address) return null;
  const d = await call('GET', `/api/products/${PRODUCT}/users/${encodeURIComponent(address)}/wallet`);
  return d && d.wallet ? d.wallet : null;
}

// POST a single-wallet transaction { lumiail_address, kind, amount, note?, idempotency_key }
// kind: earn | spend | withdrawal_pending | withdrawal_complete | withdrawal_cancel
async function postTransaction(tx) {
  if (!tx || !tx.lumiail_address) return null;
  return call('POST', `/api/products/${PRODUCT}/transactions`, tx);
}

// POST a paired transfer { from_address, to_address, amount, note?, idempotency_key }
// (debits the sender's Core wallet, credits the recipient's). Used for gifts.
async function postPurchase(p) {
  if (!p || !p.from_address || !p.to_address) return null;
  return call('POST', `/api/products/${PRODUCT}/purchases`, p);
}

module.exports = { enabled, getWallet, postTransaction, postPurchase };
