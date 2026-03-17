#!/usr/bin/env python3
"""
Play-by-play backfill (ESPN summary API) with threaded workers + tqdm progress.

Usage:
  python scripts/backfill_nba_playbyplay.py
  python scripts/backfill_nba_playbyplay.py --sport nfl --season 2024
  python scripts/backfill_nba_playbyplay.py --season 2024 --workers 12
  python scripts/backfill_nba_playbyplay.py --limit 50
  python scripts/backfill_nba_playbyplay.py --game-id <game_uuid> --force

Requires: .env with EXPO_PUBLIC_SUPABASE_URL (or SUPABASE_URL) + SUPABASE_SERVICE_ROLE_KEY
"""

from __future__ import annotations

import argparse
import os
import threading
import time
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import datetime, timedelta, timezone
from typing import Any, Callable
from zoneinfo import ZoneInfo

import requests
from dotenv import load_dotenv
from supabase import Client, create_client
from tqdm import tqdm

load_dotenv()

SUPABASE_URL = os.environ.get("SUPABASE_URL") or os.environ.get("EXPO_PUBLIC_SUPABASE_URL")
SUPABASE_SERVICE_KEY = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")

if not SUPABASE_URL or not SUPABASE_SERVICE_KEY:
    raise SystemExit("Missing EXPO_PUBLIC_SUPABASE_URL (or SUPABASE_URL) or SUPABASE_SERVICE_ROLE_KEY in .env")

SPORT_CONFIG: dict[str, dict[str, Any]] = {
    "nba": {
        "label": "NBA",
        "summary_url": "https://site.api.espn.com/apis/site/v2/sports/basketball/nba/summary",
        "scoreboard_url": "https://site.api.espn.com/apis/site/v2/sports/basketball/nba/scoreboard",
        "season_start_month": 10,
        "season_start_day": 1,
        "season_end_month": 7,
        "season_end_day": 1,
        "season_rollover_month": 10,
    },
    "nfl": {
        "label": "NFL",
        "summary_url": "https://site.api.espn.com/apis/site/v2/sports/football/nfl/summary",
        "scoreboard_url": "https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard",
        "season_start_month": 8,
        "season_start_day": 1,
        "season_end_month": 3,
        "season_end_day": 1,
        "season_rollover_month": 9,
    },
}

HEADERS = {"User-Agent": "nba-letterbox/1.0"}
_thread_local = threading.local()

NBA_ABBR_CANONICAL_MAP: dict[str, str] = {
    "GS": "GSW",
    "GSW": "GSW",
    "NY": "NYK",
    "NYK": "NYK",
    "SA": "SAS",
    "SAS": "SAS",
    "NO": "NOP",
    "NOP": "NOP",
    "UTAH": "UTA",
    "UTA": "UTA",
    "WSH": "WAS",
    "WAS": "WAS",
}


class EspnScoreboardCache:
    def __init__(self) -> None:
        self._cache: dict[str, list[dict[str, Any]]] = {}
        self._lock = threading.Lock()

    def get(self, date_key: str) -> list[dict[str, Any]] | None:
        with self._lock:
            return self._cache.get(date_key)

    def set(self, date_key: str, events: list[dict[str, Any]]) -> None:
        with self._lock:
            self._cache[date_key] = events


def get_supabase() -> Client:
    client = getattr(_thread_local, "supabase", None)
    if client is None:
        client = create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)
        _thread_local.supabase = client
    return client


def sleep(ms: int) -> None:
    time.sleep(max(0, ms) / 1000.0)


def chunked(items: list[str], size: int) -> list[list[str]]:
    return [items[i:i + size] for i in range(0, len(items), size)]


def error_message(err: Any) -> str:
    if isinstance(err, Exception):
        return str(err) or err.__class__.__name__
    return str(err)


def is_retryable_network_error(err: Exception) -> bool:
    msg = error_message(err).lower()
    return (
        "fetch failed" in msg
        or "econnreset" in msg
        or "etimedout" in msg
        or "enotfound" in msg
        or "network" in msg
        or "connection" in msg
        or "timeout" in msg
    )


def with_retry(label: str, fn: Callable[[], Any], max_attempts: int = 3) -> Any:
    last_err: Exception | None = None
    for attempt in range(1, max_attempts + 1):
        try:
            return fn()
        except Exception as err:
            last_err = err
            if attempt == max_attempts:
                break
            if not is_retryable_network_error(err):
                break
            print(f"{label} attempt {attempt}/{max_attempts} failed: {error_message(err)}")
            time.sleep(0.4 * attempt)
    raise RuntimeError(f"{label} failed: {error_message(last_err)}")


def get_sport_config(sport: str) -> dict[str, Any]:
    normalized = (sport or "").strip().lower()
    config = SPORT_CONFIG.get(normalized)
    if not config:
        raise ValueError(f"Unsupported sport '{sport}'")
    return config


def get_current_season_year(sport: str) -> int:
    config = get_sport_config(sport)
    now_et = datetime.now(ZoneInfo("America/New_York"))
    rollover_month = int(config["season_rollover_month"])
    return now_et.year if now_et.month >= rollover_month else now_et.year - 1


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Play-by-play backfill (threaded)")
    parser.add_argument("--sport", type=str, default="nba", choices=["nba", "nfl"])
    parser.add_argument("--season", type=int, default=None)
    parser.add_argument("--limit", type=int, default=0)
    parser.add_argument("--game-id", type=str, default=None)
    parser.add_argument("--force", action="store_true")
    parser.add_argument("--delay-ms", type=int, default=0)
    parser.add_argument("--workers", type=int, default=8)
    return parser.parse_args()


def extract_team_abbreviation(team_ref: Any) -> str | None:
    if not team_ref:
        return None
    if isinstance(team_ref, list):
        if not team_ref:
            return None
        first = team_ref[0]
        if isinstance(first, dict):
            abbr = first.get("abbreviation")
            return str(abbr) if abbr else None
        return None
    if isinstance(team_ref, dict):
        abbr = team_ref.get("abbreviation")
        return str(abbr) if abbr else None
    return None


def normalize_nba_abbreviation(abbr: str | None) -> str:
    key = (abbr or "").strip().upper()
    if not key:
        return ""
    return NBA_ABBR_CANONICAL_MAP.get(key, key)


def normalize_team_abbreviation(abbr: str | None, sport: str) -> str:
    key = (abbr or "").strip().upper()
    if not key:
        return ""
    if sport == "nba":
        return normalize_nba_abbreviation(key)
    return key


def parse_game_date(game_date_utc: str) -> datetime | None:
    if not game_date_utc:
        return None
    try:
        if game_date_utc.endswith("Z"):
            return datetime.fromisoformat(game_date_utc.replace("Z", "+00:00")).astimezone(timezone.utc)
        dt = datetime.fromisoformat(game_date_utc)
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=timezone.utc)
        return dt.astimezone(timezone.utc)
    except ValueError:
        return None


def format_date_key_utc(dt: datetime) -> str:
    return dt.astimezone(timezone.utc).strftime("%Y%m%d")


def format_date_key_et(dt: datetime) -> str:
    return dt.astimezone(ZoneInfo("America/New_York")).strftime("%Y%m%d")


def shift_date_key(date_key: str, days: int) -> str:
    dt = datetime.strptime(date_key, "%Y%m%d").replace(tzinfo=timezone.utc) + timedelta(days=days)
    return format_date_key_utc(dt)


def get_candidate_date_keys(game_date_utc: str) -> list[str]:
    game_dt = parse_game_date(game_date_utc)
    if game_dt is None:
        return []

    utc_key = format_date_key_utc(game_dt)
    et_key = format_date_key_et(game_dt)

    date_keys = [
        et_key,
        utc_key,
        shift_date_key(et_key, -1),
        shift_date_key(et_key, 1),
        shift_date_key(utc_key, -1),
        shift_date_key(utc_key, 1),
    ]

    # Keep order but dedupe.
    seen: set[str] = set()
    unique_keys: list[str] = []
    for key in date_keys:
        if key in seen:
            continue
        seen.add(key)
        unique_keys.append(key)
    return unique_keys


def fetch_scoreboard_events(
    date_key: str,
    cache: EspnScoreboardCache,
    scoreboard_url: str,
) -> list[dict[str, Any]]:
    cached = cache.get(date_key)
    if cached is not None:
        return cached

    max_attempts = 3
    for attempt in range(1, max_attempts + 1):
        try:
            res = requests.get(
                scoreboard_url,
                params={"dates": date_key},
                headers=HEADERS,
                timeout=20,
            )
            if not res.ok:
                should_retry = res.status_code == 429 or res.status_code >= 500
                if should_retry and attempt < max_attempts:
                    time.sleep(0.3 * attempt)
                    continue
                raise RuntimeError(f"ESPN scoreboard {date_key} returned {res.status_code}")

            payload = res.json()
            events = payload.get("events")
            if not isinstance(events, list):
                events = []
            cache.set(date_key, events)
            return events
        except Exception:
            if attempt < max_attempts:
                time.sleep(0.3 * attempt)
                continue
            raise

    return []


def resolve_espn_event_id(
    game_date_utc: str,
    home_team_abbr: str,
    away_team_abbr: str,
    sport: str,
    cache: EspnScoreboardCache,
) -> int | None:
    sport_key = (sport or "").strip().lower()
    home_target = normalize_team_abbreviation(home_team_abbr, sport_key)
    away_target = normalize_team_abbreviation(away_team_abbr, sport_key)
    scoreboard_url = str(get_sport_config(sport_key)["scoreboard_url"])

    for date_key in get_candidate_date_keys(game_date_utc):
        try:
            events = fetch_scoreboard_events(date_key, cache, scoreboard_url)
        except Exception:
            continue

        for event in events:
            competitions = event.get("competitions")
            if not isinstance(competitions, list) or not competitions:
                continue
            first_competition = competitions[0] if isinstance(competitions[0], dict) else {}
            competitors = first_competition.get("competitors")
            if not isinstance(competitors, list):
                continue

            home = next((c for c in competitors if c.get("homeAway") == "home"), None)
            away = next((c for c in competitors if c.get("homeAway") == "away"), None)

            home_abbr = normalize_team_abbreviation((home or {}).get("team", {}).get("abbreviation"), sport_key)
            away_abbr = normalize_team_abbreviation((away or {}).get("team", {}).get("abbreviation"), sport_key)
            if home_abbr != home_target or away_abbr != away_target:
                continue

            try:
                event_id = int(str(event.get("id") or ""))
                return event_id
            except ValueError:
                continue

    return None


def to_clock_value(clock: Any) -> str:
    if isinstance(clock, dict):
        display = clock.get("displayValue")
        if isinstance(display, str):
            return display
    if isinstance(clock, str):
        return clock
    if isinstance(clock, dict):
        value = clock.get("value")
        if isinstance(value, (int, float)):
            total_seconds = max(0, int(round(value)))
            minutes = total_seconds // 60
            seconds = total_seconds % 60
            return f"{minutes}:{seconds:02d}"
    return ""


def to_period_value(period: Any) -> int:
    if isinstance(period, dict):
        number = period.get("number")
        if isinstance(number, (int, float)):
            return int(number)
        value = period.get("value")
        if isinstance(value, (int, float)):
            return int(value)
    if isinstance(period, (int, float)):
        return int(period)
    return 0


def infer_shot_result(play: dict[str, Any]) -> str | None:
    if play.get("scoringPlay"):
        return "Made"
    text = str(play.get("text") or "").lower()
    if not text:
        return None
    if "misses" in text or "missed" in text:
        return "Missed"
    if "makes" in text or "made" in text:
        return "Made"
    return None


def extract_player_name(play: dict[str, Any]) -> str:
    participants = play.get("participants")
    if not isinstance(participants, list):
        return ""
    for participant in participants:
        athlete = participant.get("athlete") if isinstance(participant, dict) else None
        display_name = athlete.get("displayName") if isinstance(athlete, dict) else None
        if isinstance(display_name, str) and display_name:
            return display_name
    return ""


def extract_nfl_plays_from_drives(summary: dict[str, Any]) -> list[dict[str, Any]]:
    drives = summary.get("drives")
    if not isinstance(drives, dict):
        return []

    extracted: list[dict[str, Any]] = []
    previous = drives.get("previous")
    if isinstance(previous, list):
        for drive in previous:
            if not isinstance(drive, dict):
                continue
            drive_plays = drive.get("plays")
            if not isinstance(drive_plays, list):
                continue
            extracted.extend(play for play in drive_plays if isinstance(play, dict))

    current = drives.get("current")
    if isinstance(current, dict):
        drive_plays = current.get("plays")
        if isinstance(drive_plays, list):
            extracted.extend(play for play in drive_plays if isinstance(play, dict))

    return extracted


def parse_espn_play_by_play_actions(summary: dict[str, Any], sport: str) -> list[dict[str, Any]]:
    sport_key = (sport or "").strip().lower()

    if sport_key == "nfl":
        plays = extract_nfl_plays_from_drives(summary)
    else:
        plays = summary.get("plays")
        if not isinstance(plays, list):
            plays = []

    actions: list[dict[str, Any]] = []
    for index, play in enumerate(plays, start=1):
        if not isinstance(play, dict):
            continue

        action_number_candidate = play.get("sequenceNumber", play.get("id", index))
        try:
            action_number = int(action_number_candidate)
        except (TypeError, ValueError):
            action_number = index

        description = str(play.get("text") or play.get("shortText") or "").strip()
        if not description:
            continue

        play_type = play.get("type")
        action_type = ""
        if isinstance(play_type, dict):
            action_type = str(play_type.get("text") or play_type.get("name") or "")

        team_data = play.get("team")
        team_tricode = str(team_data.get("abbreviation") or "") if isinstance(team_data, dict) else ""

        action: dict[str, Any] = {
            "actionNumber": action_number,
            "clock": to_clock_value(play.get("clock")),
            "period": to_period_value(play.get("period")),
            "teamTricode": team_tricode,
            "playerName": extract_player_name(play),
            "description": description,
            "actionType": action_type,
            "scoreHome": "" if play.get("homeScore") is None else str(play.get("homeScore")),
            "scoreAway": "" if play.get("awayScore") is None else str(play.get("awayScore")),
            "isFieldGoal": bool(play.get("scoringPlay")),
        }
        shot_result = infer_shot_result(play)
        if shot_result:
            action["shotResult"] = shot_result
        actions.append(action)

    actions.sort(key=lambda action: action["actionNumber"])
    return actions


def fetch_summary_actions(provider_game_id: int, sport: str) -> list[dict[str, Any]] | None:
    summary_url = str(get_sport_config(sport)["summary_url"])
    max_attempts = 3
    for attempt in range(1, max_attempts + 1):
        try:
            res = requests.get(
                summary_url,
                params={"event": provider_game_id},
                headers=HEADERS,
                timeout=20,
            )
            if res.ok:
                summary = res.json()
                if not isinstance(summary, dict):
                    return []
                return parse_espn_play_by_play_actions(summary, sport)

            if res.status_code == 404:
                return []

            should_retry = res.status_code == 429 or res.status_code >= 500
            if should_retry and attempt < max_attempts:
                time.sleep(0.4 * attempt)
                continue

            return None
        except requests.RequestException as err:
            if attempt < max_attempts and is_retryable_network_error(err):
                time.sleep(0.4 * attempt)
                continue
            return None
    return None


def load_games(args: argparse.Namespace) -> list[dict[str, Any]]:
    supabase = get_supabase()
    sport = str(args.sport).lower()
    config = get_sport_config(sport)
    select_fields = (
        "id, provider, provider_game_id, game_date_utc, status, "
        "home_team:teams!games_home_team_id_fkey(abbreviation), "
        "away_team:teams!games_away_team_id_fkey(abbreviation)"
    )

    if args.game_id:
        res = (
            supabase.table("games")
            .select(select_fields)
            .eq("id", args.game_id)
            .eq("sport", sport)
            .limit(1)
            .execute()
        )
        return list(res.data or [])

    season_start_month = int(config["season_start_month"])
    season_start_day = int(config["season_start_day"])
    season_end_month = int(config["season_end_month"])
    season_end_day = int(config["season_end_day"])
    end_year = args.season
    if (season_end_month, season_end_day) <= (season_start_month, season_start_day):
        end_year += 1

    start_iso = datetime(args.season, season_start_month, season_start_day, tzinfo=timezone.utc).isoformat()
    end_iso = datetime(end_year, season_end_month, season_end_day, tzinfo=timezone.utc).isoformat()

    query = (
        supabase.table("games")
        .select(select_fields)
        .eq("sport", sport)
        .gte("game_date_utc", start_iso)
        .lt("game_date_utc", end_iso)
        .eq("status", "final")
        .order("game_date_utc", desc=False)
    )

    if args.limit > 0:
        query = query.limit(args.limit)

    res = query.execute()
    return list(res.data or [])


def load_existing_game_ids(game_ids: list[str]) -> set[str]:
    existing: set[str] = set()
    if not game_ids:
        return existing

    supabase = get_supabase()
    for game_id_chunk in chunked(game_ids, 100):
        res = (
            supabase.table("game_play_by_play")
            .select("game_id")
            .in_("game_id", game_id_chunk)
            .execute()
        )
        for row in res.data or []:
            game_id = row.get("game_id")
            if game_id:
                existing.add(str(game_id))
    return existing


def process_game(
    game: dict[str, Any],
    sport: str,
    delay_ms: int,
    scoreboard_cache: EspnScoreboardCache,
) -> dict[str, Any]:
    game_id = str(game.get("id") or "")
    provider = str(game.get("provider") or "").lower()
    game_date_utc = str(game.get("game_date_utc") or "")

    try:
        provider_game_id = game.get("provider_game_id")
        espn_event_id: int | None = int(provider_game_id) if provider == "espn" and provider_game_id is not None else None

        if espn_event_id is None:
            home_abbr = extract_team_abbreviation(game.get("home_team"))
            away_abbr = extract_team_abbreviation(game.get("away_team"))
            if home_abbr and away_abbr:
                espn_event_id = resolve_espn_event_id(
                    game_date_utc=game_date_utc,
                    home_team_abbr=home_abbr,
                    away_team_abbr=away_abbr,
                    sport=sport,
                    cache=scoreboard_cache,
                )

        if not espn_event_id:
            return {
                "game_id": game_id,
                "saved": False,
                "failed": True,
                "actions_count": 0,
                "error": "Could not resolve ESPN event id",
            }

        actions = fetch_summary_actions(espn_event_id, sport)
        if actions is None:
            return {
                "game_id": game_id,
                "saved": False,
                "failed": True,
                "actions_count": 0,
                "error": f"Failed to fetch ESPN summary for event {espn_event_id}",
            }

        now_iso = datetime.now(timezone.utc).isoformat()
        payload = {
            "game_id": game_id,
            "provider": "espn",
            "provider_game_id": espn_event_id,
            "sport": sport,
            "actions": actions,
            "action_count": len(actions),
            "fetched_at": now_iso,
            "updated_at": now_iso,
        }
        get_supabase().table("game_play_by_play").upsert(payload, on_conflict="game_id").execute()

        if delay_ms > 0:
            sleep(delay_ms)

        return {
            "game_id": game_id,
            "saved": True,
            "failed": False,
            "actions_count": len(actions),
            "error": None,
            "provider_game_id": espn_event_id,
        }
    except Exception as err:
        if delay_ms > 0:
            sleep(delay_ms)
        return {
            "game_id": game_id,
            "saved": False,
            "failed": True,
            "actions_count": 0,
            "error": error_message(err),
        }


def main() -> None:
    args = parse_args()
    sport = str(args.sport or "nba").lower()
    config = get_sport_config(sport)
    if args.season is None:
        args.season = get_current_season_year(sport) - 1
    workers = max(1, int(args.workers))

    print(f"{config['label']} play-by-play backfill starting...\n")
    print(f"Sport: {sport}")
    print(f"Season: {args.season}{' (ignored due to --game-id)' if args.game_id else ''}")
    print(f"Force refresh: {'yes' if args.force else 'no'}")
    print(f"Workers: {workers}")
    print(f"Delay per game: {max(0, int(args.delay_ms))}ms\n")

    games = with_retry("Loading games from Supabase", lambda: load_games(args))
    if not games:
        print(f"No target {config['label']} games found.")
        return

    existing = (
        set()
        if args.force
        else with_retry(
            "Loading existing play-by-play rows",
            lambda: load_existing_game_ids([str(game.get("id")) for game in games if game.get("id")]),
        )
    )
    games_to_process = games if args.force else [game for game in games if str(game.get("id")) not in existing]

    print(f"Found {len(games)} game(s); {len(games_to_process)} need backfill.\n")
    if not games_to_process:
        return

    saved = 0
    failed = 0
    total_actions = 0
    scoreboard_cache = EspnScoreboardCache()

    with ThreadPoolExecutor(max_workers=workers) as executor:
        futures = {
            executor.submit(process_game, game, sport, int(args.delay_ms), scoreboard_cache): game
            for game in games_to_process
        }
        with tqdm(total=len(games_to_process), desc=f"Backfilling {config['label']} PBP", unit="game") as progress:
            for future in as_completed(futures):
                game = futures[future]
                game_id = str(game.get("id") or "")

                try:
                    result = future.result()
                except Exception as err:
                    failed += 1
                    tqdm.write(f"{game_id} failed: {error_message(err)}")
                    progress.update(1)
                    progress.set_postfix(saved=saved, failed=failed, actions=total_actions)
                    continue

                if result.get("saved"):
                    saved += 1
                    total_actions += int(result.get("actions_count") or 0)
                else:
                    failed += 1
                    err = result.get("error")
                    if err:
                        tqdm.write(f"{game_id} failed: {err}")

                progress.update(1)
                progress.set_postfix(saved=saved, failed=failed, actions=total_actions)

    print("\nBackfill complete.")
    print(f"Saved games: {saved}")
    print(f"Failed games: {failed}")
    print(f"Total actions stored: {total_actions}")


if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        raise SystemExit("\nInterrupted by user.")
    except Exception as err:
        print(f"Unhandled error: {error_message(err)}")
        raise SystemExit(1)
