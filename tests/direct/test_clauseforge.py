"""Direct-mode tests for the ClauseForge intelligent contract.

These run the contract Python code in-memory. They validate business logic,
input bounding, state transitions, and hashing. Validator equivalence logic
is exercised via ``direct_vm.run_validator``.
"""

import json
import pytest


CONTRACT_PATH = "contracts/clauseforge.py"


def _hex(addr) -> str:
    """Normalise a fixture address (bytes or Address) to a 0x-hex string."""
    if isinstance(addr, (bytes, bytearray)):
        return "0x" + bytes(addr).hex()
    if hasattr(addr, "as_hex"):
        return addr.as_hex
    return str(addr)


# --- helpers ----------------------------------------------------------------

DRAFT_GOOD = (
    "Party A will deliver a two-page technical memo on the Optimistic "
    "Democracy consensus model, no later than 2026-08-15. Deliverable: PDF "
    "delivered by email. Acceptance criteria: memo passes a factual review "
    "by Party B within 5 business days. Payment: 500 USDC on acceptance. "
    "Revision policy: one round of revisions within 3 business days."
)

DRAFT_AMBIGUOUS = (
    "Party A will build a landing page for Party B soon. Payment TBD. "
    "Party B will provide feedback. Some revisions might be needed."
)


def _mock_good_llm(vm):
    vm.mock_llm(
        r".*ClauseForge.*",
        json.dumps(
            {
                "extracted": {
                    "deliverables_present": True,
                    "deadlines_present": True,
                    "payment_present": True,
                    "acceptance_criteria_present": True,
                    "revision_policy_present": True,
                },
                "canonical_terms": {
                    "deliverables": "Two-page technical memo (PDF) on Optimistic Democracy.",
                    "deadlines": "Deliverable due by 2026-08-15.",
                    "payment": "500 USDC on acceptance.",
                    "acceptance_criteria": "Factual review by Party B within 5 business days.",
                    "revision_policy": "One round of revisions within 3 business days.",
                },
                "ambiguity_report": [],
                "ambiguity_count": 0,
                "risk_score": 10,
                "clear_to_commit": True,
                "notes": "All required clauses present.",
            }
        ),
    )


def _mock_ambiguous_llm(vm):
    vm.mock_llm(
        r".*ClauseForge.*",
        json.dumps(
            {
                "extracted": {
                    "deliverables_present": True,
                    "deadlines_present": False,
                    "payment_present": False,
                    "acceptance_criteria_present": False,
                    "revision_policy_present": False,
                },
                "canonical_terms": {
                    "deliverables": "Landing page for Party B.",
                    "deadlines": "",
                    "payment": "",
                    "acceptance_criteria": "",
                    "revision_policy": "",
                },
                "ambiguity_report": [
                    "'soon' is not a specific deadline",
                    "'Payment TBD' is missing an amount and trigger",
                    "'feedback' has no acceptance criteria",
                    "'some revisions might be needed' has no revision policy",
                ],
                "ambiguity_count": 4,
                "risk_score": 85,
                "clear_to_commit": False,
                "notes": "Missing 4 required clauses.",
            }
        ),
    )


# --- tests ------------------------------------------------------------------


def test_config_and_owner(direct_vm, direct_deploy, direct_alice):
    direct_vm.sender = direct_alice
    c = direct_deploy(CONTRACT_PATH, "", 0)
    cfg = c.config()
    assert cfg["owner"].lower() == _hex(direct_alice).lower()
    assert cfg["fee_recipient"].lower() == _hex(direct_alice).lower()
    assert cfg["fee_wei"] == "0"
    assert cfg["count"] == "0"
    assert c.count() == 0


def test_create_bounds(direct_vm, direct_deploy, direct_alice, direct_bob):
    direct_vm.sender = direct_alice
    c = direct_deploy(CONTRACT_PATH, "", 0)

    # bad party
    with direct_vm.expect_revert("invalid party_b"):
        c.create_agreement("not-an-address", "t", "d", [])

    # self-agreement
    with direct_vm.expect_revert("must differ"):
        c.create_agreement(_hex(direct_alice), "t", "d", [])

    # empty title
    with direct_vm.expect_revert("title required"):
        c.create_agreement(_hex(direct_bob), "   ", "d", [])

    # empty draft
    with direct_vm.expect_revert("draft_text required"):
        c.create_agreement(_hex(direct_bob), "t", "   ", [])

    # bad url
    with direct_vm.expect_revert("evidence url must be http"):
        c.create_agreement(_hex(direct_bob), "t", "d", ["ftp://x"])

    # too many urls
    with direct_vm.expect_revert("too many evidence_urls"):
        c.create_agreement(
            _hex(direct_bob),
            "t",
            "d",
            [
                "https://a.com",
                "https://b.com",
                "https://c.com",
                "https://d.com",
                "https://e.com",
            ],
        )


def test_create_then_get(direct_vm, direct_deploy, direct_alice, direct_bob):
    direct_vm.sender = direct_alice
    c = direct_deploy(CONTRACT_PATH, "", 0)
    aid = c.create_agreement(
        _hex(direct_bob),
        "Memo deal",
        DRAFT_GOOD,
        ["https://example.com/spec"],
    )
    assert aid == 1
    ag = c.get_agreement(1)
    assert ag["status"] == "DRAFT"
    assert ag["title"] == "Memo deal"
    assert ag["party_a"].lower() == _hex(direct_alice).lower()
    assert ag["party_b"].lower() == _hex(direct_bob).lower()
    assert ag["evidence_urls"] == ["https://example.com/spec"]
    assert ag["compiled_terms_hash"] == ""
    assert ag["clear_to_commit"] is False


def test_full_lifecycle_clear(direct_vm, direct_deploy, direct_alice, direct_bob):
    direct_vm.sender = direct_alice
    c = direct_deploy(CONTRACT_PATH, "", 0)
    aid = c.create_agreement(_hex(direct_bob), "Memo deal", DRAFT_GOOD, [])

    _mock_good_llm(direct_vm)
    res = c.compile_agreement(aid)
    assert res["clear_to_commit"] is True
    assert res["risk_score"] <= 33
    terms_hash = res["compiled_terms_hash"]
    assert terms_hash.startswith("0x") and len(terms_hash) == 66

    ag = c.get_agreement(aid)
    assert ag["status"] == "COMPILED"
    assert ag["flags"]["deliverables_present"] is True
    assert ag["flags"]["deadlines_present"] is True

    # Only parties can accept.
    with direct_vm.prank(direct_alice):
        c.accept_terms(aid, terms_hash)

    ag = c.get_agreement(aid)
    assert ag["accepted_a"] is True
    assert ag["accepted_b"] is False
    assert ag["status"] == "COMPILED"

    with direct_vm.prank(direct_bob):
        c.accept_terms(aid, terms_hash)

    ag = c.get_agreement(aid)
    assert ag["accepted_a"] is True and ag["accepted_b"] is True
    assert ag["status"] == "ACTIVE"
    assert ag["activated_at"] != ""


def test_ambiguous_draft_blocks_activation(
    direct_vm, direct_deploy, direct_alice, direct_bob
):
    direct_vm.sender = direct_alice
    c = direct_deploy(CONTRACT_PATH, "", 0)
    aid = c.create_agreement(_hex(direct_bob), "Vague deal", DRAFT_AMBIGUOUS, [])

    _mock_ambiguous_llm(direct_vm)
    res = c.compile_agreement(aid)
    assert res["clear_to_commit"] is False
    assert res["risk_score"] >= 67
    terms_hash = res["compiled_terms_hash"]

    with direct_vm.prank(direct_alice):
        c.accept_terms(aid, terms_hash)
    with direct_vm.prank(direct_bob):
        c.accept_terms(aid, terms_hash)

    ag = c.get_agreement(aid)
    # Both accepted but not clear_to_commit -> still COMPILED, not ACTIVE.
    assert ag["accepted_a"] and ag["accepted_b"]
    assert ag["status"] == "COMPILED"


def test_recompile_resets_acceptance(
    direct_vm, direct_deploy, direct_alice, direct_bob
):
    direct_vm.sender = direct_alice
    c = direct_deploy(CONTRACT_PATH, "", 0)
    aid = c.create_agreement(_hex(direct_bob), "T", DRAFT_GOOD, [])

    _mock_good_llm(direct_vm)
    res = c.compile_agreement(aid)
    first_hash = res["compiled_terms_hash"]

    with direct_vm.prank(direct_alice):
        c.accept_terms(aid, first_hash)

    # Recompile: yields the SAME hash under the same mock, so the acceptance
    # reset simply blanks accepted_a until the party re-signs.
    direct_vm.clear_mocks()
    _mock_ambiguous_llm(direct_vm)
    res2 = c.compile_agreement(aid)
    second_hash = res2["compiled_terms_hash"]
    assert second_hash != first_hash

    ag = c.get_agreement(aid)
    assert ag["accepted_a"] is False
    assert ag["accepted_b"] is False
    assert ag["compiled_terms_hash"] == second_hash


def test_accept_rejects_wrong_hash(
    direct_vm, direct_deploy, direct_alice, direct_bob
):
    direct_vm.sender = direct_alice
    c = direct_deploy(CONTRACT_PATH, "", 0)
    aid = c.create_agreement(_hex(direct_bob), "T", DRAFT_GOOD, [])
    _mock_good_llm(direct_vm)
    c.compile_agreement(aid)

    with direct_vm.prank(direct_alice):
        with direct_vm.expect_revert("does not match"):
            c.accept_terms(aid, "0x" + "00" * 32)


def test_accept_rejects_stranger(direct_vm, direct_deploy, direct_alice, direct_bob, direct_charlie):
    direct_vm.sender = direct_alice
    c = direct_deploy(CONTRACT_PATH, "", 0)
    aid = c.create_agreement(_hex(direct_bob), "T", DRAFT_GOOD, [])
    _mock_good_llm(direct_vm)
    res = c.compile_agreement(aid)

    with direct_vm.prank(direct_charlie):
        with direct_vm.expect_revert("only party_a or party_b"):
            c.accept_terms(aid, res["compiled_terms_hash"])


def test_cancel_only_by_party(direct_vm, direct_deploy, direct_alice, direct_bob, direct_charlie):
    direct_vm.sender = direct_alice
    c = direct_deploy(CONTRACT_PATH, "", 0)
    aid = c.create_agreement(_hex(direct_bob), "T", DRAFT_GOOD, [])

    with direct_vm.prank(direct_charlie):
        with direct_vm.expect_revert("only party_a or party_b may cancel"):
            c.cancel_agreement(aid)

    with direct_vm.prank(direct_bob):
        c.cancel_agreement(aid)
    ag = c.get_agreement(aid)
    assert ag["status"] == "CANCELLED"


def test_cancel_forbidden_after_activation(
    direct_vm, direct_deploy, direct_alice, direct_bob
):
    direct_vm.sender = direct_alice
    c = direct_deploy(CONTRACT_PATH, "", 0)
    aid = c.create_agreement(_hex(direct_bob), "T", DRAFT_GOOD, [])
    _mock_good_llm(direct_vm)
    res = c.compile_agreement(aid)
    with direct_vm.prank(direct_alice):
        c.accept_terms(aid, res["compiled_terms_hash"])
    with direct_vm.prank(direct_bob):
        c.accept_terms(aid, res["compiled_terms_hash"])
    ag = c.get_agreement(aid)
    assert ag["status"] == "ACTIVE"

    with direct_vm.prank(direct_alice):
        with direct_vm.expect_revert("active agreement cannot be cancelled"):
            c.cancel_agreement(aid)


def test_fee_enforced(direct_vm, direct_deploy, direct_alice, direct_bob):
    direct_vm.sender = direct_alice
    c = direct_deploy(CONTRACT_PATH, "", 1000)
    aid = c.create_agreement(_hex(direct_bob), "T", DRAFT_GOOD, [])
    _mock_good_llm(direct_vm)

    # zero value -> reject
    with direct_vm.expect_revert("insufficient fee"):
        c.compile_agreement(aid)

    # matching value -> ok
    direct_vm.value = 1000
    try:
        c.compile_agreement(aid)
    finally:
        direct_vm.value = 0


def test_list_recent_and_agreements_of(
    direct_vm, direct_deploy, direct_alice, direct_bob, direct_charlie
):
    direct_vm.sender = direct_alice
    c = direct_deploy(CONTRACT_PATH, "", 0)
    c.create_agreement(_hex(direct_bob), "T1", DRAFT_GOOD, [])
    c.create_agreement(_hex(direct_charlie), "T2", DRAFT_AMBIGUOUS, [])
    c.create_agreement(_hex(direct_bob), "T3", DRAFT_GOOD, [])

    recent = c.list_recent(0, 10)
    assert [x["title"] for x in recent] == ["T3", "T2", "T1"]

    assert sorted(c.agreements_of(_hex(direct_alice))) == [1, 2, 3]
    assert sorted(c.agreements_of(_hex(direct_bob))) == [1, 3]
    assert sorted(c.agreements_of(_hex(direct_charlie))) == [2]


def test_validator_agrees_on_matching_output(
    direct_vm, direct_deploy, direct_alice, direct_bob
):
    """Validator re-runs leader; with same mock, decision surface matches."""
    direct_vm.sender = direct_alice
    c = direct_deploy(CONTRACT_PATH, "", 0)
    aid = c.create_agreement(_hex(direct_bob), "T", DRAFT_GOOD, [])
    _mock_good_llm(direct_vm)
    c.compile_agreement(aid)

    # Re-run captured validator with same mock -> agreement.
    assert direct_vm.run_validator() is True


def test_validator_disagrees_on_flipped_decision(
    direct_vm, direct_deploy, direct_alice, direct_bob
):
    """Swap the mock so the validator sees the opposite decision -> disagree."""
    direct_vm.sender = direct_alice
    c = direct_deploy(CONTRACT_PATH, "", 0)
    aid = c.create_agreement(_hex(direct_bob), "T", DRAFT_GOOD, [])
    _mock_good_llm(direct_vm)
    c.compile_agreement(aid)

    # Swap mock -> validator will re-run leader and see a different clear_to_commit.
    direct_vm.clear_mocks()
    _mock_ambiguous_llm(direct_vm)
    assert direct_vm.run_validator() is False
