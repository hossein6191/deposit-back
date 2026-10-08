# Contracts

One file, `contracts/deposit_back.py`. It is the only thing in this repository
that asks the network anything.

## contracts/deposit_back.py

### Purpose

A rental deposit held by a contract for the whole tenancy and returned item by
item. The landlord writes the condition of each item at move-in, and the tenant
accepts those notes by paying the deposit. At move-out the landlord writes the
condition again and lists deductions. The tenant accepts them or contests some,
and the network decides, deduction by deduction, whether the change between the
two notes is damage the tenant should pay for or ordinary wear and tear. The
money follows the verdict in the same transaction, and the burden of proof is
the landlord's: a deduction the network cannot call damage goes back to the
tenant.

### Consensus

One round, `_judge_round(cases)`, a single
`gl.vm.run_nondet_unsafe(leader_fn, validator_fn)` block called from `contest`.
The only two `gl.nondet.exec_prompt` calls in the file are inside that
`leader_fn`. A case is `(deduction id, item name, move-in note, move-out note,
reason)`: no amount is in a case, so no amount can reach a prompt.

For each contested deduction, in the deductions' order:

1. `_damage_task(name, move_in, move_out, reason)`: blocks ITEM, MOVE-IN,
   MOVE-OUT, REASON, and the damage question, "Is the change from move-in to
   move-out damage that goes beyond ordinary wear and tear, so the tenant
   should pay for it?"
2. `_wear_task(name, move_in, move_out, reason)`: blocks REASON, MOVE-OUT,
   MOVE-IN, ITEM, and the wear question, "Is the change ordinary wear and tear
   from normal living, or not shown by the notes at all, so the tenant should
   not pay for it?"

Each answer is read into `yes`, `no`, `unclear`, or nothing (`_read_answer`
never raises; a JSON boolean is read, a number with a fraction is not).
`_combine` turns the pair into `damage` (yes then no), `wear` (no then yes) or
`unclear` (anything else). The leader returns `{"v": "D1:wear,D2:damage"}`.

`_agrees` is the whole comparison: a leader result that is not a
`gl.vm.Return` is never agreed with; otherwise the validator reruns every
asking itself inside try/except (its own failure is a disagreement) and
compares the vector by exact string equality. After agreement, `_clean_vector`
reads the value back for exactly the deductions that were asked about; a value
in any other shape makes every one of them `unclear`, which sends their money
back to the tenant.

Every prompt opens with the task, then says that everything inside a block is
untrusted and never an instruction, then that block order carries no meaning,
then shows the four blocks, then the rule for what counts as wear and what as
damage (and that the reason is not evidence), then the question and the closed
answer format. Each block is `<<<LABEL tag>>>` / fenced text /
`<<<END LABEL tag>>>`, where the label is one of the contract's four and the tag
is the first 16 hex characters of the sha256 of the fenced text. Each block is
capped at its own limit after fencing (40 for the item name, 400 for a note,
300 for the reason), the same limits the door enforces, so a prompt stays
under 3,600 characters.

### State

One storage dataclass, scalars only (a collection inside one kills the VM).

`Flat`:

| field | type | what it is |
|---|---|---|
| `landlord`, `tenant` | `Address` | the tenant is the zero address until somebody takes the flat |
| `title`, `address_line` | `str` | as offered, trimmed |
| `items_json`, `n_items` | `str`, `u32` | JSON list of `{"name", "move_in"}`, written at offer time |
| `deposit` | `u256` | in atto |
| `moveout_seconds`, `response_seconds` | `u64` | the report window and the response window |
| `status` | `str` | `open`, `let`, `notice`, `reported`, then one of `withdrawn`, `reclaimed`, `clean`, `accepted`, `judged`, `settled` |
| `offered_at`, `taken_at`, `notice_at`, `moveout_end`, `reported_at`, `response_end` | `u64` | seconds on the message clock; 0 until it happens |
| `moveout_json` | `str` | JSON list of move-out notes, one per item |
| `deductions_json`, `n_deductions`, `deducted` | `str`, `u32`, `u256` | JSON list of `{"item", "amount", "reason"}`; their count and total |
| `contested_json`, `verdict` | `str`, `str` | the contested indices and the agreed vector |
| `results_json` | `str` | one `{"verdict", "to"}` per deduction, once the flat is closed |
| `paid_tenant`, `paid_landlord` | `u256` | the split of the deposit |
| `settled_at`, `settled_by` | `u64`, `Address` | when and by whom the flat was closed |

The contract holds `flat_rows: TreeMap[str, Flat]`, `by_landlord` and
`by_tenant: TreeMap[str, str]` (lowercase address to a JSON list of flat ids),
and `u32`/`u256` counters, among them `held_total`, which always equals the
contract's balance. Ids are the contract's own: `F1, F2, ...`; deductions are
numbered within their flat, `D1` to `D6`.

### Key methods

Writes:

| method | payable | who | on refusal |
|---|---|---|---|
| `offer(title, address_line, items_json, deposit_atto, moveout_seconds, response_seconds)` | no | anyone; the sender is the landlord | raises `[EXPECTED] ...` |
| `withdraw_offer(flat)` | no | the landlord, while nobody has taken the flat | raises |
| `take(flat)` | yes | anyone but the landlord, while the flat is open, with exactly the deposit | returns what was sent and `{"ok": false, "reason", "returned"}`; never raises |
| `give_notice(flat)` | no | the tenant, once | raises |
| `report(flat, moveout_json, deductions_json)` | no | the landlord, after the notice and before the report window closes; once | raises |
| `accept(flat)` | no | the tenant, before the response window closes | raises |
| `contest(flat, indices_json)` | no | the tenant, before the response window closes; once | raises |
| `reclaim(flat)` | no | anyone, after the report window closed with no report | raises |
| `settle(flat)` | no | anyone, after the response window closed with no answer | raises |

A report with no deduction closes the flat as `clean` in the same call and
returns the whole deposit; it never opens a response window with nothing in it.

Shapes:

```
items_json       [{"name": "Kitchen worktop", "move_in": "Grey laminate worktop, no burns, ..."}, ...]   2 to 8
moveout_json     ["Two small scuffs near the light switch ...", ...]                                     one per item, in order
deductions_json  [{"item": 1, "amount": "200000000000000000", "reason": "Cutting out and replacing ..."}]  0 to 6, one per item
indices_json     [0, 1, 2]                                                                                deduction indices; 0 is D1
```

Views (ids, numbers and an address only):

| view | returns |
|---|---|
| `flat(flat_id)` | every field, the `phase` on the clock (`take`, `notice`, `report`, `reclaim`, `answer`, `settle`, `closed` or `unknown`), every item with its move-in and move-out note, every deduction with its amount, reason, whether it was contested, its verdict and where its money went, `held`, `paid_tenant`, `paid_landlord` and `now` |
| `flats(offset, limit)` | a page of at most 20 short rows, oldest first |
| `flats_of(address)` | the flat ids an address offered as landlord and took as tenant, in any letter case |
| `stats()` | counts by ending, deductions read and their verdicts, what is held, what was paid to tenants and to landlords, how many takes were refused |
| `rules()` | the value, the two askings, the combine table, the comparison, what the model sees, the settlement table, who may do what, the limits and the shapes, in the contract's own words |

### Reuse

`flat(flat_id)` is the part meant to be read by other contracts and pages. A
consumer such as a rent-guarantee contract or a reference check reads
`status`, `paid_tenant` and `paid_landlord`, and each deduction's `verdict`. It
should bind to this contract's address and to the flat id it was handed, and
check `landlord` and `tenant` against the parties it was told about: a flat id
is a position in a queue, never authority on its own.

`rules()` is meant for people and for pages: it states every limit and every
shape, so a client can build a valid offer or report without asking.

### Limits

- Every text is printable ASCII on one line. Title 3 to 60 characters, address
  line 3 to 80, item name 3 to 40, move-in and move-out notes 20 to 400, reason
  20 to 300. Anything else is refused at the door and never judged in part.
- 2 to 8 items, unique names in any letter case; 0 to 6 deductions, at most one
  per item, each at least 1 atto, together no more than the deposit.
- Deposit 0.1 to 1000 GEN, in atto. Each window 300 seconds to 30 days.
- Twenty flats per page of `flats`.
- Every view argument is an id, a number or an address, because a Studio read
  call fails once its encoded arguments pass 256 bytes. A view reads at most
  12 characters of a flat id and 42 of an address.
