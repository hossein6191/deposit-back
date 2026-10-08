# Decisions

Why each rule of `contracts/deposit_back.py` is the way it is, and what is
verified and what is not.

## 1. What the network agrees on

**The stored value is a vector of closed words, one per contested deduction.**
`D1:wear,D2:damage,D3:wear`. Nothing the model wrote reaches storage:
`_read_answer` maps an answer onto `yes`, `no`, `unclear` or nothing, and
`_combine` writes the verdict. A score, a share of the amount or a sentence of
reasoning would be a value the validators could never compare exactly, and the
money moves on this word.

**The validator reruns the whole task and compares the whole vector.** Not a
sample of the deductions, not the shape of the leader's answer: every asking is
asked again and the string must be equal, letter for letter. A tolerance would
let one node store `damage` while another believed `unclear`, and those two
words send the same deduction to different people.

**A leader that raised is never agreed with.** A failure is not a verdict. The
round stores nothing, and `contest` can be sent again while the response window
is open; nothing was paid and nothing was recorded, so a retry rolls back
nothing anybody relied on. A round that reaches agreement is final, `unclear`
included: `contest` refuses a flat that is not `reported`.

**The validator's own failure is a disagreement.** Its rerun is inside
try/except. Without that, a node whose model could not be reached would raise
out of the comparison instead of voting.

**An answer the contract cannot read is `unclear`, not a failed round.** If
reading raised, a round could be thrown away and asked again until the answer
suited somebody. Unreadable answers land in the value instead, where a
validator that read a real answer disagrees with them.

## 2. Two orders, two framings, one block

The damage question is asked with the item and its notes before the
landlord's reason; the wear question with the reason first and the item last.
Both in one block, in sequence, for every contested deduction. A model that
leans towards yes, or towards no, answers both questions the same way, and the
pair (yes, yes) or (no, no) is `unclear`, never a verdict. A model that leans
on whatever it reads first sees the landlord's reason first in one asking and
the move-in note first in the other. That is where position and framing bias
land: in the stored value, as a word that returns the deduction to the tenant.

The orders are tied to the framings rather than crossed (four askings per
deduction) to keep the round at two askings per deduction, twelve at the most.
A bias that follows both the order and the framing at once could still agree
with itself; that is not ruled out here and is listed under what is not
verified.

**The second question is the inverse, not a paraphrase.** "Is it damage the
tenant should pay for" and "is it wear, or not shown at all, so the tenant
should not pay" need opposite answers for the same reading. A paraphrase would
let the same bias pass twice.

## 3. The burden of proof is the landlord's

**`unclear` goes back to the tenant.** The landlord is the one taking money
out of a deposit that belongs to the tenant, and the landlord wrote every word
the network reads. If those words do not let the validators agree that a
change is damage, the deduction is not proved.

**The reason is not evidence.** The prompt says so before the question: the
reason is the landlord's claim, and a change the move-out note does not
describe counts for nothing, however the reason describes it. Otherwise a
landlord could write a neutral move-out note and a damning reason.

**The move-in notes are fixed before the tenant pays.** They are written at
`offer` and the tenant accepts them by taking the flat. A landlord cannot
improve the starting condition afterwards to make a change look larger.

**The tenant writes nothing.** The design keeps the tenant's part to a choice
of which deductions to contest. Every word judged is the landlord's, signed by
the landlord's address and public for good, so a false move-out note is a
public record against that address. This is the largest limit of the contract
and the README states it first.

## 4. The model never sees an amount

A case carries the item's name, its two notes and the reason; the deduction id
is used only to build the vector and the amount never enters a case. The
question is whether the tenant should pay for a change at all. An amount in
the prompt would invite the model to judge the price, and a large number next
to a small scuff would push honest validators to different answers about
different questions. The cost of this rule is stated in the README: an
inflated price for real damage stands.

## 5. The prompt is where trust changes hands

All four texts are untrusted, and all four were written by the landlord with
money at stake. Every one is fenced with
`str(raw).replace("<", "(").replace(">", ")")` (replace, never delete, so a
length cap still holds after fencing), capped at its own limit, placed between
delimiter lines carrying the first 16 hex characters of its own sha256, and
declared untrusted before the first block. The tag depends on every byte of
the text, so a text cannot carry its own closing line. The label on a delimiter
line is one of the contract's four constants, and anything else prints as
`BLOCK`. A static test fails if a value reaches a prompt without being fenced
or a contract constant.

**Printable ASCII on one line, at the door.** Every text is refused at `offer`
or `report` if it has a line break, a control character or anything outside
ASCII. That keeps the fence complete: no look-alike angle bracket and no line
of its own can reach the prompt. Angle brackets themselves are allowed and
fenced at the prompt boundary, so storage keeps what was written.

**Nothing is sampled.** A text over its limit is refused, so every character of
everything judged is inside the prompt that judged it. The cap inside `_block`
never bites on stored text; it bounds the prompt even if a later change
forgets the door.

## 6. Who may write

Every write is bound to an address, and the exceptions are listed in the test
suite with their reasons:

- `offer` is open: the sender becomes the landlord, the offer takes no value,
  and it binds nobody until a tenant chooses to take it.
- `reclaim` is open: after the report window closed with no report, the whole
  deposit goes to the tenant recorded on the flat, whoever calls. A tenant must
  never depend on the landlord to be repaid.
- `settle` is open: after the response window closed with no answer, the money
  follows the report as filed, whoever calls. A landlord must never depend on
  the tenant to be paid.

Every other write compares the sender with the landlord or the tenant stored on
the flat, in lowercase, because an address is twenty bytes and not a
case-sensitive string. A static test reads each write's parsed source and fails
on a write that refuses nobody and is not listed, and on a listed write that
has grown a gate.

## 7. Nobody's money waits on silence, and every refusal leaves a way on

| the party who does not act | what the other side does |
|---|---|
| the landlord never files the report | anyone calls `reclaim` once the report window closes: the whole deposit to the tenant |
| the tenant never answers the report | anyone calls `settle` once the response window closes: the report stands as filed |
| the validators do not agree on a contest | nothing is stored; `contest` is sent again, or `settle` applies once the window closes |
| nobody takes the offer | the landlord calls `withdraw_offer` |

Each refusal is tested as a journey to its end: a take with the wrong deposit
is refunded and taken again with the right one; a report refused for a bad
deduction is corrected and filed inside the window; an acceptance after the
window is refused and `settle` closes the flat; a landlord too late to report
leaves the tenant a `reclaim`.

**A tenant who never gives notice keeps their own deposit held.** There is no
route for the landlord to start the move-out. Letting the landlord give notice
would let a landlord open the report window while the tenant still lives there
and file a move-out report on a flat nobody has left. The contract never held
anything of the landlord's, so nothing of theirs is stuck.

**A report with no deduction closes at once.** The design gives the tenant a
response window after every report. With nothing deducted there is nothing to
answer, so the whole deposit goes back in the same call and the flat is
`clean`. This is the one place the contract adds to the design, and it only
shortens a wait whose outcome was already fixed.

## 8. The money

**One exit.** Every ending goes through `_close`, which writes the status, the
results and the split, then moves the money: what the results send to the
landlord, and the rest of the deposit to the tenant, computed as
`deposit - to_landlord`, so a flat can never pay out more or less than it
holds. The only other transfer in the file is the refund of a refused take.

**The payable write never raises after taking value.** `take` checks the
argument's type before anything reads it, reads the clock without raising when
it is missing, and on every refusal, a missing clock included, returns what was
sent and answers `{"ok": false, "reason", "returned"}`. A raise there would
strand the value.

**The state is written before the money moves.** A test records the flat's
status at the moment of each transfer and finds it already closed.

**Conservation is checked, not assumed.** Sixty seeded random journeys call
every write in random order, often with the wrong caller, the wrong amount or
the wrong state. After every step: the contract holds exactly the deposits of
the flats it still holds, every closed flat paid out its whole deposit, what
was paid to tenants and landlords adds up to what left, and a write that
raised changed nothing at all. Every journey ends with nothing held, and the
walk reaches every ending.

## 9. Storage, ids and views

`Flat` holds scalars only; the items, notes, deductions and results are JSON
strings, because a collection inside a storage dataclass kills the VM. Every
JSON read goes through one `_loads` that refuses a fraction, an exponent, NaN
and Infinity before a float is built, because a float traps the VM in
deterministic mode and a trap is not an exception anybody can catch. Every
non-string argument is checked with `isinstance` or read by `_number_arg`,
which takes an int or a string of digits and refuses a bool.

Ids are the contract's own, `F1`, `F2`, and deductions are `D1` to `D6` within
their flat, so nobody can claim a name first. Views take a short id, a number
or an address, because a Studio read call fails once its encoded arguments pass
256 bytes; `flats` returns short rows so a page of twenty stays small.

## 10. The clock

There is no block timestamp. The only clock every node agrees on is the
message's own `gl.message_raw["datetime"]`, read with a hand-made integer
calendar because `datetime` and floats trap the VM. A write that takes no value
refuses when the clock is missing or unreadable; it never guesses. `take`
refunds instead. Views report `now` and a `phase` of `unknown` without a clock.

Every window is measured in whole seconds from the moment that opened it: the
report window from the notice, the response window from the report. The
closing second belongs to the next party: at `moveout_end` the landlord may no
longer report and anyone may reclaim.

## 11. What is verified and what is not

Verified offline (`pytest tests/ -q`, 114 tests, no network): every rule and
refusal; every refund; every journey (accept, contest all, contest some,
reclaim, settle, withdraw, a clean report); the combine table in all sixteen
cells; the consensus closures run against scripted models, with the leader and
each validator in a world of its own, including a validator outvoted, a leader
that raised and a validator whose own rerun fails; the static rules (open
writes listed, fenced prompt values, the model called only inside the leader
closure, one block, no float, scalar storage); and the seeded random journeys.
`tools/mutate.py` removes or inverts 161 defences one at a time and the suite
catches every one; `tests/MUTATIONS.md` names the test that caught each.

Not verified:

- What a live model answers on notes other than the demonstration's. On chain (8 October 2026,
  register `0x4466DcbaDDdde74f1e1512f2a471F82828a3d189`, 32 checks passed and 0 failed,
  `tests/on_chain/smoke-run.log`) the validators read the scuffed wall and the flattened carpet as
  `wear` and the burnt worktop as `damage`, in one round with 3 agreeing and 2 idle, and the deployed
  bytes equal this file.
- A bias that follows both the presentation order and the framing at once.
- Whether the general wear-and-tear rule matches the law of any particular
  place. It is not meant to.
