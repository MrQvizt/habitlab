# Habit Lab: Evidence Brief on Habit Change for Weight Loss and Maintenance in Adults with Obesity

*Compiled November 2026. Scope: adults (18+) with overweight or obesity. Each claim links to a guideline, meta-analysis, RCT, or the primary paper. Where the evidence is weak, observational, or mixed, the text says so. Where a number is an engineering choice made from the evidence rather than a published figure, it is labelled **[derived]**.*

> This brief is input for product design. It is not medical advice. The app should present itself as a habit coach and route medical questions to clinicians (see §7).

---

## 1. Energy targets

### 1.1 Resting metabolic rate (RMR)
- **Mifflin-St Jeor (1990).** It was derived in 498 healthy adults aged 19–78, including people with obesity, measured by indirect calorimetry ([Mifflin et al., AJCN 1990](https://agris.fao.org/search/ar/records/65de26fe7c7033e84be9ee76)):
  - Men: `RMR = 10·kg + 6.25·cm − 5·age + 5`
  - Women: `RMR = 10·kg + 6.25·cm − 5·age − 161`
- **Accuracy.** In a systematic review of the four most-used equations, Mifflin-St Jeor most often predicted RMR within 10% of measured values in both nonobese and obese adults, and it had the narrowest error range. The authors still warn of meaningful errors for individuals, and older adults and ethnic minorities were underrepresented ([Frankenfield et al., J Am Diet Assoc 2005](https://pure.psu.edu/en/publications/comparison-of-predictive-equations-for-resting-metabolic-rate-in-/)). In a later validation study, every equation was less accurate in obese than in non-obese adults ([Frankenfield 2013](https://pubmed.ncbi.nlm.nih.gov/23631843/)).
- **Implication.** Treat the equation output as a *starting estimate* only. Replace it with an observed estimate once there is enough weight-trend data (§1.5).

### 1.2 Activity multipliers (physical activity level, PAL)
FAO/WHO/UNU classify lifestyles by PAL, which is total energy expenditure divided by basal metabolic rate: **sedentary/light 1.40–1.69, active/moderately active 1.70–1.99, vigorous 2.00–2.39**. Values of 2.40 or more are hard to sustain long-term ([FAO/WHO/UNU Human Energy Requirements, 2004](https://www.fao.org/3/y5686e/y5686e00.htm); [category table](https://www.fao.org/4/Y5686E/y5686e07.htm)). Most adults with obesity who are starting out fall in the 1.40–1.60 range. **[derived]**: default to 1.4 unless the user reports regular exercise.

### 1.3 Deficit and rate of loss
- The AHA/ACC/TOS guideline offers three ways to set intake: **1,200–1,500 kcal/day for women and 1,500–1,800 kcal/day for men** (adjusted for body weight), **or a 500 or 750 kcal/day deficit**, or an evidence-based diet that restricts certain food types ([2013 AHA/ACC/TOS guideline, Circulation](https://in.bgu.ac.il:443/en/fohs/communityhealth/Family/Documents/OBESITY%20%202013%20AHA%20ACC%20TOS%20Guideline%20for%20the%20MANAGEMENT%20of%20OVERWEIGHT%20and%20OBESITY%20in%20ADULTS%20%20Circulation%2012.11.2013.pdf); [ACC press release](https://www.acc.org/about-acc/press-releases/2013/11/12/15/20/111213acc_aha_obesity_guideline)).
- The CDC says people who lose weight gradually, at **about 1–2 lb (0.45–0.9 kg) per week**, are more likely to keep it off ([CDC, Steps for Losing Weight](https://www.cdc.gov/healthy-weight-growth/losing-weight)). **[derived]**: for heavier users, express the target as **0.5–1.0% of body weight per week**, capped at 1 kg/week.
- **The "3,500 kcal per pound" rule overestimates loss.** In seven tightly controlled studies, it predicted 27.6 lb lost against 20.1 lb observed ([Thomas et al., IJO 2013](https://pmc.ncbi.nlm.nih.gov/articles/PMC3859816)). Hall's dynamic model gives a more accurate rule of thumb. Each permanent change of **100 kJ/day (~24 kcal/day) eventually changes weight by ~1 kg**, or about 10 kcal/day per lb. Half of that change happens in ~1 year and 95% in ~3 years ([Hall et al., Lancet 2011](https://pmc.ncbi.nlm.nih.gov/articles/PMC3880593/)). The same work gives the energy density of fat tissue as 39.5 MJ/kg (~9,400 kcal/kg) and of lean tissue as 7.6 MJ/kg (~1,800 kcal/kg) ([Hall Lancet web appendix](https://www.niddk.nih.gov/-/media/Files/BWP/Hall_Lancet_Web_Appendix.pdf)). The NIH [Body Weight Planner](https://niddk.nih.gov/research-funding/at-niddk/labs-branches/laboratory-biological-modeling/integrative-physiology-section/research/body-weight-planner) puts this model into practice.

### 1.4 Calorie floors and very-low-calorie diets
- The AHA/ACC/TOS ranges (1,200 kcal/day for women, 1,500 kcal/day for men at the low end) are the floors that self-directed programmes commonly use. The same guideline says **very-low-calorie diets (<800 kcal/day) should be used only in limited circumstances with close medical supervision** ([AHA/ACC/TOS 2013](https://in.bgu.ac.il:443/en/fohs/communityhealth/Family/Documents/OBESITY%20%202013%20AHA%20ACC%20TOS%20Guideline%20for%20the%20MANAGEMENT%20of%20OVERWEIGHT%20and%20OBESITY%20in%20ADULTS%20%20Circulation%2012.11.2013.pdf)).
- NICE (UK, NG246) recommends low-energy diets (800–1,200 kcal/day) only as part of a multicomponent strategy with long-term support in a specialist service, and very-low-energy diets (<800 kcal/day) only in specialist services for specific groups. Both must be nutritionally complete and last **no more than 12 weeks** ([NICE NG246](https://www.nice.org.uk/guidance/NG246/chapter/physical-activity-and-diet)).

### 1.5 Metabolic adaptation and appetite
- Weight loss lowers energy expenditure by more than lost tissue alone explains. Six years after *The Biggest Loser*, RMR was ~704 kcal/day below baseline, and metabolic adaptation was ~−499 kcal/day. This was an extreme case (n=14) ([Fothergill et al., Obesity 2016](https://pmc.ncbi.nlm.nih.gov/articles/PMC4989512)).
- **Appetite is the larger counter-force.** Each kg lost raised the drive to eat by **~100 kcal/day above baseline**, about three times the drop in energy expenditure (~30 kcal/day per kg). The study population was people with type 2 diabetes on an SGLT2 inhibitor ([Polidori et al., Obesity 2016](https://pubmed.ncbi.nlm.nih.gov/27804272/)).
- **Implication.** A fixed calorie target "wears out" as weight falls. Targets must be re-estimated from observed data, and maintenance needs active strategies, not a return to old habits.

### 1.6 When to adjust targets
Weight loss in diet trials typically **plateaus at about 6 months** (5–8.5 kg, 5–9% in the first 6 months), with partial regain afterward ([Franz et al., J Am Diet Assoc 2007](https://pubmed.ncbi.nlm.nih.gov/17904936/)). Energy balance means **TDEE ≈ mean logged intake − (Δ trend weight × tissue energy density) / days**. With fat at ~9,400 kcal/kg and lean at ~1,800 kcal/kg ([Hall appendix](https://www.niddk.nih.gov/-/media/Files/BWP/Hall_Lancet_Web_Appendix.pdf)), **[derived]**: use ~7,700 kcal/kg for mixed tissue loss. Use a smoothed weight trend and at least 14 days of data, because day-to-day water swings swamp short windows.

---

## 2. Diet

### 2.1 Protein
- Across 28 trials in adults with overweight or obesity, higher protein during weight loss significantly limited muscle loss (SMD 0.75). It did not significantly protect strength or function ([Clin Nutr ESPEN 2024 meta-analysis](https://pubmed.ncbi.nlm.nih.gov/39002131/)).
- In older adults, higher-protein weight-loss diets (≥25% of energy or ≥1.0 g/kg/day) kept more lean mass and lost more fat ([Kim et al., Nutr Rev 2016](https://pmc.ncbi.nlm.nih.gov/articles/PMC4892287)).
- **Dose and reference weight.** A 2025 review proposes **≥1.2 g/kg/day during weight loss, calculated with body weight capped at BMI 30**, because excess fat mass adds little protein need ([Weijs, Curr Opin Clin Nutr Metab Care 2025](https://pure.amsterdamumc.nl/ws/portalfiles/portal/142148308/Protein-requirement-in-obesity.pdf)). The [2025 joint advisory on nutrition with GLP-1 therapy](https://obesity.org/nutritional-priorities-to-support-glp-1-therapy-for-obesity) likewise lists "adequate protein intake and strength training to preserve lean mass" as a priority ([AJCN 2025](https://pubmed.ncbi.nlm.nih.gov/40450457/)).

### 2.2 Fibre
In Reynolds et al.'s series of meta-analyses (185 cohorts and 58 trials), fibre had the best evidence of the carbohydrate-quality measures (moderate certainty). Trials linked higher fibre intake with **lower body weight** and cholesterol. The largest risk reductions came at **~25–29 g/day or more** ([Reynolds et al., Lancet 2019](https://pubmed.ncbi.nlm.nih.gov/30638909/); [ScienceDaily summary](https://www.sciencedaily.com/releases/2019/01/190110184737.htm)).

### 2.3 Diet patterns: macronutrient split matters less than adherence
- **DIETFITS** (n=609, 12 months): healthy low-fat −5.3 kg vs healthy low-carb −6.0 kg, a difference that was not significant. Genotype and insulin secretion did not predict which diet worked better ([Gardner et al., JAMA 2018](https://pmc.ncbi.nlm.nih.gov/articles/PMC5839290)).
- **Mediterranean.** Over 12 months or more, it gave more weight loss than low-fat diets and similar loss to other comparator diets ([Mancini et al., Am J Med 2016](https://pubmed.ncbi.nlm.nih.gov/26721635/)).
- Canada's guideline uses the term "medical nutrition therapy" and says no single eating pattern suits everyone; the plan should be personalised ([Wharton et al., CMAJ 2020](https://www.cmaj.ca/content/192/31/E875)).

### 2.4 Meal replacements
Across 23 trials (n=7,884), diets that included meal replacements produced **−1.44 kg more** weight loss at 1 year than other diets, and **−6.13 kg** when combined with extra support ([Astbury et al., Obes Rev 2019](https://pmc.ncbi.nlm.nih.gov/articles/PMC6849863)). Look AHEAD also used meal replacements ([Look AHEAD intervention](https://pmc.ncbi.nlm.nih.gov/articles/PMC2613279/)).

### 2.5 Energy density (volume eating)
In a 1-year trial in 97 women with obesity, a reduced-fat diet with extra water-rich fruit and vegetables lowered energy density and produced **7.9 vs 6.4 kg** loss among completers, with less hunger ([Ello-Martin et al., AJCN 2007](https://pubmed.ncbi.nlm.nih.gov/17556681/)).

### 2.6 Ultra-processed food
In an inpatient crossover RCT (n=20, 2 weeks per diet), an ultra-processed diet led people to eat **+508 kcal/day** more than an unprocessed diet. The meals were matched for presented calories, sugar, fat, sodium, fibre and macronutrients. Participants gained 0.9 kg on the ultra-processed diet and lost 0.9 kg on the unprocessed diet, and they ate faster on the ultra-processed meals ([Hall et al., Cell Metab 2019](https://pubmed.ncbi.nlm.nih.gov/31105044/); [NIH release](https://www.nih.gov/news-events/news-releases/nih-study-finds-heavily-processed-foods-cause-overeating-weight-gain)).

### 2.7 Time-restricted eating (TRE)
- **TREAT** (16:8, n=116, 12 weeks): −0.94 kg vs −0.68 kg for consistent meal timing, a difference that was not significant. Lean-mass loss was a concern ([Lowe et al., JAMA Intern Med 2020](https://pmc.ncbi.nlm.nih.gov/articles/PMC7522780)).
- **Liu et al.** (n=139, 12 months, both arms calorie-restricted): TRE −8.0 kg vs −6.3 kg, a difference that was not significant. Calorie restriction explained most of the benefit ([NEJM 2022](https://pubmed.ncbi.nlm.nih.gov/35443107/)).
- **Implication.** Offer TRE as an *optional structure* that some users find helpful, not as a mechanism of its own.

### 2.8 Meal frequency
The evidence is low-certainty and shows no clear difference: high- vs low-frequency eating changed weight by −0.62 kg (95% CI −2.76 to 1.52), and 15 of 16 trials were at high risk of bias ([Blazey et al., IJBNPA 2023](https://pmc.ncbi.nlm.nih.gov/articles/PMC10647044/)). Let users choose the meal pattern that best supports their adherence.

### 2.9 Liquid calories and alcohol
- Each additional daily serving of a sugar-sweetened beverage was associated with **+0.12–0.22 kg/year** in adults. Adult RCTs that added sugary drinks increased weight ([Malik et al., AJCN 2013](https://pubmed.ncbi.nlm.nih.gov/23966427/); [WHO eLENA](https://www.who.int/tools/elena/commentary/ssbs-adult-weight)).
- For alcohol, see §5.3.

---

## 3. Physical activity

### 3.1 Guideline doses
- **WHO 2020.** Adults: **150–300 min/week moderate or 75–150 min/week vigorous** activity, **plus muscle-strengthening on ≥2 days/week**, and limit sedentary time. "Start with small amounts of physical activity and gradually increase frequency, intensity and duration over time" ([Bull et al., BJSM 2020](https://pmc.ncbi.nlm.nih.gov/articles/PMC7719906/)).
- **US Physical Activity Guidelines 2018.** Inactive people should "start low and go slow". Some activity is better than none, and benefits begin below the target with no threshold ([AAFP summary of HHS PAG](https://www.aafp.org/pubs/afp/issues/2019/0701/p58.html); [PAG executive summary](https://health.gov/sites/default/files/2019-10/PAG_ExecutiveSummary.pdf)).
- **ACSM position stand.** 150–250 min/week prevents weight gain but gives only modest loss. **More than 250 min/week** is associated with clinically significant weight loss, and more than 250 min/week may be needed to prevent regain ([Donnelly et al., MSSE 2009](https://pubmed.ncbi.nlm.nih.gov/19127177/)).
- **Look AHEAD and DPP targets.** Look AHEAD aimed for ≥175 min/week by month 6, then ≥200 min/week ([Look AHEAD](https://pmc.ncbi.nlm.nih.gov/articles/PMC2613279/)). DPP aimed for ≥150 min/week ([DPP, NEJM 2002](https://pubmed.ncbi.nlm.nih.gov/11832527/)).
- **Exercise alone produces little weight loss.** Advice-only and exercise-only groups lost minimal weight ([Franz 2007](https://pubmed.ncbi.nlm.nih.gov/17904936/)). The main reasons are low exercise doses and compensatory increases in eating ([Thomas et al., Obes Rev 2012](https://pmc.ncbi.nlm.nih.gov/articles/PMC3771367)). Present activity as essential for health and maintenance, not as a way to "earn" food.

### 3.2 Resistance training and lean mass
Meta-analysis in adults with overweight or obesity: resistance training plus calorie restriction gave **−5.1 kg fat mass with lean mass preserved** (−0.2 kg, not significant). Resistance training alone gave +0.8 kg lean mass and −1.0 kg fat mass ([Lopez et al., Obes Rev 2022](https://pmc.ncbi.nlm.nih.gov/articles/PMC9285060)).

### 3.3 Beginners and joint pain
In the IDEA trial (adults aged 55+ with knee osteoarthritis, 18 months), diet plus exercise produced −10.6 kg (−11.4%) and diet alone −8.9 kg. Knee compressive forces fell more with weight loss than with exercise alone ([Messier et al., JAMA 2013](https://pubmed.ncbi.nlm.nih.gov/24065013/)). Start with low-impact activity (walking, cycling, water) in short bouts and progress gradually ([WHO 2020](https://pmc.ncbi.nlm.nih.gov/articles/PMC7719906/); [PAG](https://www.aafp.org/pubs/afp/issues/2019/0701/p58.html)).

### 3.4 Steps per day
In 15 cohorts (n=47,471), more daily steps were linked to lower mortality. Benefits levelled off at **~6,000–8,000 steps/day for adults aged 60+** and **~8,000–10,000 for under-60s**. The quartile medians were 3,553, 5,801, 7,842 and 10,901 steps, and the top quartile had HR 0.47 vs the bottom ([Paluch et al., Lancet Public Health 2022](https://pubmed.ncbi.nlm.nih.gov/35247352/)). This is a mortality outcome, not a weight outcome.

### 3.5 NEAT
Non-exercise activity thermogenesis (NEAT: fidgeting, posture, daily movement) accounted for two-thirds of the rise in energy expenditure during overfeeding. NEAT also predicted the 10-fold differences between people in fat gain (n=16) ([Levine et al., Science 1999](https://pubmed.ncbi.nlm.nih.gov/9880251/)). WHO also says replacing sedentary time with activity of *any* intensity benefits health ([WHO 2020](https://pmc.ncbi.nlm.nih.gov/articles/PMC7719906/)).

---

## 4. Behaviour change

### 4.1 What effective programmes contain
- **USPSTF (Grade B).** Clinicians should offer or refer adults with BMI ≥30 to intensive, multicomponent behavioural interventions. Most effective programmes had **≥12 sessions in year 1** and covered nutrition, activity, self-monitoring, problem-solving and relapse prevention ([USPSTF 2018](https://www.uspreventiveservicestaskforce.org/uspstf/recommendation/obesity-in-adults-interventions)).
- **DPP lifestyle arm.** Goals were **≥7% weight loss and ≥150 min/week** activity. Diabetes incidence fell **58% vs placebo** (31% with metformin) ([Knowler et al., NEJM 2002](https://pubmed.ncbi.nlm.nih.gov/11832527/)).
- **CDC National DPP.** The programme runs 1 year: 16 roughly weekly sessions in months 1–6, then ≥6 monthly sessions. Goals are 5–7% weight loss and 150 min/week activity ([CDC: What is the National DPP](https://www.cdc.gov/diabetes-prevention/programs/what-is-the-national-dpp.html); [PMC5606310](https://pmc.ncbi.nlm.nih.gov/articles/PMC5606310)).
- **Look AHEAD.** The group goal was ≥7% loss (≥10% individual goal), with 1,200–1,800 kcal/day by starting weight, ≤30% fat, ≥15% protein, meal replacements and ≥175 min/week activity. Extra tools came from month 7 for people losing slowly. Results were **8.6% at 1 year and 6.0% at 8 years** ([Look AHEAD design](https://pmc.ncbi.nlm.nih.gov/articles/PMC2613279/); [8-year outcomes](https://pmc.ncbi.nlm.nih.gov/articles/PMC3904491)).

### 4.2 Health benefits of 5% and 7–10% loss
In Look AHEAD (n=5,145), **5 to <10% loss** improved glycaemia, blood pressure, triglycerides and HDL at 1 year. For example, the odds of a 0.5-point drop in HbA1c were 3.52 times those of weight-stable participants. **10–15% loss** brought greater benefits ([Wing et al., Diabetes Care 2011](https://pmc.ncbi.nlm.nih.gov/articles/PMC3120182/)).

### 4.3 Self-monitoring
- Self-monitoring of diet, activity and weight was consistently associated with weight loss, although the evidence level is limited ([Burke et al., J Am Diet Assoc 2011](https://pmc.ncbi.nlm.nih.gov/articles/PMC3268700)).
- **Frequency matters more than time spent.** People who logged more often lost more. Logging time fell from **23.2 to 14.6 min/day** over 6 months ([Harvey et al., Obesity 2019](https://pubmed.ncbi.nlm.nih.gov/30801989/)).
- **Daily weighing.** Daily weighers adopted more weight-control behaviours and lost more than people who weighed most days (secondary analysis of an RCT) ([Steinberg et al., J Acad Nutr Diet 2015](https://pubmed.ncbi.nlm.nih.gov/25683820/)). Adding self-weighing to behavioural programmes may improve loss, especially with accountability ([Madigan et al., IJBNPA 2015](https://pmc.ncbi.nlm.nih.gov/articles/PMC4546162)). Regular self-weighing was not linked to adverse psychological outcomes ([Shieh et al. 2016](https://pubmed.ncbi.nlm.nih.gov/26896865/)). However, *instructing* daily weighing on its own, without other support, was ineffective in a UK RCT ([Madigan et al.](https://www.ncbi.nlm.nih.gov/pmc/articles/PMC4195875/)).

### 4.4 Goal setting and implementation intentions
- "If-then" plans had a medium-to-large effect on goal attainment (**d=0.65**, 94 tests) ([Gollwitzer & Sheeran 2006](https://www.socmot.uni-konstanz.de/publications/implementation-intentions-and-goal-achievement-meta-analysis-effects-and-processes)).
- For diet specifically, implementation intentions improved *adding* healthy foods (**d≈0.51**) more than *reducing* unhealthy eating (**d≈0.29**) ([Adriaanse et al., Appetite 2011](https://www.socmot.uni-konstanz.de/sites/default/files/adriaanse2011.pdf)).
- **Implication.** Frame habits as *additions* where possible ("add a vegetable to lunch") rather than prohibitions.

### 4.5 Habit formation (including anchoring habits to existing routines)
- Daily health behaviours tied to a cue reached automaticity in a **median of 66 days (range 18–254)**. Simple behaviours became automatic faster than complex ones, and **missing a single day did not derail the process**. Repeated inconsistency did ([Lally et al., Eur J Soc Psychol 2010](https://www.ucl.ac.uk/news/2009/aug/how-long-does-it-take-form-habit); [UCL summary](https://blogs.ucl.ac.uk/bsh/2012/06/29/busting-the-21-days-habit-formation-myth/)).
- **Habit-formation advice:** pick a small behaviour, perform it in the same context each time (the cue), and repeat until automatic. Start small, for example walking one or two extra bus stops ([Gardner, Lally & Wardle, BJGP 2012](https://pmc.ncbi.nlm.nih.gov/articles/PMC3505409/)). Anchoring a new behaviour to an existing routine is an application of this "same context, stable cue" principle.
- In the "Ten Top Tips" primary-care RCT (n=537), a habit-based leaflet cost ~£23 per person. The pilot produced −2.0 vs −0.4 kg at 8 weeks, and the main trial's 10TT group kept its loss at 24 months ([Beeken et al., IJO 2017](https://www.nature.com/articles/ijo2016206); [UCL 10TT](https://www.ucl.ac.uk/iehc/research/behavioural-science-health/research/obesity/ten-top-tips)).

### 4.6 Stimulus control, problem-solving, relapse prevention
- After 20 weeks of behavioural treatment, extended **problem-solving therapy** produced more long-term loss than behavioural treatment alone. **35% vs 6%** achieved ≥10% loss. Relapse-prevention training gave no overall advantage ([Perri et al., J Consult Clin Psychol 2001](https://researchdiscovery.drexel.edu/esploro/outputs/journalArticle/Relapse-Prevention-Training-and-Problem-Solving-Therapy/991014877884804721)).
- Stimulus control (changing cues in the environment) and relapse prevention are standard components of the intensive programmes summarised by USPSTF ([USPSTF 2018](https://www.uspreventiveservicestaskforce.org/uspstf/recommendation/obesity-in-adults-interventions)).

### 4.7 Early response as a signal
Weight change in the **first 1–2 months** of Look AHEAD predicted weight loss in every year through year 8. Differences in adherence were visible by month 2 ([Unick et al., Obesity 2015](https://pmc.ncbi.nlm.nih.gov/articles/PMC4481874)). This supports early, supportive escalation for slow starters, not discouragement.

### 4.8 Self-compassion and weight stigma
- Self-compassion interventions improved eating behaviours in 15 of 18 studies and weight in 6 of 11. The studies have methodological weaknesses ([Brenton-Peters et al., J Psychosom Res](https://eprints.whiterose.ac.uk/160045/3/Self-compassion%20and%20eating%20-%20CPR%20%28final%29.pdf); [Rahimi-Ardabili et al., Mindfulness 2018](https://link.springer.com/article/10.1007/s12671-017-0804-0)).
- Weight stigma causes physical and psychological harm and reduces the quality of care. An international consensus asks for non-stigmatising, person-first language ([Rubino et al., Nat Med 2020](https://pmc.ncbi.nlm.nih.gov/articles/PMC7154011)).
- Internalised weight bias is linked to avoiding healthcare and to worse weight-management outcomes ([Pearl & Puhl, Obes Rev 2018](https://media.ruddcenter.uconn.edu/PDFs/Pearl_et_al-2018-Obesity_Reviews.pdf); [Puhl et al., PLoS ONE 2021](https://pmc.ncbi.nlm.nih.gov/articles/PMC8168902)).

---

## 5. Sleep, stress, alcohol

### 5.1 Sleep
- Short sleep is associated with obesity in adults (**pooled OR 1.55**), but causality is uncertain ([Cappuccio et al., Sleep 2008](https://pubmed.ncbi.nlm.nih.gov/18517032/)).
- **RCT.** In adults with overweight who slept <6.5 h, sleep-hygiene counselling extended sleep by ~1.2 h/night and reduced energy intake by **~270 kcal/day** (measured by doubly labelled water) with no diet prescribed. It was a 2-week intervention ([Tasali et al., JAMA Intern Med 2022](https://pmc.ncbi.nlm.nih.gov/articles/PMC8822469)).

### 5.2 Stress
Prospective evidence shows psychosocial stress is a risk factor for weight gain, but the effect is **very small**. It was stronger in longer, higher-quality studies ([Wardle et al., Obesity 2011](https://zendy.io/title/10.1038/oby.2010.241)). Treat stress as a trigger for problem-solving and planning (§4.6), not as a primary cause.

### 5.3 Alcohol
- Across 127 observational studies, **heavy drinking (>28 g/day)** was associated with overweight/obesity (OR 1.32). Light-to-moderate drinking and cohort-only analyses showed weaker or no associations ([Crit Rev Food Sci Nutr 2021](https://pubmed.ncbi.nlm.nih.gov/33998940/)).
- In experiments, drinking alcohol increased **food** energy intake as well as total intake, with no compensation ([Kwok et al., Br J Nutr 2019](https://pubmed.ncbi.nlm.nih.gov/30630543/)).

---

## 6. Weight maintenance (National Weight Control Registry)
- NWCR members lost an average of **~33 kg and kept it off >5 years**. Success was associated with continued adherence to diet and exercise, consistent eating across weekdays and weekends, low depression and disinhibition, and a medical trigger for losing weight. **After 2–5 years of maintenance, the odds of long-term success rise substantially** ([Wing & Phelan, AJCN 2005](https://pubmed.ncbi.nlm.nih.gov/16002825/)).
- **78% eat breakfast every day** and only 4% never do. This is cross-sectional, so it is not proof of cause ([Wyatt et al., Obes Res 2002](https://pubmed.ncbi.nlm.nih.gov/11836452/)).
- Ten-year follow-up (n=2,886): **>87% were still maintaining ≥10% loss at years 5 and 10**. Regain went with **declines in physical activity, dietary restraint and self-weighing**, and with increases in fat intake and disinhibition ([Thomas et al., Am J Prev Med 2014](https://www.sciencedaily.com/releases/2014/01/140106115351.htm)).
- High activity levels are typical of NWCR members (~2,800 kcal/week reported) ([Human Kinetics summary of Klem 1997 / Hill & Wing](https://us.humankinetics.com/blogs/excerpt/learning-from-the-national-weight-control-registry)). This is consistent with the ACSM guidance of more than 250 min/week for maintenance ([Donnelly 2009](https://pubmed.ncbi.nlm.nih.gov/19127177/)).
- *Caveat:* NWCR is a self-selected, self-reported registry, so it shows what maintainers do, not what causes maintenance.

---

## 7. Medical context and safety

### 7.1 When to involve a clinician
- Recommend checking with a clinician before starting, especially for people with diabetes (particularly on insulin or sulfonylureas), cardiovascular disease, kidney disease, or many medications. Clinician-delivered or clinician-referred intensive behavioural treatment is the guideline standard for BMI ≥30 ([USPSTF 2018](https://www.uspreventiveservicestaskforce.org/uspstf/recommendation/obesity-in-adults-interventions); [Wharton et al., CMAJ 2020](https://www.cmaj.ca/content/192/31/E875)).
- **Pregnancy.** Weight loss is not recommended during pregnancy, even with obesity. Weight reduction should happen *before* conception ([ACOG Committee Opinion 549](https://pubmed.ncbi.nlm.nih.gov/23262963/); [NY State DOH summary](https://Www.Health.Ny.gov/publications/2025.pdf)). The app should disable deficit targets for pregnant users.

### 7.2 Anti-obesity medication (neutral summary)
- **Semaglutide 2.4 mg** plus lifestyle: −14.9% vs −2.4% (placebo) at 68 weeks ([STEP 1, NEJM 2021](https://pmc.ncbi.nlm.nih.gov/articles/PMC8089593)). Stopping it led to substantial regain: +6.9% on placebo vs −7.9% continuing, over weeks 20–68 ([STEP 4, JAMA 2021](https://pmc.ncbi.nlm.nih.gov/articles/PMC7988425)).
- **Tirzepatide**: −15.0%, −19.5% and −20.9% (5/10/15 mg) vs −3.1% at 72 weeks ([SURMOUNT-1, NEJM 2022](https://acc.org/latest-in-cardiology/clinical-trials/2022/08/04/15/32/surmount-1)).
- Lifestyle habits remain the foundation. With medication, priorities include adequate protein, resistance training and managing GI side effects ([Joint advisory 2025](https://pubmed.ncbi.nlm.nih.gov/40450457/)). The app should be medication-neutral: support users who take medication, never prescribe or recommend a drug, and point them to their prescriber.

### 7.3 Eating-disorder safety
Behavioural weight management generally *reduces* binge eating in adults. However, **0–6.5%** of participants in four studies developed new eating-disorder symptoms, so monitoring is warranted ([Jebeile et al., Obes Rev 2023](https://pmc.ncbi.nlm.nih.gov/articles/PMC10909435)). People with eating disorders often seek weight-loss treatment rather than eating-disorder care (same source). Red flags for the app to screen for include binge eating, compensatory behaviours (vomiting, laxatives, compulsive exercise), overvaluing shape or weight, very rapid loss, intake below the calorie floor, and BMI <18.5.

---

## 8. Plateaus

**Expect them.** Weight typically plateaus at about 6 months in diet-based trials ([Franz 2007](https://pubmed.ncbi.nlm.nih.gov/17904936/)). Three mechanisms drive this:
1. Energy needs fall as weight falls, so the same intake produces slower loss. Half of a permanent intake change shows on the scale in ~1 year ([Hall 2011](https://pmc.ncbi.nlm.nih.gov/articles/PMC3880593/)).
2. Appetite rises ~100 kcal/day per kg lost, and intake creeps upward ([Polidori 2016](https://pubmed.ncbi.nlm.nih.gov/27804272/)).
3. Adherence and self-monitoring decline ([Thomas 2014 NWCR](https://www.sciencedaily.com/releases/2014/01/140106115351.htm); [Harvey 2019](https://pubmed.ncbi.nlm.nih.gov/30801989/)).

**Responses.** First check logging completeness. Then recalculate TDEE from the trend, and use structured problem-solving ([Perri 2001](https://researchdiscovery.drexel.edu/esploro/outputs/journalArticle/Relapse-Prevention-Training-and-Problem-Solving-Therapy/991014877884804721)). Options include tightening intake within the safety floor, adding activity toward 200–300 min/week ([Donnelly 2009](https://pubmed.ncbi.nlm.nih.gov/19127177/); [Look AHEAD](https://pmc.ncbi.nlm.nih.gov/articles/PMC2613279/)), adding structure such as meal replacements ([Astbury 2019](https://pmc.ncbi.nlm.nih.gov/articles/PMC6849863)), or *deliberately switching to maintenance* for a while. Look AHEAD added further intervention tools from month 7 for slow losers ([Look AHEAD](https://pmc.ncbi.nlm.nih.gov/articles/PMC2613279/)).

---

## Design rules for the app

1. **Initial RMR.** Use Mifflin-St Jeor: `10·kg + 6.25·cm − 5·age + 5` (men) or `− 161` (women). Label it an estimate with roughly ±10% error for individuals ([Mifflin 1990](https://agris.fao.org/search/ar/records/65de26fe7c7033e84be9ee76); [Frankenfield 2005](https://pure.psu.edu/en/publications/comparison-of-predictive-equations-for-resting-metabolic-rate-in-/)).
2. **Initial TDEE = RMR × PAL.** Ask about lifestyle and map it to PAL: default 1.4 for sedentary/light, 1.55, 1.7 for active, 1.85, and a maximum of 2.0 unless verified. Never exceed 2.4 ([FAO/WHO/UNU 2004](https://www.fao.org/4/Y5686E/y5686e07.htm)).
3. **Initial target = TDEE − 500 kcal** by default. Let the user choose −750 kcal if their projected rate stays ≤1% of body weight per week and ≤1 kg/week ([AHA/ACC/TOS 2013](https://www.acc.org/about-acc/press-releases/2013/11/12/15/20/111213acc_aha_obesity_guideline); [CDC](https://www.cdc.gov/healthy-weight-growth/losing-weight)).
4. **Hard calorie floor.** `max(target, 1200)` for women and `max(target, 1500)` for men. Never generate a target below 1,200 kcal. Show "requires medical supervision" for any request for <800 kcal/day, or for 800–1,200 kcal/day programmes beyond self-directed use ([AHA/ACC/TOS 2013](https://in.bgu.ac.il:443/en/fohs/communityhealth/Family/Documents/OBESITY%20%202013%20AHA%20ACC%20TOS%20Guideline%20for%20the%20MANAGEMENT%20of%20OVERWEIGHT%20and%20OBESITY%20in%20ADULTS%20%20Circulation%2012.11.2013.pdf); [NICE NG246](https://www.nice.org.uk/guidance/NG246/chapter/physical-activity-and-diet)).
5. **Weight trend.** Smooth daily weights with an exponential moving average (α≈0.1) **[derived]**. Display the trend, not the raw daily number, to dampen water noise and discouragement. Encourage daily weighing, framed as data rather than judgement ([Steinberg 2015](https://pubmed.ncbi.nlm.nih.gov/25683820/); [Shieh 2016](https://pubmed.ncbi.nlm.nih.gov/26896865/)).
6. **Adaptive TDEE.** Every 7 days, once there are ≥14 days of data with ≥80% of days logged, compute `TDEE_obs = mean_intake − (Δtrend_kg × 7700) / days` **[derived; tissue energy from [Hall 2011 appendix](https://www.niddk.nih.gov/-/media/Files/BWP/Hall_Lancet_Web_Appendix.pdf)]**. Blend it as `TDEE_new = 0.7·TDEE_old + 0.3·TDEE_obs`, cap each weekly change at ±150 kcal, and then reapply rules 3–4.
7. **Weight-based recalculation.** Even without good logs, recompute the formula TDEE for every 2 kg lost, since needs fall by roughly 24 kcal/day per kg ([Hall 2011](https://pmc.ncbi.nlm.nih.gov/articles/PMC3880593/)).
8. **Rate guardrails.** If the trend loss is >1% of body weight/week for 3 consecutive weeks, raise the target by 100–200 kcal and show a safety message. If loss is <0.25%/week for ≥3 weeks with good logging, start the plateau flow (rule 20) ([CDC](https://www.cdc.gov/healthy-weight-growth/losing-weight); [Franz 2007](https://pubmed.ncbi.nlm.nih.gov/17904936/)).
9. **Protein target.** `1.2 g × reference_kg`, where `reference_kg = min(actual_kg, 30 × height_m²)`. Allow up to 1.6 g/kg of the reference weight. Pair it with a resistance-training prompt ([Weijs 2025](https://pure.amsterdamumc.nl/ws/portalfiles/portal/142148308/Protein-requirement-in-obesity.pdf); [Clin Nutr ESPEN 2024](https://pubmed.ncbi.nlm.nih.gov/39002131/); [Lopez 2022](https://pmc.ncbi.nlm.nih.gov/articles/PMC9285060)).
10. **Fibre target.** ≥25 g/day, with stretch goals toward 30 g/day ([Reynolds 2019](https://pubmed.ncbi.nlm.nih.gov/30638909/)).
11. **Diet pattern is the user's choice.** Offer low-fat, lower-carb, Mediterranean, meal replacement and optional TRE templates with the same calorie target. Never claim one is metabolically superior ([DIETFITS 2018](https://pmc.ncbi.nlm.nih.gov/articles/PMC5839290); [Mancini 2016](https://pubmed.ncbi.nlm.nih.gov/26721635/); [Liu 2022](https://pubmed.ncbi.nlm.nih.gov/35443107/); [Astbury 2019](https://pmc.ncbi.nlm.nih.gov/articles/PMC6849863)).
12. **Food-quality nudges.** Score meals on processing level and energy density, and suggest swaps: whole for ultra-processed, water-rich produce to add volume, water or zero-calorie drinks for sugary drinks. Track sugary drinks and alcohol as their own habits ([Hall 2019](https://pubmed.ncbi.nlm.nih.gov/31105044/); [Ello-Martin 2007](https://pubmed.ncbi.nlm.nih.gov/17556681/); [Malik 2013](https://pubmed.ncbi.nlm.nih.gov/23966427/); [Kwok 2019](https://pubmed.ncbi.nlm.nih.gov/30630543/)).
13. **Activity progression.** Baseline = the user's current week. Increase weekly minutes by ≤10–20 min/week (or ≤10% of the current total) **[derived]** toward 150 min/week, then 200–300 min/week for loss and maintenance. Default to low-impact options when the user reports joint pain ([WHO 2020](https://pmc.ncbi.nlm.nih.gov/articles/PMC7719906/); [PAG 2018](https://www.aafp.org/pubs/afp/issues/2019/0701/p58.html); [Donnelly 2009](https://pubmed.ncbi.nlm.nih.gov/19127177/); [Look AHEAD](https://pmc.ncbi.nlm.nih.gov/articles/PMC2613279/)).
14. **Strength.** From week 2, schedule 2 non-consecutive days per week of whole-body resistance work, starting with bodyweight or band exercises ([WHO 2020](https://pmc.ncbi.nlm.nih.gov/articles/PMC7719906/); [Lopez 2022](https://pmc.ncbi.nlm.nih.gov/articles/PMC9285060)).
15. **Steps.** Set the target at baseline + 500–1,000 steps/day, raised every 1–2 weeks once the user hits it on ≥5 of 7 days **[derived]**. Cap the long-term target at ~8,000–10,000 (<60 years) or ~6,000–8,000 (60+) ([Paluch 2022](https://pubmed.ncbi.nlm.nih.gov/35247352/)). Never convert steps into "extra food allowance" ([Thomas 2012](https://pmc.ncbi.nlm.nih.gov/articles/PMC3771367)).
16. **Habit engine.** Each habit is a tiny behaviour plus an existing-routine cue plus an if-then plan: "After I [cue], I will [behaviour]". Prefer *additive* habits. Allow at most 1–2 new habits at a time and add the next once the current ones are consistent ([Gardner 2012](https://pmc.ncbi.nlm.nih.gov/articles/PMC3505409/); [Gollwitzer & Sheeran 2006](https://www.socmot.uni-konstanz.de/publications/implementation-intentions-and-goal-achievement-meta-analysis-effects-and-processes); [Adriaanse 2011](https://www.socmot.uni-konstanz.de/sites/default/files/adriaanse2011.pdf)).
17. **Habit timeline.** Show a ~66-day automaticity horizon (range 18–254). **A single missed day does not break the streak**: use a "never miss twice" rule and flag only repeated misses ([Lally 2010](https://www.ucl.ac.uk/news/2009/aug/how-long-does-it-take-form-habit)).
18. **Logging UX.** Optimise for fast, frequent entries (target <15 min/day in total). Reward logging consistency, not low numbers ([Harvey 2019](https://pubmed.ncbi.nlm.nih.gov/30801989/); [Burke 2011](https://pmc.ncbi.nlm.nih.gov/articles/PMC3268700)).
19. **Milestones.** Celebrate 5%, 7% and 10% losses and explain their health meaning: 5% improves glucose, blood pressure and lipids; 7% was the DPP goal (58% fewer diabetes cases); 10–15% brings larger gains ([Wing 2011](https://pmc.ncbi.nlm.nih.gov/articles/PMC3120182/); [DPP 2002](https://pubmed.ncbi.nlm.nih.gov/11832527/)).
20. **Plateau flow** (triggered by rule 8). (a) Check logging accuracy. (b) Recompute adaptive TDEE. (c) Run a guided problem-solving script: identify the barrier, brainstorm options, pick one, try it for 2 weeks. (d) Offer the options: −100 to −200 kcal (respecting the floor), +30 min/week activity, more meal structure, or a planned 4–8-week maintenance phase ([Perri 2001](https://researchdiscovery.drexel.edu/esploro/outputs/journalArticle/Relapse-Prevention-Training-and-Problem-Solving-Therapy/991014877884804721); [Franz 2007](https://pubmed.ncbi.nlm.nih.gov/17904936/); [Look AHEAD](https://pmc.ncbi.nlm.nih.gov/articles/PMC2613279/)).
21. **Early slow-responder support.** If the trend loss is <2% at week 8 **[derived threshold]**, increase support (more check-ins, a structure option such as meal replacements, and a suggestion to talk to a clinician). Use no punitive messaging ([Unick 2015](https://pmc.ncbi.nlm.nih.gov/articles/PMC4481874); [Look AHEAD](https://pmc.ncbi.nlm.nih.gov/articles/PMC2613279/)).
22. **Maintenance mode.** Switch on at the goal weight or on request. Set target = adaptive TDEE and define a ±2 kg trend band **[derived]**. Keep daily weighing, 200–300 min/week activity, a consistent weekday/weekend eating pattern, and a breakfast/meal routine. Alert the user to start a "reset" problem-solving session when the trend exceeds band +2 kg, or when activity or self-weighing drops for 2 weeks ([Wing & Phelan 2005](https://pubmed.ncbi.nlm.nih.gov/16002825/); [Thomas 2014](https://www.sciencedaily.com/releases/2014/01/140106115351.htm); [Wyatt 2002](https://pubmed.ncbi.nlm.nih.gov/11836452/); [Donnelly 2009](https://pubmed.ncbi.nlm.nih.gov/19127177/)).
23. **Sleep and alcohol habits.** If self-reported sleep is <7 h, offer a sleep-extension habit with a bedtime cue. Offer alcohol-reduction habits when intake exceeds ~2 drinks/day (>28 g/day) ([Tasali 2022](https://pmc.ncbi.nlm.nih.gov/articles/PMC8822469); [Crit Rev Food Sci Nutr 2021](https://pubmed.ncbi.nlm.nih.gov/33998940/)).
24. **Tone and stigma.** Use person-first, non-blaming language (for example "person with obesity"). Avoid "cheat", "bad food" and moral framing. Respond to lapses with self-compassion prompts followed by a next-action plan ([Rubino 2020](https://pmc.ncbi.nlm.nih.gov/articles/PMC7154011); [Pearl & Puhl 2018](https://media.ruddcenter.uconn.edu/PDFs/Pearl_et_al-2018-Obesity_Reviews.pdf); [Brenton-Peters](https://eprints.whiterose.ac.uk/160045/3/Self-compassion%20and%20eating%20-%20CPR%20%28final%29.pdf)).
25. **Safety screening at onboarding and every 4 weeks.** Block deficit mode and show a support or clinician message for:
    - pregnancy or breastfeeding;
    - age <18;
    - BMI <18.5, or a goal weight below BMI 18.5;
    - binge or compensatory behaviours, or overvaluing shape and weight;
    - rapid loss (rule 8).

   Also recommend seeing a clinician for diabetes medication, CVD or CKD ([ACOG CO 549](https://pubmed.ncbi.nlm.nih.gov/23262963/); [Jebeile 2023](https://pmc.ncbi.nlm.nih.gov/articles/PMC10909435); [USPSTF 2018](https://www.uspreventiveservicestaskforce.org/uspstf/recommendation/obesity-in-adults-interventions)).
26. **Medication-neutral support.** Let users flag GLP-1 or other anti-obesity medication use. When they do, raise the priority of protein (rule 9) and strength (rule 14), relax deficit prompts, note that intake may already be low, enforce the floor, and add a maintenance plan in case the medication stops. Never recommend starting, stopping or dosing a drug ([Joint advisory 2025](https://pubmed.ncbi.nlm.nih.gov/40450457/); [STEP 4](https://pmc.ncbi.nlm.nih.gov/articles/PMC7988425)).
