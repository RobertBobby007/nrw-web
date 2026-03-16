# Crowdin

Repo je pripraveny na import prekladu z `src/messages/cs.json` do Crowdinu.

## Zdrojove soubory

- `src/messages/cs.json`: vychozi cestina
- `src/messages/en.json`: aktualni anglictina
- `src/messages/sk.json`: pripraveny slovensky bundle pro Crowdin/runtime
- `src/lib/i18n.ts`: runtime vrstva, ktera JSON soubory nacita do aplikace

## Potrebne promenne

- `CROWDIN_PROJECT_ID`
- `CROWDIN_PERSONAL_TOKEN`

## Prvni import

1. V Crowdinu vytvor projekt a nastav `Czech` jako source language.
2. Nahraj nebo propoj repozitar s timto `crowdin.yml`.
3. Spust import pres Crowdin CLI nebo GitHub integraci.

## Workflow pro nove feature

1. Jakykoliv novy uzivatelsky text nejdriv vytahni do `src/messages/cs.json`.
2. Ve stejnem commitu dopln odpovidajici klice do `src/messages/en.json`.
3. Nenechavej nove texty natvrdo v JSX, modalech, toast notifikacich, placeholderech ani user-facing API odpovedich.
4. Pro slovencinu neni potreba dalsi runtime zasah, pokud zustane kompatibilni struktura klicu v `src/messages/sk.json` a preklady se doplni z Crowdinu.
5. Po pushi na integracni branch refreshni Crowdin, aby se nove klice propsaly do prekladoveho projektu.

## Poznamka

Crowdin bude synchronizovat jen texty, ktere jsou vytazene do `src/messages/*.json`.
V aplikaci stale existuji dalsi natvrdo zapsane texty mimo tento system, ktere je potreba postupne presunout do message souboru.
