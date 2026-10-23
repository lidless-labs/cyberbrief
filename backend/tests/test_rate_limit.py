"""Research rate limiter: per-client buckets, windows, eviction and proxy trust."""

from __future__ import annotations

import pytest
from fastapi.testclient import TestClient
from uvicorn.middleware.proxy_headers import ProxyHeadersMiddleware

import main

HOUR = 3600
DAY = 86400


class _FakeBundle:
    def model_dump(self, by_alias: bool = False) -> dict:
        return {"ok": True}


class _Clock:
    def __init__(self) -> None:
        self.now = 1_000_000.0

    def __call__(self) -> float:
        return self.now

    def advance(self, seconds: float) -> None:
        self.now += seconds


@pytest.fixture(autouse=True)
def clock(monkeypatch: pytest.MonkeyPatch) -> _Clock:
    async def fake_research(**_kwargs):
        return _FakeBundle()

    fake_clock = _Clock()
    monkeypatch.setattr(main, "_clock", fake_clock)
    monkeypatch.setattr(main, "run_research", fake_research)
    monkeypatch.setattr(main, "run_research_from_sources", fake_research)
    monkeypatch.setattr(main, "RATE_LIMIT_PER_HOUR", 3)
    monkeypatch.setattr(main, "RATE_LIMIT_PER_DAY", 5)
    main._rate_hits.clear()
    yield fake_clock
    main._rate_hits.clear()


def _client(host: str, app=main.app) -> TestClient:
    return TestClient(app, client=(host, 50000))


def _research(client: TestClient, headers: dict[str, str] | None = None) -> int:
    return client.post("/api/research", json={"topic": "APT29"}, headers=headers).status_code


def test_hourly_limit() -> None:
    client = _client("203.0.113.1")
    assert [_research(client) for _ in range(3)] == [200, 200, 200]

    response = client.post("/api/research", json={"topic": "APT29"})
    assert response.status_code == 429
    assert "hour" in response.json()["detail"]


def test_hourly_limit_resets_after_an_hour(clock: _Clock) -> None:
    client = _client("203.0.113.1")
    assert [_research(client) for _ in range(3)] == [200, 200, 200]
    assert _research(client) == 429

    clock.advance(HOUR)
    assert _research(client) == 200


def test_daily_limit(clock: _Clock) -> None:
    client = _client("203.0.113.1")
    assert [_research(client) for _ in range(3)] == [200, 200, 200]
    clock.advance(HOUR)
    assert [_research(client) for _ in range(2)] == [200, 200]

    response = client.post("/api/research", json={"topic": "APT29"})
    assert response.status_code == 429
    assert "Daily" in response.json()["detail"]

    clock.advance(HOUR)
    assert _research(client) == 429


def test_from_sources_endpoint_shares_the_bucket() -> None:
    client = _client("203.0.113.1")
    assert [_research(client) for _ in range(3)] == [200, 200, 200]

    response = client.post(
        "/api/research/from-sources",
        json={"topic": "APT29", "sources": [{"type": "text", "value": "notes"}]},
    )
    assert response.status_code == 429


def test_distinct_clients_do_not_share_a_bucket() -> None:
    first = _client("203.0.113.1")
    second = _client("203.0.113.2")

    assert [_research(first) for _ in range(3)] == [200, 200, 200]
    assert _research(first) == 429

    assert [_research(second) for _ in range(3)] == [200, 200, 200]
    assert set(main._rate_hits) == {"203.0.113.1", "203.0.113.2"}


def test_key_removed_after_window_without_client_returning(clock: _Clock) -> None:
    _research(_client("203.0.113.1"))
    assert "203.0.113.1" in main._rate_hits

    clock.advance(DAY)
    _research(_client("203.0.113.2"))

    assert "203.0.113.1" not in main._rate_hits
    assert list(main._rate_hits) == ["203.0.113.2"]


def test_returning_client_starts_fresh_after_window(clock: _Clock) -> None:
    client = _client("203.0.113.1")
    assert [_research(client) for _ in range(3)] == [200, 200, 200]

    clock.advance(DAY)
    assert _research(client) == 200
    assert main._rate_hits["203.0.113.1"] == [clock.now]


def test_key_dropped_when_pruned_list_is_empty_and_request_rejected(
    monkeypatch: pytest.MonkeyPatch, clock: _Clock
) -> None:
    client = _client("203.0.113.1")
    assert _research(client) == 200

    clock.advance(DAY)
    monkeypatch.setattr(main, "RATE_LIMIT_PER_HOUR", 0)
    assert _research(client) == 429
    assert "203.0.113.1" not in main._rate_hits


def test_size_cap_evicts_least_recently_active(
    monkeypatch: pytest.MonkeyPatch, clock: _Clock
) -> None:
    monkeypatch.setattr(main, "RATE_LIMIT_MAX_CLIENTS", 3)

    for host in ("203.0.113.1", "203.0.113.2", "203.0.113.3"):
        assert _research(_client(host)) == 200
        clock.advance(1)

    # A fresh hit moves .1 to the back, so .2 is now the oldest.
    assert _research(_client("203.0.113.1")) == 200
    clock.advance(1)
    assert _research(_client("203.0.113.4")) == 200

    assert list(main._rate_hits) == ["203.0.113.3", "203.0.113.1", "203.0.113.4"]


def test_spoofed_forwarded_for_ignored_when_proxy_untrusted() -> None:
    # Mirrors the Dockerfile default: FORWARDED_ALLOW_IPS is empty.
    app = ProxyHeadersMiddleware(main.app, trusted_hosts="")
    client = _client("203.0.113.1", app=app)

    statuses = [
        _research(client, headers={"X-Forwarded-For": f"198.51.100.{n}"}) for n in range(4)
    ]

    assert statuses == [200, 200, 200, 429]
    assert list(main._rate_hits) == ["203.0.113.1"]


def test_trusted_proxy_keys_on_real_client_not_spoofed_prefix() -> None:
    # The platform edge appends the real client to whatever the caller sent.
    app = ProxyHeadersMiddleware(main.app, trusted_hosts="192.0.2.0/24")
    proxy = _client("192.0.2.10", app=app)

    statuses = [
        _research(proxy, headers={"X-Forwarded-For": f"198.51.100.{n}, 203.0.113.7"})
        for n in range(4)
    ]
    assert statuses == [200, 200, 200, 429]

    assert _research(proxy, headers={"X-Forwarded-For": "203.0.113.8"}) == 200
    assert set(main._rate_hits) == {"203.0.113.7", "203.0.113.8"}
