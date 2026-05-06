import { Rarity, OwnedPokemon } from './models';

const MYTHICALS = [151, 251, 385, 386, 490, 491, 492, 493, 494, 647, 648, 649,
  719, 720, 721, 801, 802, 807, 808, 809, 893];
const LEGENDARIES = [144, 145, 146, 150, 243, 244, 245, 249, 250,
  377, 378, 379, 380, 381, 382, 383, 384,
  480, 481, 482, 483, 484, 485, 486, 487, 488,
  638, 639, 640, 641, 642, 643, 644, 645, 646,
  716, 717, 718, 785, 786, 787, 788, 789, 790, 791, 792, 800,
  888, 889, 890, 891, 892, 894, 895, 896, 897, 898];
const PSEUDOS = [147, 148, 149, 246, 247, 248, 371, 372, 373,
  443, 444, 445, 610, 611, 612, 704, 705, 706,
  782, 783, 784, 884, 885, 886, 887];
const STARTERS = [1, 4, 7, 152, 155, 158, 252, 255, 258,
  387, 390, 393, 495, 498, 501, 650, 653, 656,
  722, 725, 728, 810, 813, 816, 906, 909, 912];

export function getGeneration(id: number): number {
  if (id <= 151) return 1;
  if (id <= 251) return 2;
  if (id <= 386) return 3;
  if (id <= 493) return 4;
  if (id <= 649) return 5;
  if (id <= 721) return 6;
  if (id <= 809) return 7;
  if (id <= 905) return 8;
  return 9;
}

export function determineRarity(nationalId: number): Rarity {
  if (MYTHICALS.includes(nationalId))   return Rarity.Mythical;
  if (LEGENDARIES.includes(nationalId)) return Rarity.Legendary;
  if (PSEUDOS.includes(nationalId))     return Rarity.Epic;
  if (STARTERS.includes(nationalId))    return Rarity.Rare;

  const gen = getGeneration(nationalId);
  if (gen <= 2) return Rarity.Common;
  if (gen <= 4) return Rarity.Uncommon;
  return Rarity.Rare;
}

export function rollPokemonId(): number {
  const roll = Math.random() * 100;
  let targetRarity: Rarity;
  if      (roll < 1)  targetRarity = Rarity.Mythical;
  else if (roll < 5)  targetRarity = Rarity.Legendary;
  else if (roll < 12) targetRarity = Rarity.Epic;
  else if (roll < 25) targetRarity = Rarity.Rare;
  else if (roll < 50) targetRarity = Rarity.Uncommon;
  else                targetRarity = Rarity.Common;

  for (let i = 0; i < 200; i++) {
    const id = Math.floor(Math.random() * 1025) + 1;
    if (determineRarity(id) === targetRarity) return id;
  }
  return Math.floor(Math.random() * 151) + 1; // fallback Gen I
}

export function rollShiny(): boolean {
  return Math.floor(Math.random() * 512) === 0; // 1/512
}

function capitalizeName(name: string): string {
  return name
    .split('-')
    .map(part => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

interface PokeApiPokemon {
  id: number;
  name: string;
  types: Array<{ type: { name: string } }>;
  sprites: {
    front_default: string | null;
    front_shiny: string | null;
  };
}

export class PokemonService {
  private cache = new Map<number, OwnedPokemon>();

  async fetchPokemon(id: number): Promise<OwnedPokemon> {
    const cached = this.cache.get(id);
    if (cached) {
      // Return a fresh copy with updated shiny/caughtAt
      const isShiny = rollShiny();
      return { ...cached, isShiny, caughtAt: Date.now() };
    }

    try {
      const response = await fetch(`https://pokeapi.co/api/v2/pokemon/${id}`);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      const data = (await response.json()) as PokeApiPokemon;

      const name = capitalizeName(data.name);
      const type1 = data.types[0]?.type.name ?? 'normal';
      const type2 = data.types[1]?.type.name ?? '';
      const rarity = determineRarity(id);
      const generation = getGeneration(id);
      const isShiny = rollShiny();

      const spriteUrl = `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/showdown/${id}.gif`;
      const shinySpriteUrl = `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/showdown/shiny/${id}.gif`;
      const fallbackUrl = data.sprites.front_default ?? `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/${id}.png`;

      const pokemon: OwnedPokemon = {
        nationalId: id,
        name,
        type1,
        type2,
        rarity,
        isShiny,
        generation,
        spriteUrl,
        shinySpriteUrl,
        fallbackUrl,
        pokemonName: data.name,
        caughtAt: Date.now()
      };

      // Cache a base version (shiny flag will be re-rolled per capture)
      this.cache.set(id, { ...pokemon, isShiny: false });
      return pokemon;
    } catch {
      // Fallback silencieux en cas d'erreur réseau
      const isShiny = rollShiny();
      return {
        nationalId: id,
        name: 'Pokémon inconnu',
        type1: 'normal',
        type2: '',
        rarity: determineRarity(id),
        isShiny,
        generation: getGeneration(id),
        spriteUrl: '',
        shinySpriteUrl: '',
        fallbackUrl: '',
        pokemonName: `pokemon-${id}`,
        caughtAt: Date.now()
      };
    }
  }
}
