"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.fetchPokemon = fetchPokemon;
exports.fetchEvolutionChain = fetchEvolutionChain;
exports.assignRarity = assignRarity;
const https = require("https");
// ─── Helpers ─────────────────────────────────────────────────────────────────
function httpsGet(url) {
    return new Promise((resolve, reject) => {
        https
            .get(url, { headers: { 'User-Agent': 'pokecoding-vscode/0.1' } }, (res) => {
            let data = '';
            res.on('data', (chunk) => (data += chunk));
            res.on('end', () => {
                try {
                    resolve(JSON.parse(data));
                }
                catch (e) {
                    reject(e);
                }
            });
        })
            .on('error', reject);
    });
}
/** Extracts the trailing numeric ID from a PokéAPI species URL. */
function extractIdFromUrl(url) {
    const match = url.match(/\/(\d+)\/?$/);
    return match ? parseInt(match[1], 10) : 0;
}
/**
 * Recursively flattens the `chain` tree returned by the evolution-chain endpoint
 * into an ordered list of stages (base form first).
 */
function parseChainLinks(link) {
    const id = extractIdFromUrl(link.species.url);
    const rawLevel = link.evolution_details?.[0]?.min_level;
    const stage = {
        name: link.species.name,
        nationalId: id,
        minLevel: rawLevel ?? undefined,
    };
    const downstream = link.evolves_to.flatMap(parseChainLinks);
    return [stage, ...downstream];
}
// ─── Public API ──────────────────────────────────────────────────────────────
/** Fetches basic Pokémon data (sprite, types) from PokéAPI. */
async function fetchPokemon(id) {
    const data = (await httpsGet(`https://pokeapi.co/api/v2/pokemon/${id}`));
    const types = data.types.map((t) => t.type.name);
    const sprites = data.sprites;
    return {
        id: data.id,
        name: data.name,
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
async function fetchEvolutionChain(pokemonId) {
    try {
        const species = (await httpsGet(`https://pokeapi.co/api/v2/pokemon-species/${pokemonId}`));
        const chainUrl = species.evolution_chain?.url;
        if (!chainUrl) {
            return [];
        }
        const chainData = (await httpsGet(chainUrl));
        return parseChainLinks(chainData.chain);
    }
    catch {
        return [];
    }
}
/** Returns a random rarity label using weighted probability. */
function assignRarity() {
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
//# sourceMappingURL=pokemonService.js.map