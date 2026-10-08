"""Remove each defence of Deposit Back in turn, and record the test that killed it.

    python tools/mutate.py                 # writes tests/MUTATIONS.md; exit 1 if any mutant survives
    python tools/mutate.py --jobs 8        # run eight mutants at a time (default: the number of CPUs)
    python tools/mutate.py --only fence    # run only the mutants whose name contains "fence"; writes nothing

A passing count is a claim; this table is the evidence. Each mutant is written
to its own file (never over the source) and the suite runs against it with
bytecode caching off, so a stale .pyc can never attribute a kill to the wrong
code. The harness refuses to run over a failing baseline, refuses an anchor
that is not found exactly once, and treats a mutant that does not even import
as a broken anchor, never as a kill. A mutation is (name, before, after), or
(name, [(before, after), ...]) when moving a defence takes two edits.
"""
import argparse
import concurrent.futures
import os
import pathlib
import re
import subprocess
import sys
import tempfile

ROOT = pathlib.Path(__file__).resolve().parents[1]
SRC = (ROOT / "contracts" / "deposit_back.py").read_text(encoding="utf-8")
PYTEST = [sys.executable, "-m", "pytest", "-q", "-x", "--no-header", "-p", "no:cacheprovider",
          str(ROOT / "tests" / "test_pure.py")]

WRITE_OUT = '            _fail("the response window of " + flat_id + " closed; settle(" + flat_id + ") closes it as filed")\n'

# against contracts/deposit_back.py
MUTATIONS = [
    # --- the prompt boundary
    ("the fence does nothing",
     'return str(raw).replace("<", "(").replace(">", ")")', 'return str(raw)'),
    ("the fence deletes instead of replacing",
     'return str(raw).replace("<", "(").replace(">", ")")', 'return str(raw).replace("<", "").replace(">", "")'),
    ("the fence only replaces the opening bracket",
     'return str(raw).replace("<", "(").replace(">", ")")', 'return str(raw).replace("<", "(")'),
    ("the delimiters carry a fixed tag", 'return _sha256(body)[:TAG_CHARS]', 'return "0" * TAG_CHARS'),
    ("a closing line carries another tag",
     '"\\n<<<END " + name + " " + tag + ">>>"', '"\\n<<<END " + name + " " + tag[:8] + ">>>"'),
    ("any label reaches a delimiter line",
     'name = label if label in LABELS else LABEL_FALLBACK', 'name = label'),
    ("a block is not capped", 'body = _fence(text)[:_cap(name)]', 'body = _fence(text)'),
    ("a block is capped but not fenced", 'body = _fence(text)[:_cap(name)]', 'body = str(text)[:_cap(name)]'),
    ("the item name is capped like a note",
     'if name == LABEL_ITEM:\n        return MAX_NAME', 'if name == LABEL_ITEM:\n        return MAX_NOTE'),
    ("the reason is capped like a note",
     'if name == LABEL_REASON:\n        return MAX_REASON', 'if name == LABEL_REASON:\n        return MAX_NOTE'),
    ("the second order is the first order", 'SECOND_ORDER = [4, 3, 2, 1]', 'SECOND_ORDER = [1, 2, 3, 4]'),
    ("the first order puts the reason first", 'FIRST_ORDER = [1, 2, 3, 4]', 'FIRST_ORDER = [4, 1, 2, 3]'),
    ("the wear asking asks the damage question",
     '_task(name, move_in, move_out, reason, SECOND_ORDER, QUESTION_WEAR)',
     '_task(name, move_in, move_out, reason, SECOND_ORDER, QUESTION_DAMAGE)'),
    ("the damage asking asks the wear question",
     '_task(name, move_in, move_out, reason, FIRST_ORDER, QUESTION_DAMAGE)',
     '_task(name, move_in, move_out, reason, FIRST_ORDER, QUESTION_WEAR)'),
    ("the prompt never says the blocks are untrusted",
     'TASK_HEADER + "\\n\\n" + UNTRUSTED + "\\n\\n" + EITHER_ORDER', 'TASK_HEADER + "\\n\\n" + EITHER_ORDER'),
    ("the untrusted warning comes after the blocks",
     [('TASK_HEADER + "\\n\\n" + UNTRUSTED + "\\n\\n" + EITHER_ORDER', 'TASK_HEADER + "\\n\\n" + EITHER_ORDER'),
      ('+ WEAR_RULE + "\\n\\n" + question', '+ UNTRUSTED + "\\n\\n" + WEAR_RULE + "\\n\\n" + question')]),
    ("the wear rule is left out", '+ WEAR_RULE + "\\n\\n" + question', '+ question'),
    ("the reason counts as evidence", "The REASON is the landlord's own claim and is not evidence",
     "The REASON is the landlord's own claim and is evidence"),
    ("the move-out block carries the reason", '(LABEL_MOVE_OUT, move_out)', '(LABEL_MOVE_OUT, reason)'),
    ("the move-in block carries the move-out note", '(LABEL_MOVE_IN, move_in)', '(LABEL_MOVE_IN, move_out)'),

    # --- reading the model
    ("maybe reads as yes", 'YES_WORDS = ("yes", "y", "true")', 'YES_WORDS = ("yes", "y", "true", "maybe")'),
    ("a JSON false is not read", 'NO_WORDS = ("no", "n", "false")', 'NO_WORDS = ("no", "n")'),
    ("an unreadable answer reads as yes",
     '    if word == UNCLEAR:\n        return UNCLEAR\n    return ""', '    if word == UNCLEAR:\n        return UNCLEAR\n    return YES'),
    ("an answer sent as text is never parsed",
     '    if isinstance(table, str):\n        try:\n            table = _loads(table)',
     '    if False:\n        try:\n            table = _loads(table)'),
    ("an answer is read without trimming",
     """.strip().strip(".").strip('"').strip("'").strip().lower()""", ".lower()"),
    ("an answer that is not JSON raises",
     '        except Exception:\n            table = {}', '        except Exception:\n            raise'),

    # --- combining the two framings
    ("damage on the damage framing alone",
     'if damage_answer == YES and wear_answer == NO:', 'if damage_answer == YES:'),
    ("wear on the wear framing alone",
     'if damage_answer == NO and wear_answer == YES:', 'if wear_answer == YES:'),
    ("a split reads as wear", '    return SPLIT\n\n\ndef _deduction_id', '    return WEAR\n\n\ndef _deduction_id'),
    ("the two verdicts are swapped",
     '        return DAMAGE\n    if damage_answer == NO', '        return WEAR\n    if damage_answer == NO'),
    ("the leader combines the answers in the wrong order",
     'parts.append((did, _combine(damage, wear)))', 'parts.append((did, _combine(wear, damage)))'),

    # --- the vector
    ("the vector is joined with spaces", 'return ",".join(did + ":" + verdict', 'return ", ".join(did + ":" + verdict'),
    ("a vector in another order is read back",
     'if did != ids[k] or verdict not in VERDICTS:', 'if verdict not in VERDICTS:'),
    ("a vector with another word is read back",
     'if did != ids[k] or verdict not in VERDICTS:', 'if did != ids[k]:'),
    ("a vector of the wrong length is read back as it is",
     '    if len(out) != len(ids):\n        out = {did: SPLIT for did in ids}', '    if False:\n        out = {did: SPLIT for did in ids}'),
    ("a malformed vector pays the landlord", 'out = {did: SPLIT for did in ids}', 'out = {did: DAMAGE for did in ids}'),
    ("an agreed value that is not an object is read as damage",
     'if isinstance(agreed, dict) else "", [c[0] for c in cases])',
     'if isinstance(agreed, dict) else "D1:damage", [c[0] for c in cases])'),

    # --- the validator
    ("the validator agrees with a leader that raised",
     '    if not isinstance(leaders_res, gl.vm.Return):\n        return False',
     '    if not isinstance(leaders_res, gl.vm.Return):\n        return True'),
    ("the validator agrees with a leader value that is not an object",
     '    if not isinstance(theirs, dict):\n        return False', '    if not isinstance(theirs, dict):\n        return True'),
    ("the validator agrees when its own rerun fails",
     '    except Exception:\n        return False\n    return str(theirs', '    except Exception:\n        return True\n    return str(theirs'),
    ("the validator agrees with anything",
     'return str(theirs.get("v", "")) == str(mine["v"])', 'return True'),
    ("the validator ignores case",
     'return str(theirs.get("v", "")) == str(mine["v"])', 'return str(theirs.get("v", "")).lower() == str(mine["v"]).lower()'),
    ("the validator accepts a prefix",
     'return str(theirs.get("v", "")) == str(mine["v"])', 'return str(mine["v"]).startswith(str(theirs.get("v", "")))'),
    ("the validator copies the leader instead of running itself", 'mine = leader_fn()', 'mine = theirs'),
    ("the leader asks the damage question twice",
     'wear = _read_answer(gl.nondet.exec_prompt(_wear_task(', 'wear = _read_answer(gl.nondet.exec_prompt(_damage_task('),
    ("the leader never asks the wear question",
     'wear = _read_answer(gl.nondet.exec_prompt(_wear_task(name, move_in, move_out, reason),\n                                                          response_format="json"))',
     'wear = NO'),

    # --- the contest
    ("damage goes back to the tenant",
     '"to": TO_LANDLORD if verdict == DAMAGE else TO_TENANT', '"to": TO_TENANT if verdict == DAMAGE else TO_LANDLORD'),
    ("unclear goes to the landlord",
     '"to": TO_LANDLORD if verdict == DAMAGE else TO_TENANT', '"to": TO_TENANT if verdict == WEAR else TO_LANDLORD'),
    ("an uncontested deduction goes back to the tenant",
     'results.append({"verdict": UNCONTESTED, "to": TO_LANDLORD})', 'results.append({"verdict": UNCONTESTED, "to": TO_TENANT})'),
    ("the contested deductions are asked about in the order given", 'return sorted(picked), ""', 'return picked, ""'),
    ("a deduction is read with the notes of the item at its own position",
     'item = int(deductions[k]["item"])', 'item = k'),
    ("a deduction is read with another item's move-out note", 'str(notes[item])', 'str(notes[k])'),
    ("the vector is not stored", 'flat.verdict = vector', 'flat.verdict = ""'),
    ("the contested deductions are not stored", 'flat.contested_json = json.dumps(picked)', 'flat.contested_json = "[]"'),
    ("damage is not counted", 'self.n_damage = u32(int(self.n_damage) + 1)', 'self.n_damage = u32(int(self.n_damage) + 0)'),
    ("wear is not counted", 'self.n_wear = u32(int(self.n_wear) + 1)', 'self.n_wear = u32(int(self.n_wear) + 0)'),
    ("unclear is not counted", 'self.n_unclear = u32(int(self.n_unclear) + 1)', 'self.n_unclear = u32(int(self.n_unclear) + 0)'),
    ("contested deductions are not counted",
     'self.n_contested = u32(int(self.n_contested) + len(picked))', 'self.n_contested = u32(int(self.n_contested))'),
    ("anyone contests",
     '        if _low(gl.message.sender_address) != _low(flat.tenant):\n            _fail("only the tenant of " + flat_id + " may contest its report")',
     '        if False:\n            _fail("only the tenant of " + flat_id + " may contest its report")'),
    ("a report is contested twice, or after it was accepted",
     '        if str(flat.status) != STATUS_REPORTED:\n            _fail(flat_id + " is " + str(flat.status) + "; only a filed report can be contested, once")',
     '        if False:\n            _fail(flat_id + " is " + str(flat.status) + "; only a filed report can be contested, once")'),
    ("a contest is taken after the response window",
     '        if now >= int(flat.response_end):\n' + WRITE_OUT + '        picked, problem',
     '        if now > int(flat.response_end):\n' + WRITE_OUT + '        picked, problem'),
    ("a contest is taken with no clock",
     '        now = _clock()\n        if now >= int(flat.response_end):\n' + WRITE_OUT + '        picked, problem',
     '        now = max(_now(), 0)\n        if now >= int(flat.response_end):\n' + WRITE_OUT + '        picked, problem'),
    ("an empty contest is taken", 'if not isinstance(parsed, list) or len(parsed) < 1 or len(parsed) > count:',
     'if not isinstance(parsed, list) or len(parsed) > count:'),
    ("a deduction is contested twice in one list",
     'index >= count or index in picked:', 'index >= count:'),
    ("a JSON true is a deduction index",
     'if isinstance(index, bool) or not isinstance(index, int) or index < 0', 'if not isinstance(index, int) or index < 0'),
    ("a contested index past the last deduction is taken",
     'or index < 0 or index >= count or index in picked:', 'or index < 0 or index > count or index in picked:'),

    # --- closing a flat and moving the money
    ("every deduction goes to the landlord whatever happened", 'if results[k]["to"] == TO_LANDLORD:', 'if True:'),
    ("the tenant is paid the whole deposit as well", 'to_tenant = deposit - to_landlord', 'to_tenant = deposit'),
    ("a closed flat is still held", 'self.held_total = u256(int(self.held_total) - deposit)',
     'self.held_total = u256(int(self.held_total) - 0)'),
    ("what tenants were paid is not added up", 'self.paid_to_tenants = u256(int(self.paid_to_tenants) + to_tenant)',
     'self.paid_to_tenants = u256(int(self.paid_to_tenants))'),
    ("what landlords were paid is not added up",
     'self.paid_to_landlords = u256(int(self.paid_to_landlords) + to_landlord)',
     'self.paid_to_landlords = u256(int(self.paid_to_landlords))'),
    ("the tenant's share is sent to the landlord",
     '_Payee(flat.tenant).emit_transfer(value=u256(to_tenant))', '_Payee(flat.landlord).emit_transfer(value=u256(to_tenant))'),
    ("the landlord's share is sent to the tenant",
     '_Payee(flat.landlord).emit_transfer(value=u256(to_landlord))', '_Payee(flat.tenant).emit_transfer(value=u256(to_landlord))'),
    ("the money moves before the flat is closed",
     [('        flat.status = status\n        flat.results_json = json.dumps(results)', '        flat.results_json = json.dumps(results)'),
      ('        return to_tenant, to_landlord', '        flat.status = status\n        return to_tenant, to_landlord')]),
    ("where each deduction went is not stored", 'flat.results_json = json.dumps(results)', 'flat.results_json = "[]"'),
    ("who closed the flat is not recorded",
     '        flat.settled_by = gl.message.sender_address\n        self.held_total', '        flat.settled_by = flat.tenant\n        self.held_total'),
    ("a reclaim is not counted", 'self.n_reclaimed = u32(int(self.n_reclaimed) + 1)', 'self.n_reclaimed = u32(int(self.n_reclaimed))'),
    ("a clean report is not counted", 'self.n_clean = u32(int(self.n_clean) + 1)', 'self.n_clean = u32(int(self.n_clean))'),
    ("an acceptance is not counted", 'self.n_accepted = u32(int(self.n_accepted) + 1)', 'self.n_accepted = u32(int(self.n_accepted))'),
    ("a judgment is not counted", 'self.n_judged = u32(int(self.n_judged) + 1)', 'self.n_judged = u32(int(self.n_judged))'),
    ("a settlement is not counted", 'self.n_settled = u32(int(self.n_settled) + 1)', 'self.n_settled = u32(int(self.n_settled))'),
    ("an accepted deduction goes back to the tenant",
     '[{"verdict": ACCEPTED, "to": TO_LANDLORD}', '[{"verdict": ACCEPTED, "to": TO_TENANT}'),
    ("an unanswered deduction goes back to the tenant",
     '[{"verdict": UNANSWERED, "to": TO_LANDLORD}', '[{"verdict": UNANSWERED, "to": TO_TENANT}'),

    # --- taking a flat
    ("a take with too much is kept", 'elif value != int(flat.deposit):', 'elif value < int(flat.deposit):'),
    ("the landlord takes their own flat", 'if who == _low(flat.landlord):', 'if False:'),
    ("the landlord is compared in one letter case", 'if who == _low(flat.landlord):', 'if sender == flat.landlord:'),
    ("a flat is taken twice",
     '            elif str(flat.status) != STATUS_OPEN:\n                problem = flat_id + " is "',
     '            elif False:\n                problem = flat_id + " is "'),
    ("a take goes through with no clock",
     '            elif now < 0:\n                problem = "no readable clock', '            elif False:\n                problem = "no readable clock'),
    ("a refused take keeps the money",
     '        if value > 0:\n            _Payee(sender).emit_transfer(value=u256(value))', '        if False:\n            _Payee(sender).emit_transfer(value=u256(value))'),
    ("a refused take returns half", '_Payee(sender).emit_transfer(value=u256(value))', '_Payee(sender).emit_transfer(value=u256(value // 2))'),
    ("a take is not held", 'self.held_total = u256(int(self.held_total) + value)', 'self.held_total = u256(int(self.held_total))'),
    ("the tenant is not recorded", 'flat.tenant = sender', 'flat.tenant = flat.landlord'),
    ("a refused take is not counted", 'self.refused_takes = u32(int(self.refused_takes) + 1)', 'self.refused_takes = u32(int(self.refused_takes))'),
    ("a take is not counted", 'self.n_taken = u32(int(self.n_taken) + 1)', 'self.n_taken = u32(int(self.n_taken))'),
    ("a take with a flat id that is not a string is read anyway",
     '        if not isinstance(flat_id, str):\n            problem = "the flat id is a string"',
     '        if False:\n            problem = "the flat id is a string"'),
    ("the tenant's flats are not indexed", 'self._index(self.by_tenant, who, flat_id)', 'pass'),

    # --- notice
    ("anyone gives notice",
     '        if _low(gl.message.sender_address) != _low(flat.tenant):\n            _fail("only the tenant of " + flat_id + " may give notice")',
     '        if False:\n            _fail("only the tenant of " + flat_id + " may give notice")'),
    ("notice is given twice", 'if str(flat.status) != STATUS_LET:', 'if str(flat.status) not in (STATUS_LET, STATUS_NOTICE):'),
    ("the report window is measured with the response window",
     'flat.moveout_end = u64(now + int(flat.moveout_seconds))', 'flat.moveout_end = u64(now + int(flat.response_seconds))'),

    # --- the report
    ("anyone files the report",
     '        if _low(gl.message.sender_address) != _low(flat.landlord):\n            _fail("only the landlord of " + flat_id + " may file its move-out report")',
     '        if False:\n            _fail("only the landlord of " + flat_id + " may file its move-out report")'),
    ("a report is filed before notice", 'if str(flat.status) != STATUS_NOTICE:\n            _fail(flat_id + " is " + str(flat.status) + "; a report',
     'if str(flat.status) not in (STATUS_NOTICE, STATUS_LET):\n            _fail(flat_id + " is " + str(flat.status) + "; a report'),
    ("a report is taken at the closing second", 'if now >= int(flat.moveout_end):', 'if now > int(flat.moveout_end):'),
    ("more move-out notes than items are taken", 'if not isinstance(parsed, list) or len(parsed) != count:',
     'if not isinstance(parsed, list) or len(parsed) < count:'),
    ("a move-out note skips the door",
     'problem = _text_problem(note, MIN_NOTE, MAX_NOTE, "the move-out note of item " + str(k))', 'problem = ""'),
    ("a seventh deduction is taken", 'len(parsed) > MAX_DEDUCTIONS:', 'len(parsed) > MAX_DEDUCTIONS + 1:'),
    ("a deduction may name an item past the last",
     'item < 0 or item >= count:', 'item < 0 or item > count:'),
    ("a JSON true is an item index",
     'if isinstance(item, bool) or not isinstance(item, int) or item < 0', 'if not isinstance(item, int) or item < 0'),
    ("an item may carry two deductions", '        if item in used:', '        if False:'),
    ("a deduction of nothing is taken", 'if amount < 1:', 'if amount < 0:'),
    ("a reason skips the door",
     'problem = _text_problem(reason, MIN_REASON, MAX_REASON, "the reason of deduction " + str(k))', 'problem = ""'),
    ("deductions may exceed the deposit", 'if total > deposit:', 'if total > deposit + 1:'),
    ("a deduction may carry extra keys", 'sorted(entry.keys()) != ["amount", "item", "reason"]',
     'not all(key in entry for key in ("amount", "item", "reason"))'),
    ("a report with no deduction waits for an answer",
     '        if not deductions:\n            paid_tenant, paid_landlord = self._close(flat, STATUS_CLEAN, [], now)',
     '        if False:\n            paid_tenant, paid_landlord = self._close(flat, STATUS_CLEAN, [], now)'),
    ("the response window is measured with the report window",
     'flat.response_end = u64(now + int(flat.response_seconds))', 'flat.response_end = u64(now + int(flat.moveout_seconds))'),

    # --- offering
    ("one item is enough", 'len(parsed) < MIN_ITEMS or', 'len(parsed) < 1 or'),
    ("a ninth item is taken", 'len(parsed) > MAX_ITEMS:', 'len(parsed) > MAX_ITEMS + 1:'),
    ("an item name skips the door",
     'problem = _text_problem(name, MIN_NAME, MAX_NAME, "the name of item " + str(k))', 'problem = ""'),
    ("a move-in note skips the door",
     'problem = _text_problem(note, MIN_NOTE, MAX_NOTE, "the move-in note of item " + str(k))', 'problem = ""'),
    ("two items may share a name in another letter case", 'if name.lower() in names:', 'if name in names:'),
    ("an item may carry extra keys", 'sorted(entry.keys()) != ["move_in", "name"]',
     '"name" not in entry or "move_in" not in entry'),
    ("a title skips the door", 'problem = _text_problem(title, MIN_TITLE, MAX_TITLE, "the title")', 'problem = ""'),
    ("an address line skips the door",
     'problem = _text_problem(address_line, MIN_ADDRESS, MAX_ADDRESS, "the address line")', 'problem = ""'),
    ("a deposit below the floor is taken", 'if deposit < MIN_DEPOSIT or deposit > MAX_DEPOSIT:',
     'if deposit < 0 or deposit > MAX_DEPOSIT:'),
    ("a deposit above the ceiling is taken", 'if deposit < MIN_DEPOSIT or deposit > MAX_DEPOSIT:',
     'if deposit < MIN_DEPOSIT:'),
    ("a report window under five minutes is taken", 'if not (MIN_WINDOW <= moveout_s <= MAX_WINDOW):',
     'if not (0 <= moveout_s <= MAX_WINDOW):'),
    ("a response window over thirty days is taken", 'if not (MIN_WINDOW <= response_s <= MAX_WINDOW):',
     'if not (MIN_WINDOW <= response_s):'),
    ("an offer goes through with no clock",
     '        now = _clock()\n        sender = gl.message.sender_address', '        now = max(_now(), 0)\n        sender = gl.message.sender_address'),
    ("an offer reads arguments that are not strings",
     'if not isinstance(title, str) or not isinstance(address_line, str) or not isinstance(items_json, str):',
     'if not isinstance(title, str):'),
    ("the landlord's flats are indexed in the caller's letter case",
     'self._index(self.by_landlord, _low(sender), flat_id)', 'self._index(self.by_landlord, _hex(sender), flat_id)'),

    # --- the door every text passes
    ("a line break passes the door", 'if ord(ch) < 32 or ord(ch) > 126:', 'if ord(ch) > 126:'),
    ("non-ASCII passes the door", 'if ord(ch) < 32 or ord(ch) > 126:', 'if ord(ch) < 32:'),
    ("a text below its floor passes the door", 'if len(text) < least or len(text) > most:', 'if len(text) > most:'),
    ("a text above its cap passes the door", 'if len(text) < least or len(text) > most:', 'if len(text) < least:'),

    # --- withdrawing, reclaiming, accepting, settling
    ("anyone withdraws an offer",
     '        if _low(gl.message.sender_address) != _low(flat.landlord):\n            _fail("only the landlord of " + flat_id + " may withdraw its offer")',
     '        if False:\n            _fail("only the landlord of " + flat_id + " may withdraw its offer")'),
    ("a let flat is withdrawn",
     '        if str(flat.status) != STATUS_OPEN:\n            _fail(flat_id + " is " + str(flat.status) + "; only an offer nobody',
     '        if False:\n            _fail(flat_id + " is " + str(flat.status) + "; only an offer nobody'),
    ("a withdrawal is not counted", 'self.n_withdrawn = u32(int(self.n_withdrawn) + 1)', 'self.n_withdrawn = u32(int(self.n_withdrawn))'),
    ("a reclaim comes a second early", 'if now < int(flat.moveout_end):', 'if now < int(flat.moveout_end) - 1:'),
    ("a filed report is reclaimed", 'if str(flat.status) != STATUS_NOTICE:\n            _fail(flat_id + " is " + str(flat.status) + "; only a flat waiting',
     'if str(flat.status) not in (STATUS_NOTICE, STATUS_REPORTED):\n            _fail(flat_id + " is " + str(flat.status) + "; only a flat waiting'),
    ("anyone accepts",
     '        if _low(gl.message.sender_address) != _low(flat.tenant):\n            _fail("only the tenant of " + flat_id + " may accept its report")',
     '        if False:\n            _fail("only the tenant of " + flat_id + " may accept its report")'),
    ("a report is accepted in any state",
     '        if str(flat.status) != STATUS_REPORTED:\n            _fail(flat_id + " is " + str(flat.status) + "; only a filed report can be accepted")',
     '        if False:\n            _fail(flat_id + " is " + str(flat.status) + "; only a filed report can be accepted")'),
    ("an acceptance is taken after the response window",
     '        if now >= int(flat.response_end):\n' + WRITE_OUT + '        results = [{"verdict": ACCEPTED',
     '        if now > int(flat.response_end):\n' + WRITE_OUT + '        results = [{"verdict": ACCEPTED'),
    ("a settlement comes a second early", 'if now < int(flat.response_end):', 'if now < int(flat.response_end) - 1:'),
    ("an answered report is settled as well",
     '        if str(flat.status) != STATUS_REPORTED:\n            _fail(flat_id + " is " + str(flat.status) + "; only a report nobody answered can be settled")',
     '        if False:\n            _fail(flat_id + " is " + str(flat.status) + "; only a report nobody answered can be settled")'),

    # --- the clock and the numbers
    ("a missing clock reads as the epoch", 'return _instant_seconds(str(value)) if value else -1',
     'return _instant_seconds(str(value)) if value else 0'),
    ("a missing clock is not refused", '    if now < 0:\n        _fail("no readable clock', '    if False:\n        _fail("no readable clock'),
    ("the calendar lets a month run to 31", 'if not (1 <= d <= month_days):', 'if not (1 <= d <= 31):'),
    ("every fourth year is a leap year", 'leap = (y % 4 == 0 and y % 100 != 0) or y % 400 == 0', 'leap = y % 4 == 0'),
    ("the calendar takes hour 24", '0 <= hour < 24', '0 <= hour <= 24'),
    ("caller JSON may build a float",
     'return json.loads(text, parse_float=_refuse_number, parse_constant=_refuse_number)', 'return json.loads(text)'),
    ("the float hook lets a fraction through",
     'raise ValueError("a number with a fraction or an exponent")', 'return 0'),
    ("a JSON true is a number", '    if isinstance(raw, bool):\n        return -1', '    if False:\n        return -1'),
    ("a negative int is a number", 'return raw if raw >= 0 else -1', 'return raw'),
    ("a number of any length is read", 'if not s or len(s) > 40 or', 'if not s or len(s) > 41 or'),

    # --- the views
    ("a view reads a flat id of any length", 'key = flat_id.strip()[:ID_CHARS]', 'key = flat_id.strip()'),
    ("an address is looked up in the caller's letter case",
     'key = address.strip().lower()[:ADDRESS_CHARS]', 'key = address.strip()[:ADDRESS_CHARS]'),
    ("a page is not capped", 'size = PAGE if size < 1 or size > PAGE else size', 'size = PAGE if size < 1 else size'),
    ("the report phase lasts one second too long",
     'return "report" if now < int(r.moveout_end) else "reclaim"', 'return "report" if now <= int(r.moveout_end) else "reclaim"'),
    ("the answer phase lasts one second too long",
     'return "answer" if now < int(r.response_end) else "settle"', 'return "answer" if now <= int(r.response_end) else "settle"'),
    ("a phase is guessed without a clock", '        if now < 0:\n            return "unknown"', '        if False:\n            return "unknown"'),
    ("a closed flat shows its deposit as held",
     '"held": str(int(r.deposit)) if str(r.status) in HOLDING else "0"', '"held": str(int(r.deposit))'),
    ("a flat nobody took shows the zero address as its tenant",
     'return "" if _low(r.tenant) == ZERO else _low(r.tenant)', 'return _low(r.tenant)'),
]


def _env(**extra):
    return dict(os.environ, PYTHONDONTWRITEBYTECODE="1", **extra)


def run(path: pathlib.Path) -> str:
    out = subprocess.run(PYTEST, env=_env(DEPOSIT_BACK_SOURCE=str(path)), capture_output=True, text=True, cwd=ROOT)
    if out.returncode == 0:
        return ""
    text = out.stdout + out.stderr
    if "error during collection" in text or "IndentationError" in text or "SyntaxError" in text:
        raise RuntimeError("the mutant does not even import; that is a broken anchor, not a killed defence:\n"
                           + text[-600:])
    m = re.search(r"FAILED tests/test_pure\.py::(\S+)", text)
    if not m:
        raise RuntimeError("a test failed but its name could not be read:\n" + text[-800:])
    return m.group(1)


def edits_of(rest):
    return rest[0] if len(rest) == 1 else [(rest[0], rest[1])]


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--jobs", type=int, default=os.cpu_count() or 4)
    parser.add_argument("--only", default="")
    args = parser.parse_args()
    names = [m[0] for m in MUTATIONS]
    if len(set(names)) != len(names):
        print("two mutants share a name")
        return 2
    chosen = [m for m in MUTATIONS if args.only in m[0]]
    texts = []
    for name, *rest in chosen:
        text = SRC
        for old, new in edits_of(rest):
            if SRC.count(old) != 1:
                print(f"  ! anchor found {SRC.count(old)} times, expected once: {name}")
                return 2
            text = text.replace(old, new)
        if text == SRC:
            print(f"  ! the mutant is the source itself: {name}")
            return 2
        texts.append((name, text))
    baseline = subprocess.run(PYTEST, env=_env(), capture_output=True, text=True, cwd=ROOT)
    if baseline.returncode != 0:
        print("the unmutated suite does not pass; a mutation table over a failing suite proves nothing")
        print((baseline.stdout + baseline.stderr)[-600:])
        return 3
    results = {}
    with tempfile.TemporaryDirectory() as tmp:
        paths = []
        for k, (name, text) in enumerate(texts):
            path = pathlib.Path(tmp) / f"deposit_back_{k}.py"
            path.write_text(text, encoding="utf-8")
            paths.append((name, path))
        with concurrent.futures.ThreadPoolExecutor(max_workers=max(1, args.jobs)) as pool:
            futures = {pool.submit(run, path): name for name, path in paths}
            for future in concurrent.futures.as_completed(futures):
                name = futures[future]
                killer = future.result()
                results[name] = killer
                print(f"  {'killed ' if killer else 'ESCAPED'}  {name}" + (f"  <- {killer}" if killer else ""), flush=True)
    rows = [(name, results[name]) for name, _ in texts]
    escaped = [name for name, killer in rows if not killer]
    if escaped:
        print(f"\n{len(escaped)} mutant(s) escaped; no table written:")
        for name in escaped:
            print("  - " + name)
        return 1
    if args.only:
        print(f"\n{len(rows)} / {len(rows)} killed (a subset; tests/MUTATIONS.md left as it was)")
        return 0
    table = ["# Mutations", "",
             f"{len(rows)} defences in `contracts/deposit_back.py`, each removed or inverted in turn, and the test "
             "that failed because of it. Generated by `tools/mutate.py`; it refuses to write this file if any mutant "
             "survives, if an anchor is not found exactly once, or if the unmutated suite is not green.", "",
             "| defence removed | killed by |", "|---|---|"]
    table += [f"| {n} | `{k}` |" for n, k in rows] + [""]
    (ROOT / "tests" / "MUTATIONS.md").write_text("\n".join(table), encoding="utf-8")
    print(f"\n{len(rows)} / {len(rows)} killed - tests/MUTATIONS.md written")
    return 0


if __name__ == "__main__":
    sys.exit(main())
