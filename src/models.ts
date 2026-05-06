export enum Rarity {
  Common = "Common",
  Uncommon = "Uncommon",
  Rare = "Rare",
  Epic = "Epic",
  Legendary = "Legendary",
  Mythical = "Mythical"
}

export interface OwnedPokemon {
  nationalId: number;
  name: string;          // capitalisé (ex: "Bulbizarre")
  type1: string;
  type2: string;         // "" si mono-type
  rarity: Rarity;
  isShiny: boolean;
  generation: number;    // 1..9
  spriteUrl: string;     // GIF animé normal
  shinySpriteUrl: string; // GIF animé shiny
  fallbackUrl: string;   // PNG statique
  pokemonName: string;   // nom slug lowercase pour Showdown (ex: "bulbasaur")
  caughtAt: number;      // Date.now()
}

export interface PokedexEntry {
  nationalId: number;
  name: string;
  type1: string;
  type2: string;
  generation: number;
  caught: boolean;
  caughtShiny: boolean;
  spriteUrl: string;
}

export interface SaveData {
  playerName: string;
  totalXp: number;
  pendingXp: number;            // XP depuis dernier tirage (reset à 0 à chaque capture)
  collection: OwnedPokemon[];
  pokedex: PokedexEntry[];
  activePokemonId: number | null; // nationalId du compagnon affiché
}
