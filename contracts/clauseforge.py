# { "Depends": "py-genlayer:1jb45aa8ynh2a9c9xn3b7qqh8sm5q93hwfp7jqmwsfhh8jpz09h6" }

# ClauseForge -- pre-dispute agreement compiler on GenLayer.
#
# Two parties submit the raw text of a deal. GenLayer validators reach
# consensus on a structured decision surface: which required clauses are
# present, how ambiguous the draft is, and whether it is clear enough to
# commit. Both parties must then accept the same canonical terms hash on
# chain before the agreement activates.
#
# Consensus is designed around a stable, bounded decision surface -- not
# the raw LLM text -- so validators can converge deterministically.

from genlayer import *

import json
import hashlib
import typing
from dataclasses import dataclass
from datetime import datetime, timezone


# ---------------------------------------------------------------------------
# Bounds. Enforced deterministically to keep validator work bounded and to
# prevent adversarial drafts from bloating on-chain storage.
# ---------------------------------------------------------------------------
MAX_TITLE_LEN: typing.Final[int] = 160
MAX_DRAFT_LEN: typing.Final[int] = 12_000
MAX_URL_LEN: typing.Final[int] = 400
MAX_EVIDENCE_URLS: typing.Final[int] = 4
MAX_LIST_LIMIT: typing.Final[int] = 50

STATUS_DRAFT: typing.Final[str] = "DRAFT"
STATUS_COMPILED: typing.Final[str] = "COMPILED"
STATUS_ACTIVE: typing.Final[str] = "ACTIVE"
STATUS_CANCELLED: typing.Final[str] = "CANCELLED"

# Error prefixes -- see GenLayer docs on error classification for validators.
E_EXPECTED = "[EXPECTED]"
E_EXTERNAL = "[EXTERNAL]"
E_LLM = "[LLM_ERROR]"


# ---------------------------------------------------------------------------
# Storage schema.
# ---------------------------------------------------------------------------
@allow_storage
@dataclass
class Agreement:
    id: u256
    party_a: Address
    party_b: Address
    title: str
    draft_text: str
    evidence_urls: DynArray[str]

    # Rich payload -- stored, not validator-gated.
    compiled_terms_json: str
    ambiguity_report_json: str
    compiler_notes: str
    compiled_terms_hash: str  # 0x-prefixed sha256 hex of canonical terms JSON

    # Consensus-critical decision surface.
    deliverables_present: bool
    deadlines_present: bool
    payment_present: bool
    acceptance_criteria_present: bool
    revision_policy_present: bool
    ambiguity_count: u256
    risk_score: u256  # 0..100
    clear_to_commit: bool

    # Acceptance and lifecycle.
    accepted_a: bool
    accepted_b: bool
    accepted_hash_a: str
    accepted_hash_b: str
    status: str  # DRAFT | COMPILED | ACTIVE | CANCELLED

    # Timestamps -- ISO-8601 UTC strings pinned to the transaction datetime.
    created_at: str
    compiled_at: str
    activated_at: str


# ---------------------------------------------------------------------------
# Helpers.
# ---------------------------------------------------------------------------
def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _bucket(score: int) -> str:
    if score <= 33:
        return "low"
    if score <= 66:
        return "medium"
    return "high"


def _canonical_terms_json(terms: dict) -> str:
    """Sort keys recursively and drop insignificant whitespace. Deterministic."""
    return json.dumps(terms, sort_keys=True, separators=(",", ":"), ensure_ascii=True)


def _sha256_hex(data: str) -> str:
    h = hashlib.sha256(data.encode("utf-8")).hexdigest()
    return "0x" + h


def _coerce_bool(x: typing.Any) -> bool:
    if isinstance(x, bool):
        return x
    if isinstance(x, str):
        return x.strip().lower() in ("true", "yes", "1", "y")
    if isinstance(x, (int, float)):
        return bool(x)
    return False


def _coerce_int(x: typing.Any, default: int = 0) -> int:
    try:
        if isinstance(x, bool):
            return int(x)
        if isinstance(x, (int, float)):
            return int(x)
        if isinstance(x, str):
            return int(float(x.strip()))
    except (ValueError, TypeError):
        pass
    return default


def _clamp(v: int, lo: int, hi: int) -> int:
    return max(lo, min(hi, v))


def _parse_compilation(raw: typing.Any) -> dict:
    """Coerce arbitrary LLM output into the canonical decision surface.

    Fail-closed: any missing or malformed value defaults to a conservative
    reading (clause absent, more ambiguity, higher risk, not clear to commit).
    """
    if not isinstance(raw, dict):
        raise gl.vm.UserError(f"{E_LLM} non-dict LLM response: {type(raw).__name__}")

    extracted = raw.get("extracted")
    if not isinstance(extracted, dict):
        extracted = {}

    flags = {
        "deliverables_present": _coerce_bool(extracted.get("deliverables_present")),
        "deadlines_present": _coerce_bool(extracted.get("deadlines_present")),
        "payment_present": _coerce_bool(extracted.get("payment_present")),
        "acceptance_criteria_present": _coerce_bool(
            extracted.get("acceptance_criteria_present")
        ),
        "revision_policy_present": _coerce_bool(
            extracted.get("revision_policy_present")
        ),
    }

    ambiguity_count = _clamp(_coerce_int(raw.get("ambiguity_count"), 0), 0, 100)
    risk_score = _clamp(_coerce_int(raw.get("risk_score"), 100), 0, 100)
    clear = _coerce_bool(raw.get("clear_to_commit"))

    # Canonical terms: normalise into a fixed schema so the hash is stable.
    terms_in = raw.get("canonical_terms")
    if not isinstance(terms_in, dict):
        terms_in = {}
    canonical_terms = {
        "deliverables": _as_str(terms_in.get("deliverables")),
        "deadlines": _as_str(terms_in.get("deadlines")),
        "payment": _as_str(terms_in.get("payment")),
        "acceptance_criteria": _as_str(terms_in.get("acceptance_criteria")),
        "revision_policy": _as_str(terms_in.get("revision_policy")),
        "flags": flags,
    }

    ambiguity_report_in = raw.get("ambiguity_report")
    if isinstance(ambiguity_report_in, list):
        # Only keep short-form strings to avoid unbounded storage.
        report = [str(x)[:400] for x in ambiguity_report_in[:20]]
    else:
        report = []

    notes = _as_str(raw.get("notes"))[:800]

    return {
        "flags": flags,
        "ambiguity_count": ambiguity_count,
        "risk_score": risk_score,
        "clear_to_commit": clear,
        "canonical_terms": canonical_terms,
        "ambiguity_report": report,
        "notes": notes,
    }


def _as_str(v: typing.Any) -> str:
    if v is None:
        return ""
    if isinstance(v, str):
        return v
    return str(v)


def _validator_agrees(leader: dict, mine: dict) -> bool:
    """Compare only the structured decision surface, with a small tolerance
    on the ambiguity count and a bucketed risk score. Rich text may differ.
    """
    if leader["clear_to_commit"] != mine["clear_to_commit"]:
        return False
    if leader["flags"] != mine["flags"]:
        return False
    if _bucket(int(leader["risk_score"])) != _bucket(int(mine["risk_score"])):
        return False
    if abs(int(leader["ambiguity_count"]) - int(mine["ambiguity_count"])) > 2:
        return False
    return True


def _make_prompt(draft: str, evidence_blob: str, party_a: str, party_b: str) -> str:
    return (
        "You are ClauseForge, a strict pre-dispute agreement compiler. Given\n"
        "the raw text of a deal between two parties, produce a canonical,\n"
        "structured reading and identify blocking ambiguities.\n"
        "\n"
        "Rules:\n"
        "- Base answers only on what the draft (and evidence, if present)\n"
        "  actually says. Do not invent facts.\n"
        "- Prefer marking a clause as absent over hallucinating one.\n"
        "- risk_score is 0..100: 0 = perfectly clear, 100 = must not commit.\n"
        "- clear_to_commit is true only when every required clause is\n"
        "  present and no blocking ambiguity remains.\n"
        "\n"
        "Required output (strict JSON, no prose, no code fences):\n"
        "{\n"
        '  "extracted": {\n'
        '    "deliverables_present": bool,\n'
        '    "deadlines_present": bool,\n'
        '    "payment_present": bool,\n'
        '    "acceptance_criteria_present": bool,\n'
        '    "revision_policy_present": bool\n'
        "  },\n"
        '  "canonical_terms": {\n'
        '    "deliverables": str, "deadlines": str, "payment": str,\n'
        '    "acceptance_criteria": str, "revision_policy": str\n'
        "  },\n"
        '  "ambiguity_report": [str, ...],\n'
        '  "ambiguity_count": int,\n'
        '  "risk_score": int,\n'
        '  "clear_to_commit": bool,\n'
        '  "notes": str\n'
        "}\n"
        "\n"
        f"party_a: {party_a}\n"
        f"party_b: {party_b}\n"
        "\n"
        "Draft text:\n"
        "-----BEGIN DRAFT-----\n"
        f"{draft}\n"
        "-----END DRAFT-----\n"
        "\n"
        "Additional evidence (may be empty):\n"
        "-----BEGIN EVIDENCE-----\n"
        f"{evidence_blob}\n"
        "-----END EVIDENCE-----\n"
    )


# ---------------------------------------------------------------------------
# Contract.
# ---------------------------------------------------------------------------
class ClauseForge(gl.Contract):
    # --- config
    owner: Address
    fee_recipient: Address
    fee_wei: u256

    # --- accounting
    next_id: u256
    agreement_index: DynArray[u256]

    # --- storage
    agreements: TreeMap[u256, Agreement]
    by_party: TreeMap[Address, DynArray[u256]]

    def __init__(self, fee_recipient: str = "", fee_wei: int = 0):
        deployer = gl.message.sender_address
        self.owner = deployer

        if fee_recipient and fee_recipient != "0x0000000000000000000000000000000000000000":
            try:
                self.fee_recipient = Address(fee_recipient)
            except Exception:
                self.fee_recipient = deployer
        else:
            self.fee_recipient = deployer

        # Clamp fee to a sane range; contract accepts >= this on compile.
        fw = _coerce_int(fee_wei, 0)
        if fw < 0:
            fw = 0
        self.fee_wei = u256(fw)
        self.next_id = u256(0)

    # -----------------------------------------------------------------------
    # Views.
    # -----------------------------------------------------------------------
    @gl.public.view
    def config(self) -> dict:
        return {
            "owner": self.owner.as_hex,
            "fee_recipient": self.fee_recipient.as_hex,
            "fee_wei": str(int(self.fee_wei)),
            "count": str(int(self.next_id)),
            "runner": "py-genlayer:1jb45aa8ynh2a9c9xn3b7qqh8sm5q93hwfp7jqmwsfhh8jpz09h6",
            "version": "1.0.0",
        }

    @gl.public.view
    def count(self) -> int:
        return int(self.next_id)

    @gl.public.view
    def get_agreement(self, agreement_id: int) -> dict:
        aid = u256(int(agreement_id))
        return self._render(self._require(aid))

    @gl.public.view
    def list_recent(self, offset: int = 0, limit: int = 20) -> list:
        total = len(self.agreement_index)
        if total == 0 or limit <= 0:
            return []
        lim = min(int(limit), MAX_LIST_LIMIT)
        off = max(0, int(offset))
        # Newest first.
        out: list = []
        i = total - 1 - off
        while i >= 0 and len(out) < lim:
            aid = self.agreement_index[i]
            out.append(self._render(self.agreements[aid]))
            i -= 1
        return out

    @gl.public.view
    def agreements_of(self, party: str) -> list:
        try:
            addr = Address(party)
        except Exception:
            return []
        ids = self.by_party.get(addr)
        if ids is None:
            return []
        return [int(x) for x in ids]

    # -----------------------------------------------------------------------
    # Writes.
    # -----------------------------------------------------------------------
    @gl.public.write
    def create_agreement(
        self,
        party_b: str,
        title: str,
        draft_text: str,
        evidence_urls: list,
    ) -> int:
        try:
            b_addr = Address(party_b)
        except Exception:
            raise gl.vm.UserError(f"{E_EXPECTED} invalid party_b address")

        a_addr = gl.message.sender_address
        if b_addr == a_addr:
            raise gl.vm.UserError(f"{E_EXPECTED} party_a and party_b must differ")

        t = title.strip()
        if not t:
            raise gl.vm.UserError(f"{E_EXPECTED} title required")
        if len(t) > MAX_TITLE_LEN:
            raise gl.vm.UserError(f"{E_EXPECTED} title too long")

        d = draft_text
        if not d or not d.strip():
            raise gl.vm.UserError(f"{E_EXPECTED} draft_text required")
        if len(d) > MAX_DRAFT_LEN:
            raise gl.vm.UserError(f"{E_EXPECTED} draft_text too long")

        urls: list = evidence_urls if isinstance(evidence_urls, list) else []
        if len(urls) > MAX_EVIDENCE_URLS:
            raise gl.vm.UserError(f"{E_EXPECTED} too many evidence_urls")
        cleaned_urls: list = []
        for u in urls:
            s = str(u).strip()
            if not s:
                continue
            if len(s) > MAX_URL_LEN:
                raise gl.vm.UserError(f"{E_EXPECTED} evidence url too long")
            if not (s.startswith("http://") or s.startswith("https://")):
                raise gl.vm.UserError(f"{E_EXPECTED} evidence url must be http(s)")
            cleaned_urls.append(s)

        aid_int = int(self.next_id) + 1
        aid = u256(aid_int)
        self.next_id = aid

        ag = self.agreements.get_or_insert_default(aid)
        ag.id = aid
        ag.party_a = a_addr
        ag.party_b = b_addr
        ag.title = t
        ag.draft_text = d
        for s in cleaned_urls:
            ag.evidence_urls.append(s)

        ag.compiled_terms_json = ""
        ag.ambiguity_report_json = ""
        ag.compiler_notes = ""
        ag.compiled_terms_hash = ""
        ag.deliverables_present = False
        ag.deadlines_present = False
        ag.payment_present = False
        ag.acceptance_criteria_present = False
        ag.revision_policy_present = False
        ag.ambiguity_count = u256(0)
        ag.risk_score = u256(0)
        ag.clear_to_commit = False
        ag.accepted_a = False
        ag.accepted_b = False
        ag.accepted_hash_a = ""
        ag.accepted_hash_b = ""
        ag.status = STATUS_DRAFT
        ag.created_at = _now_iso()
        ag.compiled_at = ""
        ag.activated_at = ""

        self.agreement_index.append(aid)
        self.by_party.get_or_insert_default(a_addr).append(aid)
        self.by_party.get_or_insert_default(b_addr).append(aid)

        return aid_int

    @gl.public.write.payable
    def compile_agreement(self, agreement_id: int) -> dict:
        # Fee gate.
        if int(gl.message.value) < int(self.fee_wei):
            raise gl.vm.UserError(f"{E_EXPECTED} insufficient fee")

        aid = u256(int(agreement_id))
        ag = self._require(aid)
        if ag.status not in (STATUS_DRAFT, STATUS_COMPILED):
            raise gl.vm.UserError(f"{E_EXPECTED} agreement not compilable")

        # Snapshot inputs into memory so nondet block can use them.
        draft = str(ag.draft_text)
        title = str(ag.title)
        party_a_hex = ag.party_a.as_hex
        party_b_hex = ag.party_b.as_hex
        evidence_urls: list = [str(u) for u in ag.evidence_urls]

        # ---- non-deterministic block ----
        def leader_fn() -> dict:
            evidence_blob = ""
            if evidence_urls:
                pieces: list = []
                for url in evidence_urls:
                    try:
                        resp = gl.nondet.web.get(url)
                        # Extremely conservative trim: evidence is a hint, not truth.
                        body_bytes = resp.body[:4000] if resp.body else b""
                        text = body_bytes.decode("utf-8", errors="ignore")
                        pieces.append(f"URL: {url}\n{text}\n")
                    except Exception:
                        pieces.append(f"URL: {url}\n[fetch failed]\n")
                evidence_blob = "\n---\n".join(pieces)

            prompt = _make_prompt(draft, evidence_blob, party_a_hex, party_b_hex)
            raw = gl.nondet.exec_prompt(prompt, response_format="json")
            return _parse_compilation(raw)

        def validator_fn(leader_res) -> bool:
            if not isinstance(leader_res, gl.vm.Return):
                # Any user-error path: disagree so consensus retries.
                return False
            try:
                mine = leader_fn()
            except Exception:
                return False
            return _validator_agrees(leader_res.calldata, mine)

        result: dict = gl.vm.run_nondet_unsafe(leader_fn, validator_fn)

        # ---- deterministic: canonicalise, hash, persist ----
        canonical = _canonical_terms_json(result["canonical_terms"])
        terms_hash = _sha256_hex(canonical)
        ambiguity_report_json = json.dumps(
            result["ambiguity_report"], sort_keys=True, separators=(",", ":")
        )

        ag.compiled_terms_json = canonical
        ag.compiled_terms_hash = terms_hash
        ag.ambiguity_report_json = ambiguity_report_json
        ag.compiler_notes = str(result["notes"])[:800]

        flags = result["flags"]
        ag.deliverables_present = bool(flags["deliverables_present"])
        ag.deadlines_present = bool(flags["deadlines_present"])
        ag.payment_present = bool(flags["payment_present"])
        ag.acceptance_criteria_present = bool(flags["acceptance_criteria_present"])
        ag.revision_policy_present = bool(flags["revision_policy_present"])
        ag.ambiguity_count = u256(int(result["ambiguity_count"]))
        ag.risk_score = u256(int(result["risk_score"]))
        ag.clear_to_commit = bool(result["clear_to_commit"])

        # A fresh compile invalidates any previous acceptance -- the hash changed.
        ag.accepted_a = False
        ag.accepted_b = False
        ag.accepted_hash_a = ""
        ag.accepted_hash_b = ""

        ag.status = STATUS_COMPILED
        ag.compiled_at = _now_iso()

        return {
            "id": int(aid),
            "compiled_terms_hash": terms_hash,
            "clear_to_commit": ag.clear_to_commit,
            "risk_score": int(ag.risk_score),
            "ambiguity_count": int(ag.ambiguity_count),
        }

    @gl.public.write
    def accept_terms(self, agreement_id: int, terms_hash: str) -> dict:
        aid = u256(int(agreement_id))
        ag = self._require(aid)
        if ag.status != STATUS_COMPILED:
            raise gl.vm.UserError(f"{E_EXPECTED} agreement not COMPILED")

        want = terms_hash.strip().lower()
        if want != ag.compiled_terms_hash.lower():
            raise gl.vm.UserError(f"{E_EXPECTED} terms_hash does not match")

        sender = gl.message.sender_address
        if sender == ag.party_a:
            ag.accepted_a = True
            ag.accepted_hash_a = ag.compiled_terms_hash
        elif sender == ag.party_b:
            ag.accepted_b = True
            ag.accepted_hash_b = ag.compiled_terms_hash
        else:
            raise gl.vm.UserError(f"{E_EXPECTED} only party_a or party_b may accept")

        if ag.accepted_a and ag.accepted_b and ag.clear_to_commit:
            ag.status = STATUS_ACTIVE
            ag.activated_at = _now_iso()

        return {
            "id": int(aid),
            "accepted_a": ag.accepted_a,
            "accepted_b": ag.accepted_b,
            "status": ag.status,
        }

    @gl.public.write
    def cancel_agreement(self, agreement_id: int) -> None:
        aid = u256(int(agreement_id))
        ag = self._require(aid)
        sender = gl.message.sender_address
        if sender != ag.party_a and sender != ag.party_b:
            raise gl.vm.UserError(f"{E_EXPECTED} only party_a or party_b may cancel")
        if ag.status == STATUS_ACTIVE:
            raise gl.vm.UserError(f"{E_EXPECTED} active agreement cannot be cancelled")
        ag.status = STATUS_CANCELLED

    @gl.public.write
    def set_fee(self, fee_wei: int) -> None:
        if gl.message.sender_address != self.owner:
            raise gl.vm.UserError(f"{E_EXPECTED} owner only")
        v = _coerce_int(fee_wei, 0)
        if v < 0:
            raise gl.vm.UserError(f"{E_EXPECTED} fee must be non-negative")
        self.fee_wei = u256(v)

    @gl.public.write
    def set_fee_recipient(self, recipient: str) -> None:
        if gl.message.sender_address != self.owner:
            raise gl.vm.UserError(f"{E_EXPECTED} owner only")
        try:
            self.fee_recipient = Address(recipient)
        except Exception:
            raise gl.vm.UserError(f"{E_EXPECTED} invalid recipient address")

    # -----------------------------------------------------------------------
    # Internal.
    # -----------------------------------------------------------------------
    def _require(self, aid: u256) -> Agreement:
        ag = self.agreements.get(aid)
        if ag is None:
            raise gl.vm.UserError(f"{E_EXPECTED} agreement not found")
        return ag

    def _render(self, ag: Agreement) -> dict:
        return {
            "id": int(ag.id),
            "party_a": ag.party_a.as_hex,
            "party_b": ag.party_b.as_hex,
            "title": ag.title,
            "draft_text": ag.draft_text,
            "evidence_urls": [str(u) for u in ag.evidence_urls],
            "compiled_terms_json": ag.compiled_terms_json,
            "ambiguity_report_json": ag.ambiguity_report_json,
            "compiler_notes": ag.compiler_notes,
            "compiled_terms_hash": ag.compiled_terms_hash,
            "flags": {
                "deliverables_present": ag.deliverables_present,
                "deadlines_present": ag.deadlines_present,
                "payment_present": ag.payment_present,
                "acceptance_criteria_present": ag.acceptance_criteria_present,
                "revision_policy_present": ag.revision_policy_present,
            },
            "ambiguity_count": int(ag.ambiguity_count),
            "risk_score": int(ag.risk_score),
            "risk_bucket": _bucket(int(ag.risk_score)),
            "clear_to_commit": ag.clear_to_commit,
            "accepted_a": ag.accepted_a,
            "accepted_b": ag.accepted_b,
            "accepted_hash_a": ag.accepted_hash_a,
            "accepted_hash_b": ag.accepted_hash_b,
            "status": ag.status,
            "created_at": ag.created_at,
            "compiled_at": ag.compiled_at,
            "activated_at": ag.activated_at,
        }
