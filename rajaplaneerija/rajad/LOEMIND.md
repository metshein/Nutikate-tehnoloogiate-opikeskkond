# Juhendaja rajad

Siia kausta pandud `.json` failid ilmuvad veebis kõigile rakenduse loendis **Rajad… → Juhendaja rajad**.

1. Koosta rada rakenduses ja anna sellele nimi (see nimi on loendis näha).
2. Vali **Eksport → Laadi alla .json**.
3. Kopeeri fail siia kausta ja lae GitHubi (`git add`, `git commit`, `git push`).
4. Mõne minuti pärast on rada veebis loendis.

Raja eemaldamiseks kustuta fail ja lae muudatus GitHubi.

Faili `index.json` ei pea ise tegema – selle koostab GitHubi töövoog (`.github/workflows/pages.yml`) iga avaldamise ajal.
Kui avad `index.html` otse arvutist (mitte veebist), siin olevaid radu loendis ei näe.
