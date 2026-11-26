# Generates js/data/reasons.js: 600 one-word reasons people give for wanting to lose weight, grouped by
# the themes found in research (health first, then mood, appearance, function/mobility, family, milestones).
# Usage: python3 tools/gen-reasons.py js/data/reasons.js
import json, sys
C = {}
def add(cat, words): C.setdefault(cat, []).extend(words.split())

# Body words read with "your" ("Knees" → "your knees"); the rest read as they are ("freedom").
YOUR = set()
def body(cat, words):
    add(cat, words); YOUR.update(w.lower() for w in words.split())

body('health', '''Heart Lungs Knees Hips Joints Back Spine Feet Ankles Liver Kidneys Pancreas Brain Bones Muscles Skin
Gut Arteries Veins Circulation Hormones Thyroid Metabolism Immunity Eyesight Teeth Posture Breathing Balance Stamina''')
add('health', '''Health Wellness Longevity Prevention Remission Healing Recovery Vitality Fitness Wellbeing Sleep Rest Digestion
Fertility Pregnancy Ageing Lifespan Healthspan Immunity Resilience Insulin Cholesterol Glucose Bloodwork Checkups
Medication Pills Surgery Operation Painlessness Comfort Ease Relief Mobility Flexibility Agility Endurance Strength
Hydration Nutrition Vegetables Fruit Protein Fibre Wholefoods Cooking Walking Stretching Sunlight Air Oxygen
Clarity Alertness Focus Memory Mood Calm Steadiness Regularity Routine Habits Consistency Prevention Doctor
Nurse Physio Dentist Diagnosis Screening Survival Futureproofing Independence Movement Lightness Freshness Glow
Radiance Youthfulness Renewal Repair Reset Detox Restoration''')
add('moving', '''Hiking Running Jogging Sprinting Walking Rambling Trekking Climbing Bouldering Swimming Diving Snorkelling Surfing
Paddleboarding Kayaking Canoeing Rowing Sailing Windsurfing Kitesurfing Cycling Biking Spinning Skating Skiing
Snowboarding Sledging Skateboarding Rollerblading Dancing Salsa Tango Ballet Zumba Yoga Pilates Tai-chi Stretching
Gymnastics Cartwheels Handstands Trampolining Parkour Boxing Kickboxing Karate Judo Taekwondo Jiu-jitsu Fencing
Wrestling Archery Tennis Padel Squash Badminton Pickleball Golf Football Soccer Rugby Basketball Netball
Volleyball Handball Hockey Cricket Baseball Softball Bowling Frisbee Lacrosse Polo Riding Horses Triathlon
Marathon Parkrun Spartan Obstacles Weights Lifting Kettlebells Crossfit Calisthenics Pullups Pushups Planks
Squats Lunges Burpees Sprints Stairs Steps Mountains Trails Peaks Summits Waterfalls Forests Beaches Lakes
Gardening Allotment Dog-walking Geocaching Orienteering Caving Abseiling Ziplining Skydiving Paragliding
Bungee Scuba Freediving Rafting Camping Backpacking Fishing Hunting Foraging Birdwatching Stargazing
Sledding Hopscotch Skipping Hula-hooping Trampoline Playgrounds Treehouses Swings Rollercoasters Rides''')
body('family', 'Kids Children Grandkids Grandchildren Partner Spouse Wife Husband Girlfriend Boyfriend Fiancé Fiancée Mum Dad Mother Father Parents Daughter Son Sister Brother Siblings Nieces Nephews Cousins Aunt Uncle Grandma Grandpa Friends Bestie Family Team Colleagues Students Patients Dog Cat Pets Baby')
add('family', '''Parenthood Grandparenting Marriage Romance Love Intimacy Dating Companionship Friendship Togetherness Belonging
Community Connection Hugs Cuddles Playtime Bedtime Storytime Teamwork Legacy Roots Heritage Home''')
add('mind', '''Freedom Confidence Courage Pride Joy Hope Strength Balance Discipline Independence Self-worth Self-respect
Self-love Self-belief Self-care Dignity Peace Calm Serenity Happiness Contentment Gratitude Optimism Positivity
Energy Motivation Determination Willpower Persistence Patience Resilience Grit Bravery Boldness Fearlessness
Spirit Passion Purpose Meaning Faith Belief Trust Honesty Integrity Respect Kindness Compassion Forgiveness
Acceptance Growth Change Progress Transformation Renewal Rebirth Comeback Victory Triumph Success Achievement
Accomplishment Mastery Control Choice Power Agency Ownership Responsibility Commitment Dedication Focus Clarity
Mindfulness Presence Stillness Relaxation Ease Lightness Playfulness Fun Laughter Adventure Curiosity Wonder
Excitement Spontaneity Creativity Expression Authenticity Identity Self Me Myself Wholeness Harmony Wellbeing
Sanity Stability Security Safety Comfort Healing Release Liberation Breakthrough Possibility Potential Dreams
Ambition Drive Hunger Fire Spark Zest Vigour Aliveness Youth Freshness Optimism Openness Sociability Belonging
Visibility Voice Assertiveness Boundaries Worthiness Enoughness Gentleness Softness Warmth Sunshine Hope''')
add('looks', '''Jeans Dresses Swimsuit Bikini Swimwear Suits Shirts Skirts Shorts Leggings Heels Boots Belts Blazers Jackets
Sleeveless Crop-tops Gowns Tuxedo Uniform Lingerie Fashion Style Wardrobe Outfits Shopping Tailoring Sizes
Photos Selfies Portraits Mirror Reflection Cheekbones Jawline Waist Abs Arms Legs Shoulders Glutes Calves Muscle
Tone Definition Shape Silhouette Figure Physique Posture Glow Complexion Smile Haircut Makeover Glow-up Beauty
Attractiveness Elegance Grace Swagger Presence Sexiness Handsomeness Gorgeousness Prettiness Charm''')
add('everyday', '''Shoelaces Stairs Seatbelts Airplanes Flights Trains Buses Cars Cinemas Theatres Concerts Restaurants Booths
Chairs Floors Sofas Baths Showers Beds Mornings Evenings Weekends Holidays Errands Groceries Housework Cleaning
Cooking Baking Gardening Commuting Workdays Shifts Deadlines Meetings Budget Savings Money Insurance Groceries
Energy Naps Sleep Coolness Breathability Comfort Convenience Spontaneity Punctuality Productivity Tidiness''')
add('goals', '''Wedding Honeymoon Anniversary Birthday Graduation Reunion Christmas Easter Summer Spring Autumn Winter New-year
Holiday Vacation Getaway Safari Cruise Roadtrip Interrailing Paris Rome Venice Barcelona Lisbon London Iceland
Norway Lapland Japan Bali Thailand Australia Canada Alaska Patagonia Peru Kilimanjaro Everest Alps Himalayas
Camino Disneyland Festivals Retirement Promotion Career Job Business Interview Stage Podium Medal Trophy
Milestones Goals Targets Records Personal-best Finish-line Goal-weight One-derland Transformation Fresh-start
Comeback Firsts Bucket-list Adventures Travel Exploration Future''')

# Not good reasons on their own, or clash with the "Me" chip; dropped.
DROP = set('deadlines meetings shifts booths insurance pills medication surgery operation doctor nurse physio dentist diagnosis screening painlessness futureproofing detox insulin cholesterol glucose bloodwork hunting spartan obstacles me myself self hunger enoughness survival new-year personal-best finish-line goal-weight fresh-start bucket-list one-derland'.split())
add('mind', 'Wisdom Bliss Delight Cheer Poise Composure Valour Tenacity Fortitude Humility Generosity Vibrancy Brightness Exuberance Sparkle Verve Elation Daring Gusto Hopefulness')
add('moving', 'Canyoning Coasteering Sandboarding Snowshoeing Curling Rounders Dodgeball Capoeira Aerobics Barre Hillwalking Rowing Jumping Climbing Skipping')
add('goals', 'Tokyo Kyoto Sydney Manhattan Greece Crete Croatia Morocco Kenya Scotland Ireland Tuscany Provence Rio Mexico Hawaii Maldives Iceland Fiji Vietnam Bucketlist')

PROPER = set('paris rome venice barcelona lisbon london iceland norway lapland japan bali thailand australia canada alaska patagonia peru kilimanjaro everest alps himalayas camino disneyland christmas easter tokyo kyoto sydney manhattan greece crete croatia morocco kenya scotland ireland tuscany provence rio mexico hawaii maldives fiji vietnam parkrun zumba crossfit pilates'.split())

seen = set(); out = []
for cat, items in C.items():
    for w in items:
        label = w
        k = label.lower()
        if k in DROP or k == 'bucketlist': continue
        if k in seen: continue
        seen.add(k); out.append((cat, label))
print(len(out), {c: sum(1 for x in out if x[0] == c) for c in C}, file=sys.stderr)
cats = {'health': 'Health', 'moving': 'Moving', 'family': 'Family & friends', 'mind': 'Mind & mood', 'looks': 'Look & feel', 'everyday': 'Everyday life', 'goals': 'Goals & dreams'}
js = ['// One-word reasons people give for wanting to lose weight, to pick on the morning screen and in Settings.',
      '// Grouped by the themes found in research: health first, then appearance and mood (O’Brien 2007),',
      '// function and mobility, stigma (hospital programme, open-ended answers), family and milestones',
      '// (HealthTalk interviews). Generated by tools/gen-reasons.py.',
      'export const REASON_CATS = ' + json.dumps(cats, ensure_ascii=False) + ';',
      '// Body and people words read with "your" in messages: "Knees" → "your knees", "Kids" → "your kids".',
      'export const REASON_YOUR = new Set(' + json.dumps(sorted(YOUR), ensure_ascii=False) + ');',
      '// Names that keep their capital letter in a sentence.',
      'export const REASON_PROPER = new Set(' + json.dumps(sorted(PROPER), ensure_ascii=False) + ');',
      'export const REASONS = [']
for cat, w in out: js.append(f'  [{json.dumps(cat)}, {json.dumps(w, ensure_ascii=False)}],')
js.append('];')
open(sys.argv[1], 'w').write('\n'.join(js) + '\n')
