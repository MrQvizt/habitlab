# Generates js/data/reasons.js: ~600 reasons people give for wanting to lose weight, in first person,
# grouped by the themes found in research (health, function/mobility, mood, appearance, family, everyday life).
import json, sys
C = {}
def add(cat, items): C.setdefault(cat, []).extend(items)

add('health', [
 'Lower my blood pressure','Lower my blood sugar','Lower my cholesterol','Prevent type 2 diabetes','Put my diabetes into remission',
 'Need fewer pills','Come off my blood pressure meds','Protect my heart','Lower my risk of stroke','Lower my risk of cancer',
 'Breathe more easily','Stop snoring','Help my sleep apnoea','Ease my acid reflux','Help my fatty liver',
 'Protect my kidneys','Ease my back pain','Ease my knee pain','Ease my hip pain','Take pressure off my joints',
 'Have fewer headaches','Help my asthma','Fewer aches in the morning','Reduce inflammation','Improve my fertility',
 'A healthier pregnancy','Balance my hormones','Help my PCOS','Ease my gout','Avoid a knee replacement',
 'Be ready for surgery','Recover faster from illness','A stronger immune system','Better blood tests','Make my doctor proud',
 'Pass my health check','Get a lower BMI','A smaller waist for my heart','Less swelling in my legs','Healthier skin',
 'Fewer heartburn nights','Steadier energy all day','Fewer sick days','Protect my brain as I age','Lower my dementia risk',
 'Healthier digestion','Ease my varicose veins','Help my thyroid treatment work','Ease my plantar fasciitis','Less pain in my feet',
 'Avoid what my parents went through','Break the family history','Live longer','Live healthier for longer','Add good years to my life',
 'Age well','Stay independent as I get older','Keep my own teeth and health','Feel well, not just get by','Take my health back',
])
add('moving', [
 'Tie my shoes without effort','Climb the stairs without stopping','Walk without getting breathless','Get up from the floor easily','Kneel in the garden',
 'Sit comfortably in any chair','Cross my legs','Bend down to pick things up','Get out of a car easily','Fit in a plane seat',
 'No seatbelt extender','Fit in a theme park ride','Run for the bus','Walk all day on holiday','Hike a mountain',
 'Run a 5K','Run a 10K','Run a half marathon','Run a marathon','Do a full push-up',
 'Do a pull-up','Touch my toes','Do a cartwheel again','Swim a mile','Cycle to work',
 'Climb trees with my kids','Dance all night','Move more freely','Feel light on my feet','Keep up on group walks',
 'Do yoga poses I can’t do yet','Lift heavier weights','Join a sports team','Play football again','Play tennis again',
 'Play golf all 18 holes','Ski again','Go surfing','Go horse riding','Try rock climbing',
 'Go scuba diving','Go kayaking','Ride a bike again','Ride a zipline','Try skydiving',
 'Play padel','Take a dance class','Do a triathlon','Walk the Camino','Climb Kilimanjaro',
 'Hike the Grand Canyon','Walk my dog for longer','Hike with friends','Take the stairs at work','Garden without back pain',
 'Clean the house without stopping','Carry the shopping in one go','Move house without help','Paint a room without aching','Play on the floor with kids',
])
add('family', [
 'Be there for my kids','Keep up with my kids','Play with my grandkids','See my kids grow up','Walk my daughter down the aisle',
 'Walk my son down the aisle','Meet my grandchildren','Be a role model for my kids','Teach my kids healthy habits','Run around the park with my kids',
 'Carry my kids on my shoulders','Be an active parent','Be an active grandparent','Grow old with my partner','Feel good next to my partner',
 'Be around for my family','Make my family proud','Not be a worry for my family','Take care of my parents','Be strong for my family',
 'Have a baby','Be fit for pregnancy','Chase my toddler','Go on bike rides as a family','Swim with my kids',
 'Be in family photos','Dance at my child’s wedding','Hug without feeling self-conscious','Be present for my partner','Feel close to my partner again',
 'Travel with my family','Play sports with my kids','Coach my kid’s team','Keep up with my nieces and nephews','Make memories with my family',
 'Show my kids it’s never too late','Break the cycle for my kids','Cook healthy food for my family','Be the fun parent','Be there for my friends',
 'Go out with my friends again','Feel good at reunions','Say yes to invitations','Make new friends','Join friends on adventures',
 'Date again','Feel ready to find love','Feel attractive to my partner','Enjoy intimacy more','Be a good example at work',
 'Make my late mum proud','Make my late dad proud','Keep a promise I made','Do it for my pet','Walk with my best friend',
])
add('mind', [
 'Confidence','Freedom','Feel confident','Feel proud of myself','Like what I see in the mirror',
 'Feel comfortable in my skin','Stop hiding','Stop worrying what people think','Speak up more','Feel calmer',
 'Less anxiety','Lift my mood','Feel happier','Ease my depression','Sleep better',
 'Think more clearly','Less brain fog','More energy','Feel in control','Feel free',
 'Prove to myself I can','Keep a promise to myself','Finish what I start','Trust myself again','Feel strong',
 'Respect my body','Be kind to myself','Love my body','Feel at peace with food','Stop emotional eating',
 'Stop the guilt around food','Feel in charge of cravings','Less stress','Feel younger','Feel like myself again',
 'Get my spark back','Feel alive','Feel lighter in mind and body','Be the best version of me','Self-respect',
 'Discipline','Courage','Pride','Peace of mind','Joy',
 'Independence','Self-worth','Balance','Strength','Hope',
 'Feel brave','Feel sexy','Feel energetic','Feel motivated','Feel accomplished',
 'Stop putting myself last','Choose myself','Heal my relationship with food','Show up for myself','Do something just for me',
])
add('looks', [
 'Fit into my favourite jeans','Wear a swimsuit with confidence','Buy clothes I love','Shop in any store','Wear a fitted dress',
 'Wear shorts in summer','Tuck in my shirt','Wear a belt again','Fit into my wedding dress','Fit into my suit',
 'Look good in photos','Love my holiday photos','Look great at a wedding','Look good on my birthday','Wear a bikini',
 'Go down a dress size','Go down a jeans size','Feel good naked','See my muscles','See my abs',
 'Have a flatter stomach','Toned arms','Feel good in tight clothes','Wear heels comfortably','Stop buying bigger sizes',
 'Wear my old clothes again','Rock a new hairstyle and outfit','Stand tall','Better posture','A slimmer face',
 'Less double chin','Look as young as I feel','Glow up','Feel good on dates','Take a selfie I like',
 'Model for a photo shoot','Look good at my reunion','Wear what I want','Look healthy','Clear skin',
 'Feel good at the beach','Wear sleeveless tops','Feel good in gym clothes','Wear a crop top','Feel good in a suit',
])
add('everyday', [
 'Sleep through the night','Wake up rested','Less sweating','Stay cool in summer','No chafing',
 'Sit through a film comfortably','Sit on the floor comfortably','Fit in a booth','Fly without worry','Travel comfortably',
 'Enjoy long car rides','Sit in any restaurant chair','Do my own shopping','Walk to the shops','Get around without a car',
 'Climb to the top floor','Keep up with colleagues','Have energy after work','Enjoy my weekends','Do more on my days off',
 'Spend less on food','Spend less on medicine','Lower my insurance cost','Save money','Need fewer doctor visits',
 'Cook more at home','Eat better food','Enjoy food without guilt','Taste food more','Have fewer takeaways',
 'Drink less','Stop smoking too','Keep my house tidy','Get through busy days','Be on time more',
 'Feel good at the doctor’s','Have easier check-ups','Get my body back after baby','Feel good after menopause','Be ready for summer',
 'Be ready for my holiday','Enjoy the festive season','Feel good at Christmas','Start the new year right','Celebrate my birthday healthy',
])
add('goals', [
 'Join the army','Join the police','Become a firefighter','Pass a fitness test','Get a job I want',
 'Get promoted','Feel confident at work','Give a talk with confidence','Start my own business','Do a physical job',
 'Be a fitness coach one day','Work longer and healthier','Retire healthy','Enjoy my retirement','Travel the world',
 'Go on a safari','Visit Japan','Backpack across Europe','Go on a road trip','Sail a boat',
 'Learn to surf','Learn to dance','Learn martial arts','Get a black belt','Go to a festival',
 'Climb a famous peak','Walk a long-distance trail','Do a charity run','Raise money for charity','Inspire others',
 'Share my story','Help others lose weight','Be a role model','Join a running club','Win a medal',
 'Beat my personal best','Reach my goal weight','Reach a healthy weight','Hit my first 5 kg','Reach my first 10%',
 'See a new number on the scale','Celebrate a milestone','Get to one-derland','Get under 100 kg','Never go back',
])

# Combinatorial extras that read naturally
sports = ['badminton','basketball','volleyball','hockey','rugby','squash','table tennis','netball','handball','baseball','softball','cricket','boxing','pickleball','bowling','frisbee','ice skating','roller skating','skateboarding','snowboarding']
add('moving', [f'Play {s} again' if s not in ('boxing','ice skating','roller skating','skateboarding','snowboarding','bowling') else f'Try {s}' for s in sports])
places = ['Paris','Rome','New York','Iceland','Norway','the Alps','Machu Picchu','Thailand','Bali','Australia','Disneyland','the Great Wall','Lapland','Scotland','Lisbon']
add('goals', [f'Explore {p} on foot' for p in places])
events = ['my wedding','my anniversary','my 40th','my 50th','my 60th','my graduation','my sister’s wedding','my brother’s wedding','my best friend’s wedding','our family holiday','summer','my school reunion','a big birthday','a holiday abroad','the new season']
add('looks', [f'Feel great for {e}' for e in events])
people = ['my wife','my husband','my partner','my children','my son','my daughter','my grandchildren','my mum','my dad','my brother','my sister','my friends','my team','my students','my patients','my future self','my younger self','my dog']
add('family', [f'Do it for {p}' for p in people])
add('mind', ['Feel good','Feel healthy','Feel worthy','Feel capable','Feel free to move','Feel light','Feel steady','Feel grounded','Feel bold','Feel beautiful','Feel handsome','Feel fit','Feel fresh','Feel energised in the morning','Feel at home in my body'])
add('health', ['Lower my resting heart rate','Better lung capacity','Less joint stiffness','Fewer cramps','A healthier gut','Better circulation','Stronger bones','Less water retention','Fewer migraines','Avoid medication side effects','Lower my triglycerides','Better insulin sensitivity','Keep my eyesight healthy','Protect my liver','Calm my IBS'])
add('everyday', ['Fit in the bath comfortably','Paint my toenails easily','Shave my legs easily','Put on socks standing up','Get dressed quickly','Sleep on my stomach','Find clothes that fit','Feel good in uniform','Feel comfy on the sofa','Ride a bike to the shops','Walk the kids to school','Stroll after dinner','Garden all afternoon','Go to the gym without fear','Enjoy the sauna'])
add('goals', ['Do a pull-up by summer','Run without stopping','Walk 10,000 steps a day','Swim in the sea','Climb the stairs of a tower','Bike 100 km','Hike for a whole weekend','Finish a fun run','Do a mud run','Join a hiking group'])


add('health', ['Lower my HbA1c','Get off insulin','Avoid weight-loss surgery','Qualify for my operation','Heal faster after surgery','Protect my pancreas','Fewer infections','Less shortness of breath','A healthier heart rhythm','Lower my heart disease risk','Feel better during my period','Ease my arthritis','Fewer hot flushes','Lower my risk of gallstones','Protect my future health'])
add('moving', ['Squat without holding on','Carry my groceries upstairs','Play hide and seek','Jump on a trampoline','Walk on the beach','Climb a ladder safely','Stand for a whole concert','Stand all day at work','Do a plank for a minute','Balance on one leg','Sprint again','Swim lengths without stopping','Walk around the lake','Hike to a waterfall','Go cross-country skiing'])
add('family', ['Push my kids on the swings','Lift my grandchild','Go to the playground with my kids','Run a race with my kids','Kick a ball with my grandkids','Teach my kids to ride a bike','Hold my baby without back pain','Have a family hike','Be the parent at sports day','Win the parents’ race','Be there at every milestone','Grow old with my friends','Keep up with my partner','Train with my partner','Make my partner proud'])
add('mind', ['Stop the self-criticism','Feel at ease in groups','Walk into a room with confidence','Stop avoiding cameras','Feel good at the gym','Celebrate small wins','Feel better than yesterday','Not let my weight define me','Feel in control of my life','Start fresh','Reset my habits','Feel proud at the doctor’s','Have more patience','Be more present','Feel like I belong'])
add('looks', ['Wear a fitted shirt','Wear skinny jeans','Fit into a vintage dress','Look sharp in a blazer','Feel good in leggings','Wear a tight dress','Have defined legs','Get a jawline back','Look fit','Fill out my clothes right','Wear a wetsuit','Look good on stage','Feel good in my work clothes','Love my reflection','Look rested'])
add('everyday', ['Breathe easy on hills','Have energy to cook','Enjoy evenings out','Stay out late with friends','Walk to work','Fit through the turnstile','Enjoy a hot day','Sit in the garden chair','Ride the bus comfortably','Feel fine in crowds','Get through airports easily','Have a lie-in less often','Feel good at the pool','Go camping','Enjoy festivals'])
add('goals', ['Feel proud on the finish line','Run with my dog','Do a sponsored walk','Climb Ben Nevis','Walk the Great Wall','Hike in Patagonia','See the northern lights','Cycle a long route','Join a dragon boat team','Coach a youth team','Try a new sport every year','Win a weight-loss challenge','Get stronger every month','Reach 100 days of habits','Make this year different','Write a new chapter','Become the person I want to be'])

seen = set(); out = []
for cat, items in C.items():
    for t in items:
        k = t.lower()
        if k in seen or len(t) > 40: 
            if len(t) > 40: print('too long', t, file=sys.stderr)
            continue
        seen.add(k); out.append((cat, t))
print(len(out), {c: sum(1 for x in out if x[0]==c) for c in C}, file=sys.stderr)
cats = {'health':'Health','moving':'Moving','family':'Family & friends','mind':'Mind & mood','looks':'Look & feel','everyday':'Everyday life','goals':'Goals & dreams'}
js = ['// Reasons people give for wanting to lose weight, to pick on the morning screen and in Settings.',
 '// Grouped by the themes found in research: health first, then appearance and mood (O’Brien 2007),',
 '// function and mobility, stigma (hospital programme, open-ended answers) and family and milestones',
 '// (HealthTalk interviews). Generated by tools/gen-reasons.py; written in the first person',
 '// so valueInfo() can turn them round ("my kids" → "your kids").',
 'export const REASON_CATS = ' + json.dumps(cats, ensure_ascii=False) + ';',
 'export const REASONS = [']
for cat, t in out: js.append(f'  [{json.dumps(cat)}, {json.dumps(t, ensure_ascii=False)}],')
js.append('];')
open(sys.argv[1], 'w').write('\n'.join(js) + '\n')
