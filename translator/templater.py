"""Deterministic fallback strings — always available, no API needed.

Each renderer takes the finding's dict form and returns
(user_message, suggested_actions).
"""

from typing import Any, Callable

Rendered = tuple[str, list[str]]
Renderer = Callable[[dict[str, Any]], Rendered]


def _ghost(f: dict) -> Rendered:
    p = f["template_params"]
    return (
        f"On the Follow-up Tumor Assessment for visit {f['visit']}, a measurement "
        f"is recorded for lesion {p['ghost_id']} but this lesion was never "
        f"identified at Baseline. Either it is a new lesion that needs to be "
        f"added, or the wrong lesion ID was entered.",
        [
            f"Confirm whether {p['ghost_id']} is a new lesion; if so, add it on "
            f"the Baseline / New Lesion form and set its status to NEW.",
            f"Otherwise, correct the lesion ID on the Follow-up Tumor Assessment "
            f"to one of {', '.join(p['tu_ids'])}.",
        ],
    )


def _pr_threshold(f: dict) -> Rendered:
    p = f["template_params"]
    pct = p["pct_decrease"] * 100
    return (
        f"On the Disease Response / RECIST Assessment for {f['visit']}, target "
        f"response is marked Partial Response, but the sum of target lesion "
        f"diameters has only decreased from {p['baseline_sum']:g} mm at baseline "
        f"to {p['current_sum']:g} mm ({pct:.1f}%). RECIST 1.1 requires at least "
        f"30% to call PR.",
        [
            "Change target response and overall response to Stable Disease, or",
            "Re-check the target lesion measurements at this visit against the "
            "source imaging report.",
        ],
    )


def _cr_non_target(f: dict) -> Rendered:
    p = f["template_params"]
    ids = ", ".join(p["non_target_present_ids"]) or "non-target disease"
    return (
        f"On the Disease Response / RECIST Assessment for {f['visit']}, overall "
        f"response is marked Complete Response, but non-target disease ({ids}) "
        f"is still recorded as present. Overall CR requires every non-target "
        f"lesion to be absent.",
        [
            "Change overall response to Partial Response, or",
            f"Update the status of {ids} on the Follow-up Tumor Assessment if it "
            f"has actually resolved.",
        ],
    )


def _new_lesion_conflict(f: dict) -> Rendered:
    p = f["template_params"]
    ids = ", ".join(p["new_lesion_ids"])
    return (
        f"On the Follow-up Tumor Assessment for {f['visit']}, a new lesion "
        f"({ids}) is recorded, but the Disease Response form for the same visit "
        f"says no new lesions and overall response is "
        f"{p['rs_ovrlresp'] or 'unspecified'}. Under RECIST a new lesion "
        f"implies Progressive Disease.",
        [
            "Update the Disease Response form to indicate new lesions present "
            "and set overall response to Progressive Disease, or",
            f"Remove or reclassify {ids} on the Follow-up Tumor Assessment if it "
            f"was recorded in error.",
        ],
    )


def _dup_identity(f: dict) -> Rendered:
    p = f["template_params"]
    locs = " and ".join(p["conflicting_locations"])
    return (
        f"On the Baseline Tumor Assessment, lesion {p['lesion_id']} is recorded "
        f"twice with different identities ({locs}). The same lesion ID must "
        f"describe one lesion only.",
        [
            f"Keep the correct {p['lesion_id']} entry and remove the duplicate, "
            "or",
            "Assign a different lesion ID (T02, T03…) to the second lesion if "
            "it is genuinely separate.",
        ],
    )


def _standardization(f: dict) -> Rendered:
    p = f["template_params"]
    return (
        f"On the {f['lineage']['form']} for {f['visit']}, "
        f"\"{p['raw_value']}\" was entered. The system standardized it to "
        f"\"{p['canonical']}\".",
        [
            "Accept the standardized term if the source document agrees.",
        ],
    )


def _method_change(f: dict) -> Rendered:
    p = f["template_params"]
    return (
        f"At {f['visit']}, the imaging method ({p['current_method']}) differs "
        f"from the baseline method ({p['baseline_method']}). Method changes can "
        f"affect comparability of measurements.",
        [
            "Confirm whether the method change is protocol-allowed.",
            "If unintended, re-image with the baseline modality.",
        ],
    )


def _large_drop(f: dict) -> Rendered:
    p = f["template_params"]
    parts = [
        f"{c['lesion_id']} {c['prior_value']:g}→{c['current_value']:g} mm "
        f"({c['pct_drop'] * 100:.0f}% from {c['prior_visit']})"
        for c in p["changes"]
    ]
    return (
        f"At {f['visit']}, target lesion measurements dropped sharply: "
        f"{'; '.join(parts)}. This may be a true rapid response but should be "
        f"verified.",
        [
            "Re-review the source imaging report for this visit.",
            "Confirm the entered measurements match the radiologist's reading.",
        ],
    )


def _visit_window(f: dict) -> Rendered:
    p = f["template_params"]
    return (
        f"The {f['visit']} assessment occurred on {p['actual_date']}, "
        f"{p['delta_days']:+d} days from the expected window centered on "
        f"{p['expected_date']}.",
        [
            "Confirm the deviation is within the protocol's visit window.",
            "If not allowed, query the site for an explanation.",
        ],
    )


def _basic_field(f: dict) -> Rendered:
    return (
        f"The field {f['lineage']['field']} on {f['lineage']['form']} did not "
        f"pass a basic check ({f['raw_message']}).",
        ["Correct the value and re-validate."],
    )


RENDERERS: dict[str, Renderer] = {
    "GHOST_REFERENCE": _ghost,
    "RESPONSE_THRESHOLD": _pr_threshold,
    "CR_NON_TARGET": _cr_non_target,
    "NEW_LESION_CONFLICT": _new_lesion_conflict,
    "DUPLICATE_IDENTITY": _dup_identity,
    "STANDARDIZATION": _standardization,
    "METHOD_CHANGE": _method_change,
    "LARGE_DROP": _large_drop,
    "VISIT_WINDOW": _visit_window,
    "BASIC_FIELD": _basic_field,
}


def render(finding: dict) -> Rendered:
    fn = RENDERERS.get(finding["template_id"])
    if fn is None:
        return (
            f"{finding['raw_message']} (No template renderer registered for "
            f"{finding['template_id']}.)",
            ["Review the underlying record."],
        )
    return fn(finding)
