#!/usr/bin/env python3
"""Build js/data/usda.js from the USDA National Nutrient Database for Standard Reference, Release 28
(public domain, US Department of Agriculture, Agricultural Research Service).

Usage: python3 -I tools/usda-import.py <dir with ABBREV.txt and FOOD_DES.txt> > js/data/usda.js

Keeps everyday foods (cooked meat and fish, fruit, veg, dairy, grains, bakery, snacks, drinks, fast
food), drops baby foods, industrial ingredients and most brands, tidies the names and keeps up to two
household portions with their weight in grams. Values are per 100 g.
"""
import re
import sys
import json

src = sys.argv[1]
des = {}
for line in open(f'{src}/FOOD_DES.txt', encoding='latin-1'):
    f = [x.strip('~') for x in line.rstrip('\r\n').split('^')]
    des[f[0]] = {'grp': f[1], 'name': f[2]}

KEEP = {'0100', '0400', '0500', '0600', '0700', '0800', '0900', '1000', '1100', '1200', '1300', '1400',
        '1500', '1600', '1700', '1800', '1900', '2000', '2100', '2200', '2500', '3600'}
MEAT = {'0500', '1000', '1300', '1700'}
DROP = re.compile(r'babyfood|infant|toddler|usda commodity|school lunch|industrial|dehydrated|imitation|separable fat|'
                  r'variety meats|by-products|mechanically|unprepared|as purchased|dry mix|from concentrate|concentrate,|'
                  r'frozen concentrate|powder|ns as to|not further specified|leavening|shortening|lard|tallow|suet|'
                  r'fat, |gelatin|meat extender|formulated|fortified with|alaska native|\(navajo\)|\(hopi\)|\(apache\)|'
                  r'stuffing mix|pudding mix|frosting mix|cake mix|muffin mix|dough, |batter|, uncooked|, unenriched|'
                  r'with added|nutritional supplement|enteral|carbonated|liqueur|whale|seal|walrus|caribou|moose|'
                  r'beaver|bear|opossum|squirrel|raccoon|muskrat|frog|turtle|emu|ostrich|bison|elk|deer|game|'
                  r'heart|liver|kidney|tongue|brain|lung|spleen|tripe|thymus|pancreas|giblets|gizzard|chitterlings|'
                  r'feet|ears|tail|snout|jowl|blood|milk, human', re.I)
NOISE = [r', separable lean and fat', r', separable lean only', r', trimmed to \d/\d+" fat', r', trimmed to 0" fat',
         r', all grades', r', choice', r', select', r', prime', r', boneless', r', bone-in', r', with salt', r', without salt',
         r', salt added', r', no salt added', r', enriched', r', unenriched', r', composite of trimmed retail cuts',
         r', includes USDA commodity', r', commercially prepared', r', home-prepared', r', commercial', r', regular',
         r', retail parts', r', UPC: \d+', r', Includes foods for USDA.*$', r', meat only', r', meat and skin',
         r', single brand', r', ready-to-serve', r', solids and liquids', r', drained solids', r', ready-to-eat', r', ready-to-heat']
PREFIX = [(r'^Mollusks, ', ''), (r'^Crustaceans, ', ''), (r'^Fish, ', ''), (r'^Alcoholic beverages?, ', ''), (r'^Snacks, ', ''),
          (r'^Candies, ', 'Candy, '), (r'^Fast foods, ', ''), (r'^Beverages, ', ''), (r'^Cereals ready-to-eat, ', 'Cereal, '),
          (r'^Cheese, cottage', 'Cottage cheese'), (r'^Kiwifruit', 'Kiwi'), (r'prepared-from-recipe', 'homemade'),
          (r'home prepared', 'homemade'), (r'^Yogurt, Greek', 'Greek yogurt')]
BRAND = re.compile(r"\b[A-Z][A-Z'&\.]{2,}\b")
RAW_OK = MEAT  # meat: only cooked versions are useful for logging what you ate

def tidy(name, grp):
    n = name
    for p in NOISE:
        n = re.sub(p, '', n, flags=re.I)
    for a, b in PREFIX:
        n = re.sub(a, b, n)
    n = re.sub(r'\s+', ' ', n).strip(' ,')
    # Restaurant names: McDONALD'S -> McDonald's, TACO BELL -> Taco Bell
    def cap(m):
        w = m.group(0)
        if w in ('NFS', 'USDA'):
            return w
        return w[:1] + w[1:].lower()
    n = re.sub(r"\b[A-Z][A-Z'&\.]+\b", cap, n)
    n = re.sub(r"\bMc([A-Z])([A-Z'&]+)", lambda m: 'Mc' + m.group(1) + m.group(2).lower(), n)
    return n[:1].upper() + n[1:]

FRAC = {'.5 ': '½ ', '.25 ': '¼ ', '.75 ': '¾ ', '.333 ': '⅓ ', '.33 ': '⅓ ', '.667 ': '⅔ ', '1.5 ': '1½ '}
def portion(desc):
    d = desc.strip()
    d = re.sub(r'\([^)]*\)?', '', d)  # sizes in inches, scoop numbers, can codes
    d = re.sub(r'\b1 NLEA serving\b|\bNLEA serving\b', 'serving', d)
    d = re.sub(r'\s+', ' ', d).strip(' ,')
    for k, v in FRAC.items():
        if d.startswith(k):
            d = v + d[len(k):]
    if len(d) > 24:
        d = d.split(',')[0]  # a cut-off description reads worse than a short one
    return d[:24].strip(' ,')

out = []
seen = set()
for line in open(f'{src}/ABBREV.txt', encoding='latin-1'):
    f = [x.strip('~') for x in line.rstrip('\r\n').split('^')]
    ndb = f[0]
    d = des.get(ndb)
    if not d or d['grp'] not in KEEP:
        continue
    name = d['name']
    low = name.lower()
    if DROP.search(name):
        continue
    if d['grp'] not in ('2100', '3600') and BRAND.search(name.replace('NFS', '')):
        continue
    if d['grp'] in MEAT and ('raw' in low or 'cooked' not in low and 'roasted' not in low and 'grilled' not in low
                             and 'broiled' not in low and 'braised' not in low and 'fried' not in low and 'smoked' not in low
                             and 'cured' not in low and 'ham' not in low and 'bacon' not in low):
        continue
    if d['grp'] == '1500' and 'raw' in low and not re.search(r'tuna|salmon|oyster', low):
        continue
    try:
        kcal = float(f[3] or 0); p = float(f[4] or 0); fat = float(f[5] or 0); c = float(f[7] or 0); fib = float(f[8] or 0)
    except ValueError:
        continue
    if kcal <= 0 and d['grp'] != '1400':
        continue
    n = tidy(name, d['grp'])
    key = re.sub(r'[^a-z0-9]', '', n.lower())
    if key in seen or len(n) > 90:
        continue
    seen.add(key)
    units = []
    for gi, di in ((48, 49), (50, 51)):
        try:
            g = float(f[gi] or 0)
        except (ValueError, IndexError):
            g = 0
        desc = portion(f[di] if di < len(f) else '')
        if 0 < g <= 1000 and desc and not any(u[0] == desc for u in units):
            units.append([desc, round(g, 1)])
    r = lambda x: round(x, 1) if x < 10 else round(x)
    out.append([n, r(kcal), r(p), r(c), r(fat), r(fib), d['grp'], units])

out.sort(key=lambda x: x[0].lower())
print('// Generated by tools/usda-import.py — do not edit by hand.')
print('// Source: USDA National Nutrient Database for Standard Reference, Release 28 (public domain).')
print('// [name, kcal, protein g, carbs g, fat g, fibre g] per 100 g, USDA food group, household portions [label, grams].')
print('export const USDA = ' + json.dumps(out, ensure_ascii=False, separators=(',', ':')) + ';')
print(f'// {len(out)} foods', file=sys.stderr)
