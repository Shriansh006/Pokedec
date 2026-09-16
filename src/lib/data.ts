import raw from "../data/pokemon.json";

export interface Pokemon {
  id: number;
  name: string;
  slug: string;
  gen: string;
  genName: string;
  types: string[];
  sprite: string;
  animated: string;
  artwork: string;
}

export interface Generation {
  key: string;
  name: string;
  first: number;
  last: number;
  count: number;
}

export interface PokemonData {
  source: string;
  typeColors: Record<string, string>;
  maxDex: number;
  count: number;
  generations: Generation[];
  pokemon: Pokemon[];
}

export const DATA = raw as unknown as PokemonData;
