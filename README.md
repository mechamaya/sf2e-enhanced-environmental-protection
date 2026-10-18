# SF2e Enhanced Environmental Protection

A Foundry VTT v14 module for the Starfinder 2e system that automates armor environmental protection. Tracking charges, environments (through scene regions or effects), armor upgrades, recharging, and transferring charges.

By default it handles the environmental protection RAW as written in Player Core, but there is an optional "Enhanced" ruleset which allows for limited protection for some environments, but which drains charges at a faster rate.

For example:
RAW rules Basic Environmental Protection provides 24 hours of protection per armor level while Underwater, or in Thick, Thin, and Vacuum atmospheres. So with level 5 tactical armor, this is 5 days of protection in a vacuum.

Using Enhanced Environmental Protection rules, Basic Environmental Protection still works the same for Thick and Thin atmospheres, but severely thin or vacuum atmospheres are treated differently, with only 4 hours per charge while in those environments, and 1 hour per charge while underwater.

There is a new armor upgrade the Filtered Air Supply which can give full protection for these and other environments. The full rules will be posted here at some point

## Development

```bash
npm install
npm run build
npm run typecheck
npm run lint
npm test
```

### Compendiums

The compendiums are built from JSON in `packs-src/`:

- `npm run build:packs` compiles `packs-src/` into `packs/`.
- `npm run extract:packs` does the reverse