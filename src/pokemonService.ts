import * as https from 'https';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface EvolutionStage {
  name: string;
  nationalId: number;
  minLevel?: number;
}

export interface PokemonData {
  id: number;
  name: string;
  sprite: string;
  types: string[];
}

export interface OwnedPokemon {
  id: number;
  name: string;
  sprite: string;
  types: string[];
  rarity: string;
  xp: number;
  /** National ID of the next evolution form, if any. */
  evolvesIntoId?: number;
  /** Total XP needed to trigger evolution. */
  xpToEvolve?: number;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function httpsGet(url: string): Promise<unknown> {
  return new Promise((resolve, reject) => {
    https
      .get(url, { headers: { 'User-Agent': 'pokecoding-vscode/0.1' } }, (res) => {
        let data = '';
        res.on('data', (chunk: string) => (data += chunk));
        res.on('end', () => {
          try {
            resolve(JSON.parse(data));
          } catch (e) {
            reject(e);
          }
        });
      })
      .on('error', reject);
  });
}

/** Extracts the trailing numeric ID from a PokéAPI species URL. */
function extractIdFromUrl(url: string): number {
  const match = url.match(/\/(\d+)\/?$/);
  return match ? parseInt(match[1], 10) : 0;
}

// ─── Evolution-chain parser ───────────────────────────────────────────────────

interface ChainLink {
  species: { name: string; url: string };
  evolution_details: Array<{ min_level: number | null }>;
  evolves_to: ChainLink[];
}

/**
 * Recursively flattens the `chain` tree returned by the evolution-chain endpoint
 * into an ordered list of stages (base form first).
 */
function parseChainLinks(link: ChainLink): EvolutionStage[] {
  const id = extractIdFromUrl(link.species.url);
  const rawLevel = link.evolution_details?.[0]?.min_level;
  const stage: EvolutionStage = {
    name: link.species.name,
    nationalId: id,
    minLevel: rawLevel ?? undefined,
  };

  const downstream = link.evolves_to.flatMap(parseChainLinks);
  return [stage, ...downstream];
}

// ─── Public API ──────────────────────────────────────────────────────────────

/** Fetches basic Pokémon data (sprite, types) from PokéAPI. */
export async function fetchPokemon(id: number): Promise<PokemonData> {
  const data = (await httpsGet(`https://pokeapi.co/api/v2/pokemon/${id}`)) as Record<string, unknown>;
  const types = (data.types as Array<{ type: { name: string } }>).map((t) => t.type.name);
  const sprites = data.sprites as Record<string, string>;
  return {
    id: data.id as number,
    name: data.name as string,
    sprite: sprites?.front_default ?? '',
    types,
  };
}

/**
 * Fetches the full evolution chain for a given national ID.
 * Returns an empty array on any error (silent fallback).
 *
 * Flow:
 *   1. GET /pokemon-species/{id}        → extracts evolution_chain.url
 *   2. GET <evolution_chain.url>        → parses `chain` tree recursively
 */
export async function fetchEvolutionChain(pokemonId: number): Promise<EvolutionStage[]> {
  try {
    const species = (await httpsGet(
      `https://pokeapi.co/api/v2/pokemon-species/${pokemonId}`
    )) as Record<string, unknown>;

    const chainUrl = (species.evolution_chain as { url: string } | null)?.url;
    if (!chainUrl) {
      return [];
    }

    const chainData = (await httpsGet(chainUrl)) as { chain: ChainLink };
    return parseChainLinks(chainData.chain);
  } catch {
    return [];
  }
}

/** Returns a random rarity label using weighted probability. */
export function assignRarity(): string {
  const roll = Math.random();
  if (roll < 0.03) {
    return 'legendary';
  }
  if (roll < 0.15) {
    return 'rare';
  }
  if (roll < 0.40) {
    return 'uncommon';
  }
  return 'common';
}
