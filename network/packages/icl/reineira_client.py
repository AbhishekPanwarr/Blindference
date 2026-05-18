"""Reineira escrow client — stub for Phase 1."""


class ReineiraClient:
    """Stub client for Reineira escrow settlement.

    Full implementation will be added in a later phase when the
    production Reineira ``ConfidentialEscrow`` address is deployed
    on Arbitrum Sepolia.
    """

    def __init__(self, *_args, **_kwargs):
        pass

    async def trigger_redeem(self, escrow_id: int) -> None:
        """Called after a job is verified to trigger escrow redemption.

        TODO: Implement when Reineira production escrow is available.
        Reineira internally calls ``InferenceGate.isConditionMet(escrowId)``
        which reads ``ResultRegistry`` — this only succeeds if the job is verified.
        """
        raise NotImplementedError(
            "Reineira escrow settlement not yet integrated — "
            "awaiting production ConfidentialEscrow deployment"
        )
