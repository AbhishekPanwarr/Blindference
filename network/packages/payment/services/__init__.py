from dataclasses import dataclass
from typing import Any

from fastapi import Request


@dataclass
class ServiceContainer:
    settings: Any
    database: Any = None
    credit_service: Any = None
    chain_service: Any = None
    pricing_service: Any = None


def get_service_container(request: Request) -> ServiceContainer:
    return request.app.state.services
