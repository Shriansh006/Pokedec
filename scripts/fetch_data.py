"""Fetch Pokemon #1-809 (Kanto -> Alola) names + types from PokeAPI and build src/data/pokemon.json.

Run:  python3 scripts/fetch_data.py

Names come from the REST list endpoint. Types come from the PokeAPI GraphQL
endpoint in a single request, falling back to concurrent REST calls if that fails.
"""
import json
import pathlib
import urllib.request
from concurrent.futures import ThreadPoolExecutor

MAX_DEX = 809  # Alola (Gen 7) ends at #809
USER_AGENT = "pokemon-quiz-setup/1.0"

SPRITE_BASE = "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon"
SHOWDOWN_BASE = SPRITE_BASE + "/other/showdown"
ARTWORK_BASE = SPRITE_BASE + "/other/official-artwork"

GRAPHQL_URL = "https://beta.pokeapi.co/graphql/v1beta"
REST_BASE = "https://pokeapi.co/api/v2"

GENERATIONS = [
    ("kanto", "Kanto", 1, 151),
    ("johto", "Johto", 152, 251),
    ("hoenn", "Hoenn", 252, 386),
    ("sinnoh", "Sinnoh", 387, 493),
    ("unova", "Unova", 494, 649),
    ("kalos", "Kalos", 650, 721),
    ("alola", "Alola", 722, 809),
]

# PokeAPI slugs that don't follow simple title-casing.
NAME_OVERRIDES = {
    "nidoran-f": "Nidoran\u2640",
    "nidoran-m": "Nidoran\u2642",
    "farfetchd": "Farfetch'd",
    "mr-mime": "Mr. Mime",
    "mime-jr": "Mime Jr.",
    "ho-oh": "Ho-Oh",
    "porygon-z": "Porygon-Z",
    "type-null": "Type: Null",
    "jangmo-o": "Jangmo-o",
    "hakamo-o": "Hakamo-o",
    "kommo-o": "Kommo-o",
    "tapu-koko": "Tapu Koko",
    "tapu-lele": "Tapu Lele",
    "tapu-bulu": "Tapu Bulu",
    "tapu-fini": "Tapu Fini",
    "flabebe": "Flab\u00e9b\u00e9",
    # base forms that PokeAPI slugs with a default-form suffix
    "deoxys-normal": "Deoxys",
    "wormadam-plant": "Wormadam",
    "giratina-altered": "Giratina",
    "shaymin-land": "Shaymin",
    "basculin-red-striped": "Basculin",
    "darmanitan-standard": "Darmanitan",
    "frillish-male": "Frillish",
    "jellicent-male": "Jellicent",
    "tornadus-incarnate": "Tornadus",
    "thundurus-incarnate": "Thundurus",
    "landorus-incarnate": "Landorus",
    "keldeo-ordinary": "Keldeo",
    "meloetta-aria": "Meloetta",
    "pyroar-male": "Pyroar",
    "meowstic-male": "Meowstic",
    "aegislash-shield": "Aegislash",
    "pumpkaboo-average": "Pumpkaboo",
    "gourgeist-average": "Gourgeist",
    "zygarde-50": "Zygarde",
    "oricorio-baile": "Oricorio",
    "lycanroc-midday": "Lycanroc",
    "wishiwashi-solo": "Wishiwashi",
    "minior-red-meteor": "Minior",
    "mimikyu-disguised": "Mimikyu",
}


def display_name(slug: str) -> str:
    if slug in NAME_OVERRIDES:
        return NAME_OVERRIDES[slug]
    return " ".join(part.capitalize() for part in slug.split("-"))


def generation_for(dex: int):
    for key, label, lo, hi in GENERATIONS:
        if lo <= dex <= hi:
            return key, label
    raise ValueError(dex)


def _get_json(url: str):
    req = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
    with urllib.request.urlopen(req, timeout=60) as resp:
        return json.load(resp)


def fetch_names():
    payload = _get_json(f"{REST_BASE}/pokemon?limit={MAX_DEX}")
    return [entry["name"] for entry in payload["results"][:MAX_DEX]]


def fetch_types_graphql():
    query = """
    query {
      pokemon_v2_pokemon(limit: %d, order_by: {id: asc}, where: {id: {_lte: %d}}) {
        id
        pokemon_v2_pokemontypes(order_by: {slot: asc}) {
          pokemon_v2_type { name }
        }
      }
    }
    """ % (MAX_DEX, MAX_DEX)
    data = json.dumps({"query": query}).encode()
    req = urllib.request.Request(
        GRAPHQL_URL,
        data=data,
        headers={"Content-Type": "application/json", "User-Agent": USER_AGENT},
    )
    with urllib.request.urlopen(req, timeout=90) as resp:
        payload = json.load(resp)
    rows = payload["data"]["pokemon_v2_pokemon"]
    return {
        row["id"]: [t["pokemon_v2_type"]["name"] for t in row["pokemon_v2_pokemontypes"]]
        for row in rows
    }


def fetch_type_rest(dex: int):
    detail = _get_json(f"{REST_BASE}/pokemon/{dex}")
    ordered = sorted(detail["types"], key=lambda t: t["slot"])
    return dex, [t["type"]["name"] for t in ordered]


def fetch_types_rest():
    out = {}
    with ThreadPoolExecutor(max_workers=8) as pool:
        for dex, types in pool.map(fetch_type_rest, range(1, MAX_DEX + 1)):
            out[dex] = types
    return out


def fetch_types():
    try:
        types = fetch_types_graphql()
        if len(types) >= MAX_DEX:
            return types
        print(f"GraphQL returned {len(types)} entries, falling back to REST")
    except Exception as exc:  # noqa: BLE001 - best-effort fallback
        print(f"GraphQL fetch failed ({exc}); falling back to REST")
    return fetch_types_rest()


def main():
    slugs = fetch_names()
    if len(slugs) != MAX_DEX:
        raise SystemExit(f"Expected {MAX_DEX} names, got {len(slugs)}")
    types_by_dex = fetch_types()

    pokemon = []
    for dex, slug in enumerate(slugs, start=1):
        gen_key, gen_label = generation_for(dex)
        pokemon.append(
            {
                "id": dex,
                "name": display_name(slug),
                "slug": slug,
                "gen": gen_key,
                "genName": gen_label,
                "types": types_by_dex.get(dex, []),
                "sprite": f"{SPRITE_BASE}/{dex}.png",
                "animated": f"{SHOWDOWN_BASE}/{dex}.gif",
                "artwork": f"{ARTWORK_BASE}/{dex}.png",
            }
        )

    generations = [
        {"key": key, "name": label, "first": lo, "last": hi, "count": hi - lo + 1}
        for key, label, lo, hi in GENERATIONS
    ]

    out = {
        "source": "https://pokeapi.co (names, types) / https://github.com/PokeAPI/sprites (images)",
        "typeColors": TYPE_COLORS,
        "maxDex": MAX_DEX,
        "count": len(pokemon),
        "generations": generations,
        "pokemon": pokemon,
    }

    root = pathlib.Path(__file__).resolve().parent.parent
    dest = root / "src" / "data" / "pokemon.json"
    dest.parent.mkdir(parents=True, exist_ok=True)
    dest.write_text(json.dumps(out, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"Wrote {dest} ({len(pokemon)} Pokemon)")


TYPE_COLORS = {
    "normal": "#a8a878",
    "fire": "#f08030",
    "water": "#6890f0",
    "electric": "#f8d030",
    "grass": "#78c850",
    "ice": "#98d8d8",
    "fighting": "#c03028",
    "poison": "#a040a0",
    "ground": "#e0c068",
    "flying": "#a890f0",
    "psychic": "#f85888",
    "bug": "#a8b820",
    "rock": "#b8a038",
    "ghost": "#705898",
    "dragon": "#7038f8",
    "dark": "#705848",
    "steel": "#b8b8d0",
    "fairy": "#ee99ac",
}


if __name__ == "__main__":
    main()
