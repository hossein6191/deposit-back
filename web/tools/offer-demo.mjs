// Offers copies of the demo landlord's six sample flats from its key, so that many visitors can each
// take one. Run it by hand once the contract is deployed; nothing in the build runs it.
//
//   REGISTER=0x... DEMO_LANDLORD_KEY=0x... node tools/offer-demo.mjs          # 3 copies of each sample
//   COPIES=5 ONLY=bakery,canal REGISTER=0x... DEMO_LANDLORD_KEY=0x... node tools/offer-demo.mjs
//   DRY=1 REGISTER=0x... node tools/offer-demo.mjs                              # print the calls, send nothing
//
// The key is a throwaway Studio test key, the same one the site's server holds in DEMO_LANDLORD_KEY;
// it is read from the environment only and never printed. Studio is gasless, so the key needs no GEN.
// Each offer is sent, then followed to FINALIZED, before the next one goes out: a landlord's offers
// are its own nonce sequence. The script prints every flat id it made and the explorer link.
// Needs Node 22.18 or later (it reads lib/demo-flats.ts directly).

import { createAccount, createClient } from "genlayer-js";
import { studionet } from "genlayer-js/chains";

import { DEMO_SAMPLES, offerArgs } from "../lib/demo-flats.ts";

const RPC = "https://studio.genlayer.com/api";
const EXPLORER = "https://explorer-studio.genlayer.com";
const studio = { ...studionet, rpcUrls: { ...studionet.rpcUrls, default: { http: [RPC] } } };

const REGISTER = (process.env.REGISTER || "").trim();
const KEY = (process.env.DEMO_LANDLORD_KEY || "").trim();
const COPIES = Math.max(1, Math.min(20, Number(process.env.COPIES || 3) || 3));
const ONLY = (process.env.ONLY || "").split(",").map((s) => s.trim()).filter(Boolean);
const DRY = process.env.DRY === "1";

const fail = (message) => {
  console.error(message);
  process.exit(2);
};
if (!/^0x[0-9a-fA-F]{40}$/.test(REGISTER)) fail("REGISTER must be the deployed contract's 0x address.");
if (!DRY && !/^0x[0-9a-fA-F]{64}$/.test(KEY)) fail("DEMO_LANDLORD_KEY must be a 0x private key of 64 hex characters (a throwaway Studio key).");
// Only the demo landlord's six (DEMO_SAMPLES): the flats page lists no other sample as the demo's.
const unknown = ONLY.filter((k) => !DEMO_SAMPLES.some((s) => s.key === k));
if (unknown.length) fail(`No demo sample flat called ${unknown.join(", ")}. The six are ${DEMO_SAMPLES.map((s) => s.key).join(", ")}.`);

const samples = DEMO_SAMPLES.filter((s) => !ONLY.length || ONLY.includes(s.key));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function rpc(method, params) {
  for (let i = 0; i < 30; i++) {
    try {
      const res = await fetch(RPC, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }) });
      const body = await res.json();
      if (body.error) {
        await sleep(res.status === 429 || body.error.code === -32029 ? 20_000 : 5000);
        continue;
      }
      return body.result;
    } catch {
      await sleep(4000);
    }
  }
  throw new Error(`${method} did not answer`);
}

/** Follows a transaction to FINALIZED; returns the contract's JSON return and the vote tally. */
async function follow(hash) {
  for (let i = 0; i < 300; i++) {
    await sleep(4000);
    const tx = await rpc("eth_getTransactionByHash", [hash]);
    const status = String(tx?.status ?? "");
    if (status === "FINALIZED" || status === "CANCELED" || status === "UNDETERMINED") {
      const lr = tx.consensus_data?.leader_receipt;
      const one = Array.isArray(lr) ? lr[0] : lr;
      let text = "";
      try {
        text = Buffer.from(one?.result ?? "", "base64").toString("utf8");
      } catch {
        text = "";
      }
      const start = text.indexOf("{");
      let json = null;
      try {
        json = start >= 0 ? JSON.parse(text.slice(start, text.lastIndexOf("}") + 1)) : null;
      } catch {
        json = null;
      }
      const votes = Object.values(tx.consensus_data?.votes ?? {});
      return { status, json, agree: votes.filter((v) => v === "agree").length, of: votes.length, exec: one?.execution_result ?? "" };
    }
  }
  return { status: "TIMEOUT", json: null, agree: 0, of: 0, exec: "" };
}

console.log(`${DRY ? "DRY RUN: " : ""}${COPIES} cop${COPIES === 1 ? "y" : "ies"} of ${samples.length} sample flat${samples.length === 1 ? "" : "s"} to ${REGISTER}`);
const account = DRY ? null : createAccount(KEY);
if (account) console.log(`demo landlord ${account.address}`);
const client = account ? createClient({ chain: studio, account }) : null;

const made = [];
for (const s of samples) {
  for (let copy = 1; copy <= COPIES; copy++) {
    const args = offerArgs(s);
    if (DRY) {
      console.log(`offer(${JSON.stringify(args[0])}, ${JSON.stringify(args[1])}, <${s.items.length} items>, ${args[3]}, ${args[4]}, ${args[5]})`);
      continue;
    }
    let hash = "";
    for (let tries = 1; !hash; tries++) {
      try {
        hash = await client.writeContract({ address: REGISTER, functionName: "offer", args, value: 0n });
      } catch (e) {
        if (tries >= 3) {
          console.log(`FAIL  ${s.key} copy ${copy}: not sent (${String(e?.shortMessage || e?.message || e).slice(0, 80)})`);
          break;
        }
        await sleep(15_000);
      }
    }
    if (!hash) continue;
    const r = await follow(hash);
    const flat = r.json?.ok === true ? r.json.flat : "";
    console.log(`${flat ? "OK  " : "FAIL"}  ${s.key} copy ${copy}: ${flat || r.status + " " + r.exec}  ${r.agree}/${r.of} agree  ${EXPLORER}/tx/${hash}`);
    if (flat) made.push(flat);
  }
}
if (!DRY) console.log(`\n${made.length} flats offered: ${made.join(", ")}`);
