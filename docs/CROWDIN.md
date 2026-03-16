# Crowdin

Repo je pripraveny na import prekladu z `src/messages/cs.json` do Crowdinu.

## Zdrojove soubory

- `src/messages/cs.json`: vychozi cestina
- `src/messages/en.json`: aktualni anglictina
- `src/lib/i18n.ts`: runtime vrstva, ktera JSON soubory nacita do aplikace

## Potrebne promenne

- `CROWDIN_PROJECT_ID`
- `CROWDIN_PERSONAL_TOKEN`

## Prvni import

1. V Crowdinu vytvor projekt a nastav `Czech` jako source language.
2. Nahraj nebo propoj repozitar s timto `crowdin.yml`.
3. Spust import pres Crowdin CLI nebo GitHub integraci.

## Poznamka

Crowdin bude synchronizovat jen texty, ktere jsou vytazene do `src/messages/*.json`.
V aplikaci stale existuji dalsi natvrdo zapsane texty mimo tento system, ktere je potreba postupne presunout do message souboru.
