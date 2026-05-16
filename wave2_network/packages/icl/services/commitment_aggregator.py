"""Commitment consensus evaluator — 2/3 quorum verification."""

from __future__ import annotations


def evaluate_commitment_consensus(
    commitments: dict[str, str | None],
) -> tuple[bool, str | None, str | None]:
    """Evaluate 2/3 consensus from three commitment hashes.

    Args:
        commitments: ``{"leader": hex, "v1": hex, "v2": hex, "leader_address": addr, "v1_address": addr, "v2_address": addr}``

    Returns:
        ``(verified, winning_hash, faulty_node_or_slash_all)`` where:
        - ``winning_hash`` is the agreed-upon hex hash
        - ``faulty_node_or_slash_all`` is the outlier address, ``"ALL"`` if all disagree, or ``None``
    """
    cl = commitments.get("leader")
    cv1 = commitments.get("v1")
    cv2 = commitments.get("v2")

    if cl and cv1 and cl == cv1:
        faulty = commitments.get("v2_address") if cv2 and cv2 != cl else None
        return (True, cl, faulty)

    if cl and cv2 and cl == cv2:
        faulty = commitments.get("v1_address") if cv1 and cv1 != cl else None
        return (True, cl, faulty)

    if cv1 and cv2 and cv1 == cv2:
        # Leader is the outlier
        return (True, cv1, commitments.get("leader_address"))

    if cl and cv1 and cv2:
        # All three disagree
        return (False, None, "ALL")

    # Incomplete — not all commitments received
    return (False, None, None)
