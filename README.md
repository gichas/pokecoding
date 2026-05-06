# PokéCoding

A VS Code extension that lets you **catch and evolve Pokémon while you code**.  
Each time you save a file your companion gains XP — accumulate enough and it evolves!

---

## Features

| Feature | Description |
|---------|-------------|
| 🎣 **Capture** | Grab a random Pokémon from the full PokéAPI national dex (898 Pokémon) |
| 📈 **XP on save** | Every file save awards +100 XP to your active companion |
| ✨ **Auto-evolution** | At 1 000 XP your Pokémon evolves automatically, complete with a flash animation |
| 📖 **Pokédex** | All forms you've owned are recorded; view the list with one command |
| 🗂️ **Sidebar companion** | Always-visible panel shows sprite, types, rarity, XP bar, and the next evolution threshold |

---

## Usage

### Capture a Pokémon
Open the **Command Palette** (`Ctrl+Shift+P` / `Cmd+Shift+P`) and run:

```
PokéCoding: Capture a Pokémon
```

Your new companion appears in the **PokéCoding Companion** panel (Explorer sidebar).

### Gain XP
Just save any file (`Ctrl+S`). Each save gives **+100 XP**.

### Evolution
When your Pokémon reaches **1 000 XP** (10 saves) it automatically evolves:
- Sprite, name, and types are updated in the sidebar
- A flash animation plays
- The new form is added to your Pokédex

The companion panel shows a **▶ Évolue à X XP** badge whenever an evolution is pending.

### Pokédex
```
PokéCoding: Show Pokédex
```

Displays all national IDs you have ever captured or evolved into.

---

## Rarity

Each captured Pokémon is assigned a rarity at capture time:

| Rarity | Probability |
|--------|-------------|
| Common | 60 % |
| Uncommon | 25 % |
| Rare | 12 % |
| Legendary | 3 % |

---

## Evolution data

Evolution chains are fetched from [PokéAPI](https://pokeapi.co/):

1. `GET /pokemon-species/{id}` — retrieves the `evolution_chain` URL  
2. `GET <evolution_chain_url>` — the `evolves_to` tree is parsed recursively to get every stage (name + optional minimum level)  
3. The national ID is extracted from each species URL (e.g. `.../pokemon-species/4/` → `4`)

All network calls are wrapped in `try/catch`; if evolution data is unavailable the extension continues silently without an evolution.

---

## Requirements

- VS Code **1.80.0** or later  
- Internet connection (for PokéAPI calls)

---

## Extension Settings

No settings are exposed yet.  State (current Pokémon, Pokédex) is stored in VS Code's global state and persists across sessions.

---

## Development

```bash
npm install        # install devDependencies (TypeScript, @types/vscode)
npm run compile    # compile src/ → out/
npm run watch      # incremental compilation
```

Press **F5** in VS Code to launch the Extension Development Host.

---

## Credits

Pokémon data and sprites provided by [PokéAPI](https://pokeapi.co/) (free, open API).  
Pokémon and all related names are trademarks of Nintendo / Game Freak.
