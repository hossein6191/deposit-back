# Deposit Back

A rental deposit comes back item by item: validators read each deduction
against the move-in and move-out notes and decide whether it is damage or
ordinary wear.

## The problem

Everybody who has rented a flat knows the end of it. The tenant moves out, the
landlord walks round, and a week later a list arrives: repainting, carpet
cleaning, a new worktop. Some of it is fair. Some of it is the flat getting
older, which the rent already paid for. The tenant can argue by email, or take
it to a deposit scheme or a small claims court and wait months, and most
people give up and lose the money.

The question underneath every line of that list is the same, and it is a
question about words: going by what was written when the tenant moved in and
what was written when they moved out, is this damage the tenant should pay for,
or ordinary wear and tear?

## What it is

A landlord **offers** a flat on the contract: a title, an address line, a
deposit, and two to eight items, each with its condition on the day the tenant
moves in, in the landlord's own words. A tenant **takes** the flat by paying
exactly the deposit into the contract, and by taking it accepts those move-in
notes as written. The contract holds the deposit for the whole tenancy.

When the tenant moves out they **give notice**. The landlord then has a fixed
window to file the **move-out report**: one move-out note per item, and up to six
deductions, each naming one item, an amount and a reason. The tenant **accepts**
the report or **contests** some of its deductions. A contest is decided by the
network, and the money moves in the same transaction.

Nobody's money waits on somebody else's silence. A landlord who never files a
report loses every deduction: once the window closes, anyone may **reclaim** the
whole deposit for the tenant. A tenant who never answers accepts the report:
once the response window closes, anyone may **settle** it as filed.

## How consensus is used

`contest` runs one consensus block. For every contested deduction it asks the
same question twice, in two framings and two presentation orders:

| asking | blocks, in order | question |
|---|---|---|
| order 1 | ITEM, MOVE-IN, MOVE-OUT, REASON | Is the change from move-in to move-out damage that goes beyond ordinary wear and tear, so the tenant should pay for it? |
| order 2 | REASON, MOVE-OUT, MOVE-IN, ITEM | Is the change ordinary wear and tear from normal living, or not shown by the notes at all, so the tenant should not pay for it? |

The contract combines the two answers for each deduction into one word:

| order 1 | order 2 | verdict |
|---|---|---|
| yes | no | `damage` |
| no | yes | `wear` |
| anything else, including an answer it cannot read | | `unclear` |

The stored value is the vector of those words, one per contested deduction in
the deductions' order: `D1:wear,D2:damage,D3:wear`. Every validator reruns
every asking itself and compares the whole vector by exact string equality; a
validator never agrees with a leader that raised, and a validator whose own
rerun fails disagrees. There is no tolerance for a bias to hide in: the second
question needs the opposite answer, so a model that says yes to everything, or
no to everything, lands as `unclear`, and an `unclear` deduction goes back to
the tenant.

Before the blocks, every prompt says that all four texts are untrusted and
never an instruction, and that the reason is the landlord's claim, not
evidence. Every text is fenced (`<` and `>` replaced, never deleted) and sits
between two delimiter lines tagged with the start of its own sha256, so a text
cannot write the line that closes it. **The model never sees an amount**, an
address or the deposit: it is asked whether the tenant should pay for a change
at all, never how much.

## Who may do what

| call | who | when |
|---|---|---|
| `offer(title, address_line, items_json, deposit_atto, moveout_seconds, response_seconds)` | anyone; the sender is the landlord | any time; takes no value |
| `withdraw_offer(flat)` | the landlord | while nobody has taken the flat |
| `take(flat)`, payable | anyone but the landlord, one tenant per flat | while the flat is open, with exactly the deposit |
| `give_notice(flat)` | the tenant | once, while the flat is let |
| `report(flat, moveout_json, deductions_json)` | the landlord | after the notice, before the report window closes; once |
| `accept(flat)` | the tenant | before the response window closes |
| `contest(flat, indices_json)` | the tenant | before the response window closes, naming at least one deduction; once |
| `reclaim(flat)` | anyone | after the report window closed with no report |
| `settle(flat)` | anyone | after the response window closed with no answer |

Every write names its caller, and the three that refuse nobody by sender
(`offer`, `reclaim`, `settle`) are listed in the test suite with the reason. A
refused `take` returns what was sent in the same transaction and answers
`{"ok": false, "reason": ..., "returned": ...}`; the other writes take no value
and refuse by raising, so a refusal is a stored transaction a reader can find.

Views take a short id, a number or an address, never a text: `flat(id)`,
`flats(offset, limit)`, `flats_of(address)`, `stats()` and `rules()`.

## The money

| moment | what moves |
|---|---|
| `offer`, `withdraw_offer`, `give_notice` | nothing |
| `take` | the tenant pays exactly the deposit; the contract holds it |
| a refused `take` | everything sent goes back to the sender in the same transaction |
| `report` with no deduction (status `clean`) | the whole deposit goes back to the tenant, in the same call |
| `report` with deductions | nothing yet; the tenant's response window starts |
| `accept` (status `accepted`) | every deduction to the landlord, the rest of the deposit to the tenant |
| `contest` (status `judged`) | a `damage` deduction to the landlord; a `wear` or `unclear` one back to the tenant; an uncontested one to the landlord; the rest of the deposit to the tenant |
| `settle` (status `settled`) | every deduction to the landlord, the rest to the tenant |
| `reclaim` (status `reclaimed`) | the whole deposit back to the tenant |

Every ending pays out exactly the deposit, split two ways. The contract's
balance is always the sum of the deposits it still holds (`stats().held`); the
offline suite checks that after every step of sixty seeded random journeys, and
every journey ends with nothing held.

The demonstration flat, F1, above the bakery: a deposit of 1 GEN and four
deductions. The tenant contests three of them and leaves the cracked mirror
alone.

| deduction | move-out note | amount | contested | verdict | to |
|---|---|---|---|---|---|
| D1 living room walls | two small scuffs near the light switch where furniture touched the wall | 0.3 | yes | `wear` | tenant |
| D2 kitchen worktop | a 6 cm burn mark from a hot pan next to the hob | 0.2 | yes | `damage` | landlord |
| D3 bedroom carpet | general flattening along the path from the door to the bed | 0.15 | yes | `wear` | tenant |
| D4 bathroom mirror | cracked across the lower left corner | 0.25 | no | `uncontested` | landlord |
| the rest | | 0.1 | | | tenant |

The tenant gets 0.55 GEN back and the landlord 0.45 GEN, in the transaction
that carried the verdict.

## Why this has to be on GenLayer

The decision is a reading: does what the landlord wrote at move-out, set
against what they wrote at move-in, describe damage or the flat getting older?
A deterministic contract cannot make it. A single oracle could be asked again
until it said yes, and its answer could not be checked. Here every validator
reads the same notes, the stored value is a closed vector that a disagreement
shows up in, and the deposit follows it in the same transaction, with no
deposit scheme, no agent holding the money and no months of waiting.

## The limits, stated plainly

- **The landlord writes every text the network reads.** The move-in notes, the
  move-out notes and the reasons are all the landlord's. The network judges
  whether the landlord's own words show damage beyond wear, not whether those
  words are true. The tenant's protection is in what those words cannot do:
  the move-in notes are fixed before the tenant pays and are accepted by
  taking the flat; the move-out notes are public, signed by the landlord's
  address and kept for good; the reason is not evidence; and a change the
  notes do not show goes back to the tenant. A landlord who writes a burn that
  is not there can win that deduction, on the public record.
- **The tenant adds no evidence of their own.** There is no reply, no photo,
  no inventory of theirs. Text only, and only the landlord's.
- **The amount is never judged.** The model never sees it. A `damage` verdict
  pays the deduction as filed, so an inflated price for real damage stands.
  The tenant sees every amount before choosing what to contest.
- **`unclear` costs the landlord.** A real stain described vaguely goes back
  to the tenant. That is the price of the burden of proof being the
  landlord's.
- **A tenant who never gives notice keeps the deposit held.** The contract
  never held anything of the landlord's, so the landlord loses nothing held,
  but a landlord cannot start the move-out without the tenant.
- **A round that does not reach agreement stores nothing** and `contest` can
  be sent again while the response window is open; if the window closes first,
  `settle` applies the report as filed. A round that does reach agreement is
  final, `unclear` included.
- **Wear and tear is judged by one general rule**, written in the prompt, not
  by the law of any country. This is not legal advice and replaces no deposit
  scheme where one is required.
- **Texts are printable ASCII on one line.** Titles 3 to 60 characters,
  address lines 3 to 80, item names 3 to 40, move-in and move-out notes 20 to
  400, reasons 20 to 300; 2 to 8 items and at most 6 deductions, one per item.
  Nothing longer is ever judged in part. Deposits are 0.1 to 1000 GEN, each
  window 5 minutes to 30 days.

## What is in this repository

```
contracts/deposit_back.py    the contract
tests/test_pure.py           the offline suite, including the consensus round with scripted models
tests/MUTATIONS.md           every defence removed in turn, and the test that caught it
tests/on_chain/smoke.mjs     a throwaway-account run against Studio
tools/mutate.py              the generator that writes MUTATIONS.md and refuses to if anything survives
docs/CONTRACTS.md            purpose, consensus, state, methods, reuse and limits
docs/DECISIONS.md            why each rule is the way it is, and what is verified and what is not
```

## Running it

```
pip install -r requirements-dev.txt
pytest tests/ -q                          # 114 tests, no network, no Studio
genvm-lint check contracts/deposit_back.py
python tools/mutate.py                    # rewrites tests/MUTATIONS.md; exits 1 if a mutant survives
```

On this repository as it stands: `pytest tests/ -q` gives **114 passed** in
under a second; `genvm-lint check` (genvm-linter 0.11.0) prints
`Lint passed (3 checks)` and reports 14 methods, 5 view and 9 write; and
`python tools/mutate.py` removes or inverts **161 defences** one at a time and
**none survives**.

The on-chain run uses three throwaway keys it generates itself (landlord,
tenant, stranger) and funds them from the Studio faucet. It never touches a
wallet of anybody's own. It saves every step to a state file, so a run that is
cut off continues where it stopped:

```
npm ci
node tests/on_chain/smoke.mjs                  # about forty minutes
RESUME=1 node tests/on_chain/smoke.mjs         # continue from the saved state
STATE=./smoke-state.json RESUME=1 node tests/on_chain/smoke.mjs
```

It tells the story above on four flats: F1 above the bakery, contested; F2 by
the canal, whose landlord never reports, reclaimed by a stranger; F3 on the
hill, whose tenant never answers, settled by a stranger; and F4 behind the
library, whose tenant accepts an oven clean and is then refused a contest. On
the way, a stranger is refused when filing F1's report, and a take with half
the deposit is refunded in the same transaction. It prints a PASS or FAIL line
for every check, the balances before and after every step that moves money,
`N passed, M failed`, and the contract address.

## The site

`web/` is the site: a Next.js 16 app (on Vercel its Root Directory is `web`).
It reads and signs through genlayer-js against Studio. With
`NEXT_PUBLIC_MOCK=1` it runs instead on an in-memory copy of the contract
(`web/lib/chain-mock.ts`: the same checks in the same order, the same refusal
sentences, the same money; only the verdicts are scripted), with no wallet and
no network.

| page | what it does |
|---|---|
| `/` | Deposit Back in one minute; the newest judged flat drawn as a floor plan with the network's word on each item (the worked example above until there is one); how the money splits; the ways in |
| `/flats` | every open offer as a "To let" card with its plan, deposit and items, the six sample flats first |
| `/flat/F12` | one lease: the floor plan beside every item's move-in and move-out notes; the tenancy line (offer, taken, notice, move-out report, answer, settled), which moves with the contract and the clock; and the next step for whoever is looking: take, give notice, file the report, accept, contest with a box per deduction, reclaim or settle. Every deduction shows the contract's own outcome and where its money went, a bar splits the deposit, and every transaction shows its explorer link while the validators vote |
| `/landlord` | offer a flat, one of the six samples or your own items (the plan is redrawn as you type), and file the move-out report on your own flats |
| `/mine` | the connected account's tenancies and flats, each with the step it waits for |
| `/ledger` | `stats()`: what is held, what went back to tenants and to landlords, the damage, wear and unclear words so far, and the flats that closed most recently |
| `/how` | how a contest is decided: the two askings, the combine table, the stored value, the money, the limits, and `rules()` read live |

**The demo landlord.** So that one visitor can try a whole tenancy alone, the
six sample flats in `web/lib/demo-flats.ts` are offered on chain by a demo
landlord, a throwaway Studio test key that only the site's server holds
(`DEMO_LANDLORD_KEY`). Each sample has a scripted move-out report with at least
one deduction that is plainly damage, one that is plainly wear, and one item
with no deduction. When a visitor gives notice on a sample flat, the flat page
says that the demo landlord files the report for them and calls
`POST /api/demo/report {"flat": "F12"}`. The server signs `report()` with that
sample's notes only when the flat is the demo landlord's copy of a sample, its
tenant has given notice and the report window is open; one attempt per flat
every two minutes, at most twelve a minute. The key is never logged or
returned. Without it the site still works and says the demo landlord is
offline; a tenant whose report never comes reclaims the whole deposit once the
window closes. `web/tools/offer-demo.mjs` offers the copies and only ever runs
by hand.

```
cd web
npm ci                                  # Node 22.18 or later
npm run dev:mock                        # http://localhost:3218, the in-memory contract, no wallet
npm run dev                             # against Studio: NEXT_PUBLIC_CONTRACT, or DEMO_CONTRACT in lib/config.ts
npm run typecheck && npm run lint
npm run test:site                       # 57 tests, no network: the rules, the samples, the plans, the
                                        # whole tenancy on the mock, seeded random journeys, and every
                                        # call and refusal checked against contracts/deposit_back.py
npm run build
REGISTER=0x... DEMO_LANDLORD_KEY=0x... COPIES=3 node tools/offer-demo.mjs   # offer copies of the samples
```

`web/.env.example` lists the four settings.

## Network

GenLayer Studio, chain 61999, RPC `https://studio.genlayer.com/api`, explorer
`https://explorer-studio.genlayer.com`. The contract pins the runner
`py-genlayer:1jb45aa8ynh2a9c9xn3b7qqh8sm5q93hwfp7jqmwsfhh8jpz09h6` in its first
line.

## Evidence

Run on 8 October 2026 on GenLayer Studio (chain 61999) by `tests/on_chain/smoke.mjs`, from three
generated accounts, one per role: **L** the landlord, **T** the tenant and **S** a stranger. **32 checks
passed, 0 failed**; the whole log is `tests/on_chain/smoke-run.log`.

Register [`0x4466DcbaDDdde74f1e1512f2a471F82828a3d189`](https://explorer-studio.genlayer.com/address/0x4466DcbaDDdde74f1e1512f2a471F82828a3d189).
`gen_getContractCode` on it returns `contracts/deposit_back.py` byte for byte (55,902 bytes, sha256
`e2f396c3291490e509c72a9c6bea1bec6fbd4edd4f73baaf346656ffe7a1a2e7`).

| call | by | transaction | result |
|---|---|---|---|
| deploy `contracts/deposit_back.py` | L | [0x3a795ac3…](https://explorer-studio.genlayer.com/tx/0x3a795ac34bd083720036d334ab45148fc71d92bec5205b8ea0b7339500d89242) | register `0x4466Dcba…d189`; `gen_getContractCode` returns the repository file byte for byte (sha256 `e2f396c3…`) |
| offer F1, the two-bedroom flat above the bakery: deposit 1 GEN, five items with their move-in notes | L | [0x1716646f…](https://explorer-studio.genlayer.com/tx/0x1716646ff5e463646a0a16c791205712755634e7b9b284facc78ded792b51fc8) | F1 to let |
| take F1 with half the deposit | S | [0x59c94f19…](https://explorer-studio.genlayer.com/tx/0x59c94f1949df2953fdfd99b5d2b54094c232b6cd42dbaf4989202637d10c1ef7) | refused, `ok: false`; the half came back in the same transaction |
| take F1 with exactly the deposit | T | [0x1b1c09de…](https://explorer-studio.genlayer.com/tx/0x1b1c09deb457ce9aed3d402acee8d6e1dd9060b64e0b7052e7b49acac9b464f5) | let: the move-in notes accepted as written, 1 GEN held |
| give notice on F1 | T | [0x85acf11f…](https://explorer-studio.genlayer.com/tx/0x85acf11f059ddd7ea5045aba5a12f2cf784f2c7e14be7381317a6c03da885a74) | the landlord's report window starts |
| a stranger files F1's move-out report | S | [0x956a9541…](https://explorer-studio.genlayer.com/tx/0x956a95415740c2b2d8ade169277a71acd9a681326f1c9a3019db1ad96c737415) | refused: only the landlord may |
| the landlord files F1's report: five move-out notes, four deductions, 0.9 GEN | L | [0xe3f83edb…](https://explorer-studio.genlayer.com/tx/0xe3f83edba1beb52c652bada3d12aeaf8cb979989ae56281d36763dcef80ab777) | the tenant's answer window starts |
| the tenant contests the wall, the worktop and the carpet; the mirror is left | T | [0xde5a218c…](https://explorer-studio.genlayer.com/tx/0xde5a218c0d6aef1a02317f7bc57f25d3f91a6de611c92bb868d3649321368b99) | one round, 3 agree and 2 idle: **`D1:wear,D2:damage,D3:wear`**. In the same transaction the tenant got the wall, the carpet and the rest back (0.55 GEN) and the landlord the burnt worktop and the uncontested mirror (0.45 GEN) |
| the tenant accepts F4's report: an oven clean, 0.1 GEN | T | [0xffbd1981…](https://explorer-studio.genlayer.com/tx/0xffbd1981b1b975de56d5c5bcbe13f533a92eccd428828f2b9fa14d94b7fcd6cd) | 0.1 GEN to the landlord, 0.4 GEN back |
| contest F4 after accepting it | T | [0xb597a968…](https://explorer-studio.genlayer.com/tx/0xb597a96850076a5ac5c390f36e5bc5cde9b84b18fd98d88bb446a18479442aae) | refused: only a filed report can be contested, once |
| F2's landlord never reported; after the window a stranger reclaims | S | [0x8a65480c…](https://explorer-studio.genlayer.com/tx/0x8a65480cebc5d3793694445ba834b0c97d8387c750518e937e276398435ac7e8) | **reclaimed**: the whole 0.5 GEN back to the tenant |
| F3's tenant never answered; after the window a stranger settles | S | [0xeb7c59c6…](https://explorer-studio.genlayer.com/tx/0xeb7c59c6347a8535d622d66d4a0e5cb7c2c206c27efc5f4056335a89aedcea18) | **settled** as filed: 0.2 GEN to the landlord, 0.3 GEN back |

At the end `stats()` read four flats: one judged, one accepted, one reclaimed and one settled, one refused
take and nothing held. The contract's own balance was zero, and every account ended where the money table
says: the landlord up 0.75 GEN, the tenant down 0.75 GEN, the stranger whole.

After the run the site's demo landlord, a separate throwaway key, offered copies of the six sample flats on
the same register, so a visitor can take one, give notice and contest the report it files.

## Licence

MIT. See `LICENSE`.
