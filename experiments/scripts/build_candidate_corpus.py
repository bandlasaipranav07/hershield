import json
import re
from typing import List, Dict, Any

# Frozen contract counts:
# EMERGENCY = 150
# NOT_EMERGENCY_TRIGGER_WORD = 90
# NOT_EMERGENCY_CLEAN = 40
# AMBIGUOUS = 20
# TOTAL = 300

# 150 Diverse Emergency Utterances
EMERGENCY_UTTERANCES = [
    # Explicit assault / attack (25)
    "Someone is attacking me please send help immediately",
    "Help me I am being assaulted near the east parking lot",
    "He grabbed my arm and is trying to pull me into an alley",
    "Please help someone has a knife and is threatening me",
    "I am being attacked right now behind the science block",
    "Stop get off me someone please help me",
    "There is a man trying to force me into his car call the police",
    "I am bleeding and hurt please call an ambulance right now",
    "Help he is hitting me and took my phone",
    "Someone please help me I am trapped in the stairwell with an attacker",
    "Emergency someone just kicked open my door and is armed",
    "Please send the police right now a guy is attacking people",
    "Help me I am trapped in the elevator and being threatened",
    "He won't let me leave and is physically holding me down",
    "Somebody help he is choking me",
    "Attack in progress near the library basement send security",
    "I need an ambulance immediately someone is stabbed and bleeding",
    "Please save me he is threatening to hurt me if I move",
    "Help me please someone broke into my apartment while I'm inside",
    "There is an intruder in my room with a weapon please help",
    "I am screaming for help someone is trying to drag me away",
    "Emergency attack near the main gate please send someone fast",
    "He is violently kicking the door down please help me",
    "Someone is physically threatening my life send the police",
    "Please help me I am severely hurt and need an ambulance immediately",

    # Stalking / being followed / actively pursued (35)
    "Someone is following me down this dark alley and getting closer",
    "Please help a strange man has been following me for four blocks",
    "I think someone is stalking me home and he is speeding up behind me",
    "Help me I am being chased by two men near the subway station",
    "There is a car following me slowly and the driver is yelling threats",
    "Someone is following my footsteps in the dark please stay on the line",
    "I am running because a guy is chasing me down 5th avenue please help",
    "A man in a black hoodie is trailing me and won't leave me alone",
    "Help me someone is watching my house and circling the windows",
    "I am scared because someone followed me off the bus into my building",
    "Please send help a group of men is cornering me in the underpass",
    "Someone is following me home from campus and I am terrified",
    "He has been following me since the train station please call police",
    "I am running to find a store because a man is chasing me",
    "Help there is someone right behind me in the parking garage",
    "A strange guy followed me into the dark walkway please hurry",
    "Someone is tracking my walk and hiding behind cars please help",
    "I am trapped at the bus stop and a man is threatening to follow me home",
    "Please help me I am being followed by an aggressive stranger",
    "He is waiting outside my dorm entrance and following every move I make",
    "Someone is chasing me down the street please send police now",
    "I need help right now a man followed me off the metro and is approaching",
    "There is an aggressive person following me down maple street",
    "Help me please he is following right behind me on a bicycle",
    "Someone has been tailing me through the park and it is getting dark",
    "Please call the police I am being stalked by an angry ex-partner",
    "He followed me into the empty hallway and blocked the exit",
    "Someone is following me and whispered threats when I walked past",
    "Help I'm running toward the library because someone is pursuing me",
    "A man is following me down the sidewalk and trying to grab my bag",
    "Please help I'm hiding behind a car while a stranger searches for me",
    "He followed me from the cafe and is now standing outside my window",
    "Someone is following me in an unmarked car please help me track location",
    "I'm terrified someone is stalking me through the dark campus path",
    "Please send emergency contacts a man is chasing me across the road",

    # Severe distress / immediate peril / screams / trapped (35)
    "Save me please I cannot get out and water is rising",
    "Help me I am trapped in a burning room and cannot breathe",
    "Someone save me I am locked inside the storage unit and it is freezing",
    "Emergency please I am trapped under heavy debris after a crash",
    "Save me please there is someone breaking in through the window",
    "Help me please I cannot move and someone is in the hallway",
    "I am terrified someone is trying to force open my bathroom door",
    "Save me I fell down the ravine and broke my leg please send help",
    "Emergency someone please call the ambulance my sister is unconscious and bleeding",
    "Help me save me someone is setting fire to the front porch",
    "Please save me I am hiding in the closet while someone searches my room",
    "Help I am locked in a car and the driver refuses to let me out",
    "Someone help me I am being held against my will in an abandoned house",
    "Save me please my breathing is failing and I have severe chest pain",
    "Emergency send police now shots fired near the student center",
    "Please help me I am lost in the woods at night and hear someone shouting threats",
    "Help me I am being held hostage in the convenience store",
    "Save me please the building roof collapsed and we are pinned down",
    "Emergency someone please help I am injured and bleeding heavily from my arm",
    "Please call the police immediately there is an active intruder in my home",
    "Help me save me someone is pushing me toward the train tracks",
    "I am trapped inside an elevator that is slipping please hurry",
    "Someone help me I am having an acute anaphylactic shock and cannot speak",
    "Save me please a violent person is smashing my front door with a bat",
    "Emergency send help to 4th street an assault is happening right now",
    "Help me I am hiding in the bathroom stall and someone is trying to force the lock",
    "Please save me I am surrounded by hostile people threatening violence",
    "Emergency someone took my friend by force please track our location",
    "Help I am injured in a hit and run on grand avenue please send ambulance",
    "Save me please someone is threatening to shoot me if I scream",
    "Please help me I am bleeding out and nobody is around on the street",
    "Emergency call the police a man broke my window and entered the house",
    "Help me please I'm trapped on the balcony and smoke is everywhere",
    "Save me someone is following my child and me with a weapon",
    "Please send help right now I am under immediate physical threat",

    # Colloquial / Naturalistic / Urgent Emergency (30)
    "Yo someone help me this guy won't leave me alone and just pulled a knife",
    "Please help me right now I am super scared this dude is following me home",
    "Hey emergency send the cops someone is kicking my car window right now",
    "Help help someone grabbed my wrist and is dragging me into the bushes",
    "I need urgent help someone please call 911 a guy is attacking my roommate",
    "Please somebody help me I'm trapped in the basement and hear footsteps",
    "Help me out here please a man is following me down elm street and I'm alone",
    "Oh god please help me someone is breaking through my back door",
    "Emergency please call police a stranger is trying to break into my dorm",
    "Help me I got jumped by two guys near the basketball court",
    "Please help I'm being followed by a group of guys shouting disgusting threats",
    "Someone help me fast I'm hiding under the staircase while an intruder walks around",
    "Hey please send help immediately I'm hurt really bad and can't stand up",
    "Help me someone is forcing their way into my taxi please track my ride",
    "Oh no please help he has a weapon and is cornering me",
    "Emergency send help to the chemistry annex someone is threatening us with a pipe",
    "Please help me I'm running as fast as I can from a suspicious man",
    "Help me please someone just shoved me to the ground and is stealing my bag",
    "I need police right now a man is stalking my apartment door",
    "Help me save me I'm being chased across the campus quad",
    "Please help someone is banging on my window shouting they're going to hurt me",
    "Emergency I was attacked while jogging on the north trail please hurry",
    "Help me please I'm in danger this person refuses to let me leave the room",
    "Please send an ambulance someone is unconscious and bleeding on the sidewalk",
    "Help I'm being followed by a creepy man who has been trailing me since 8pm",
    "Emergency please call contacts someone is breaking the lock on my door",
    "Help me someone is threatening to assault me if I don't give them my money",
    "Please help I'm hiding in the bushes because a guy was following me with a bat",
    "Help me fast someone is trying to force open my car door at the red light",
    "Emergency someone is attacking people at the transit station send police",

    # Direct terse distress & SOS phrases (25)
    "Emergency please help",
    "I am in danger please help me",
    "Attack send police now",
    "Someone is following me help",
    "Please help me someone is attacking me",
    "I am being followed send help",
    "Help someone broke in",
    "Emergency send ambulance bleeding",
    "Please save me in danger",
    "Attacked on campus need police",
    "Help he has a weapon",
    "Trapped and threatened please help",
    "Someone is chasing me help",
    "Emergency assault in progress",
    "Help me I am hurt and bleeding",
    "Stranger following me send help",
    "Emergency intruder inside my apartment",
    "Please help me someone grabbed me",
    "Danger someone is following me home",
    "Save me trapped in alley with attacker",
    "Help me police needed immediately",
    "Emergency being attacked near parking",
    "Help me he won't let me go",
    "Under attack please send emergency contacts",
    "Help someone is threatening my life right now"
]

# 90 Non-Emergency Trigger Word Utterances (Benign usage of trigger words)
NOT_EMERGENCY_TRIGGER_WORD_UTTERANCES = [
    # "Help" in casual, academic, household, or work context (35)
    "Can you help me with my math homework tomorrow evening?",
    "Could you help me carry these heavy grocery bags up the stairs?",
    "I need someone to help me organize the student club meeting next week",
    "Please help me proofread my resume before I send it to the recruiter",
    "Thanks for offering to help me move my sofa on Saturday morning",
    "Would you mind helping me find my lost keys in the cafeteria?",
    "Can anyone help me understand how this physics formula works?",
    "I'll help you prepare dinner as soon as I finish this work email",
    "Could you help me choose a good dress for my sister's wedding?",
    "Let me know if you need help setting up the classroom projector",
    "Can you help me practice for my Spanish speaking exam tomorrow?",
    "I helped my brother paint his room over the long weekend",
    "She asked if I could help her clean up the laboratory after class",
    "Help me remember to buy milk and eggs when we go to the supermarket",
    "Can you help me connect my laptop to the campus wireless network?",
    "We need to help each other prepare for the final semester presentations",
    "Could you help me water my plants while I am away on vacation?",
    "I appreciate all the help you gave me during the job search process",
    "Help me brainstorm some good ideas for our marketing class project",
    "Can you help me find a quiet coffee shop near the train station?",
    "I will help my roommate fix the bicycle chain this afternoon",
    "Could you please help me translate this paragraph into English?",
    "Help me decide whether I should take statistics or calculus next semester",
    "Can you help me bake a birthday cake for mom tomorrow night?",
    "I need someone to help me practice my guitar chords for the concert",
    "Thanks for your help with setting up the volleyball net on the lawn",
    "Can you help me check if the library is still open right now?",
    "Please help me carry this box of textbooks to the faculty office",
    "She always offers to help younger students with their programming labs",
    "Help me pick between the blue shirt and the white one for the interview",
    "Can you help me debug this null pointer exception in my code?",
    "I promised to help my dad clean out the garage on Sunday",
    "Could you help me assemble this new bookshelf from IKEA?",
    "Help me write a thank you note to the scholarship committee",
    "Can someone help me figure out the bus schedule for the morning route?",

    # "Emergency" in metaphorical, minor inconvenience, or movie/drill context (20)
    "This wardrobe choice is a total fashion emergency for tonight's party",
    "We ran out of coffee beans this morning which is an absolute emergency",
    "The professor scheduled an emergency review session before the midterm exam",
    "Make sure you know where the emergency exit stairs are located in this building",
    "I watched a really intense emergency room documentary on television last night",
    "We had a minor plumbing emergency when the kitchen sink started leaking",
    "The dental clinic handles walk-in emergency appointments on weekday mornings",
    "Our team held an emergency meeting to fix the website downtime issue",
    "I keep a spare phone charger in my backpack for low battery emergencies",
    "There was a fire emergency drill in our dormitory at ten o'clock today",
    "He declared an ice cream emergency because the freezer stopped working",
    "The airline demonstrated how to use the emergency oxygen masks before takeoff",
    "We need an emergency supply of snacks for our all-night study session",
    "She packed an emergency sewing kit in case a button fell off during the trip",
    "The city council discussed the flood emergency management policy guidelines",
    "I consider running out of printer paper right before class an emergency",
    "The company updated its emergency evacuation procedures for the winter",
    "We watched an old television show about an emergency rescue team in the mountains",
    "My mom calls it a family emergency whenever the internet router stops working",
    "The hostel staff conducted a routine emergency siren test this morning",

    # "Danger", "Attack", "Threat", "Scared", "Save", "Police", "Ambulance", "Hurt", "Scream" in benign contexts (35)
    "The opposing soccer team has a really dangerous striker who scores easily",
    "Eating too much junk food every day is a danger to long term health",
    "Our chess coach told us to launch an aggressive attack on the king side",
    "The basketball team's fast break attack was impossible to defend today",
    "High inflation is a serious threat to the local economic recovery",
    "The invasive weed species poses a minor threat to the native garden plants",
    "I was so scared while watching that funny horror comedy movie yesterday",
    "She is scared of speaking in front of large crowds during conferences",
    "Remember to save your document frequently so you don't lose any progress",
    "I managed to save twenty dollars by using coupons at the department store",
    "We should save some leftover pizza for lunch tomorrow afternoon",
    "A police cruiser was parked outside the stadium directing traffic after the game",
    "The guest lecture on police forensics and cybercrime was very informative",
    "I saw an ambulance driving down the highway with its sirens on yesterday",
    "My leg muscles really hurt after running that five kilometer race on Sunday",
    "His sharp comments hurt my feelings during the team retrospective meeting",
    "The rollercoaster ride was so thrilling that everyone started to scream with joy",
    "The audience screamed with excitement when the rock band came on stage",
    "Don't worry about hurting my feelings just give me honest feedback on the essay",
    "She saved a stray kitten from the rain and took it to the animal shelter",
    "That spicy chili pepper sauce is dangerous if you aren't used to hot food",
    "Our debate team mounted a strong attack against the opposing argument",
    "The cybersecurity workshop explained how phishing attacks target corporate emails",
    "I am terrified that I might fail my organic chemistry midterm on Friday",
    "He got scared by a tiny harmless moth fluttering near the reading lamp",
    "Let us save energy by turning off the lights when leaving the seminar room",
    "The local police department organized a friendly community charity marathon",
    "An ambulance transported the elderly patient for a routine scheduled checkup",
    "My shoulders hurt from carrying my heavy laptop backpack all afternoon",
    "The kids screamed with laughter while splashing in the community swimming pool",
    "Save some room for dessert because we baked chocolate chip cookies",
    "The defensive attack by our hockey team secured the championship victory",
    "She was scared she might miss her early flight to the regional conference",
    "He hurt his toe when he accidentally bumped against the coffee table leg",
    "The dramatic movie scene made the entire theater audience gasp and scream"
]

# 40 Non-Emergency Clean Utterances (Neutral, no trigger words)
NOT_EMERGENCY_CLEAN_UTTERANCES = [
    "The weather is exceptionally pleasant and sunny for a walk in the botanical garden",
    "Let us meet at the campus library around two in the afternoon to finish our project",
    "I really enjoyed the grilled chicken sandwich and iced green tea we had for lunch",
    "The morning lecture on artificial intelligence algorithms was engaging and clear",
    "She completed her weekly reading assignments well ahead of the Friday deadline",
    "We are planning to visit our grandparents in the countryside over the long weekend",
    "The city transit bus arrived exactly on schedule at the central station terminal",
    "I need to wash my laundry and fold all the clean clothes before dinner tonight",
    "His presentation on renewable energy sources received high praise from the faculty",
    "They are opening a brand new Italian restaurant with outdoor seating downtown",
    "I bought a couple of notebooks and black ink pens from the university bookstore",
    "The autumn leaves are turning bright orange and yellow along the riverside path",
    "We listened to classical piano music while studying in the quiet reading lounge",
    "My roommate baked a batch of blueberry muffins for our breakfast this morning",
    "The football match ended in an exciting two to two draw after extra time",
    "She is learning how to play the violin by taking lessons every Tuesday evening",
    "The train ride through the green mountain valley was peaceful and scenic",
    "I prefer studying in the early morning when the campus is completely quiet",
    "We booked our flight tickets for the upcoming winter holiday break yesterday",
    "The chemistry professor explained the molecular bonding principles on the whiteboard",
    "I am going to the grocery store to buy fresh vegetables and brown bread",
    "His new smartphone has an impressive high resolution camera and long battery life",
    "We walked along the lake shore and watched the sunset behind the hills",
    "She submitted her internship application to three different software engineering firms",
    "The university art gallery is hosting an exhibition of modern landscape paintings",
    "I borrowed a fascinating historical novel from the municipal public library",
    "Our biology study group meets twice every week in the student union building",
    "He brewed a fresh pot of herbal tea to drink while reading his novel",
    "The botanical garden features hundreds of exotic flowering plants and tall trees",
    "We had a productive discussion about the quarterly budget plan in our meeting",
    "She plays tennis with her colleagues every Saturday morning at the club",
    "The morning breeze was cool and refreshing as we jogged through the park",
    "I organized my desktop files into neat project folders to stay productive",
    "They celebrated their anniversary with a quiet dinner at a rooftop cafe",
    "The software update finished downloading and installed without any issues",
    "We watched a documentary about deep ocean marine life and coral reefs",
    "He wore a warm wool sweater because the autumn weather was turning chilly",
    "The campus shuttle runs every fifteen minutes between the dorms and classrooms",
    "She wrote a thoughtful review of the theater play for the student newspaper",
    "I look forward to spending a relaxing Sunday afternoon with my family at home"
]

# 20 Ambiguous Utterances (Underspecified or context-dependent phrasing)
AMBIGUOUS_UTTERANCES = [
    "I need help",
    "Someone help me please",
    "Help",
    "Please help",
    "I am scared right now",
    "Something is wrong here",
    "I do not feel safe in this place",
    "Please come outside right now",
    "Where are you I need you",
    "I hear weird noises outside my door",
    "Someone is standing near my car",
    "I think someone is watching me",
    "Can somebody come over quickly",
    "I don't know what to do right now",
    "Please answer your phone immediately",
    "There is a person lingering by the gate",
    "I am stuck and cannot get out",
    "Please check my location right now",
    "I feel really uneasy walking down this street",
    "Someone is knocking loudly on the window"
]

def generate_candidates():
    # Verify counts
    assert len(EMERGENCY_UTTERANCES) == 150, f"Expected 150 emergency, got {len(EMERGENCY_UTTERANCES)}"
    assert len(NOT_EMERGENCY_TRIGGER_WORD_UTTERANCES) == 90, f"Expected 90 trigger word, got {len(NOT_EMERGENCY_TRIGGER_WORD_UTTERANCES)}"
    assert len(NOT_EMERGENCY_CLEAN_UTTERANCES) == 40, f"Expected 40 clean, got {len(NOT_EMERGENCY_CLEAN_UTTERANCES)}"
    assert len(AMBIGUOUS_UTTERANCES) == 20, f"Expected 20 ambiguous, got {len(AMBIGUOUS_UTTERANCES)}"
    assert len(EMERGENCY_UTTERANCES) + len(NOT_EMERGENCY_TRIGGER_WORD_UTTERANCES) + len(NOT_EMERGENCY_CLEAN_UTTERANCES) + len(AMBIGUOUS_UTTERANCES) == 300

    items = []
    
    # Balanced scenario profiles (independent of label)
    # 4 standard context profiles distributed in a round-robin / stratified fashion
    # Profile 0: Routine / Home (Inactive, No Journey, Low Threat)
    # Profile 1: Normal Transit (Active, On Route, Low Threat)
    # Profile 2: Alert / Night Walk (Active, On Route, Medium Threat)
    # Profile 3: Elevated / Off-path (Active, Deviated, High Threat)
    context_profiles = [
        {"safety_mode": "INACTIVE", "journey_status": "NO_JOURNEY", "threat_level": "LOW", "repeated_trigger": False, "asr_confidence": 0.94},
        {"safety_mode": "ACTIVE", "journey_status": "ON_ROUTE", "threat_level": "LOW", "repeated_trigger": False, "asr_confidence": 0.91},
        {"safety_mode": "ACTIVE", "journey_status": "ON_ROUTE", "threat_level": "MEDIUM", "repeated_trigger": False, "asr_confidence": 0.88},
        {"safety_mode": "ACTIVE", "journey_status": "DEVIATED", "threat_level": "HIGH", "repeated_trigger": False, "asr_confidence": 0.85},
        {"safety_mode": "INACTIVE", "journey_status": "NO_JOURNEY", "threat_level": "MEDIUM", "repeated_trigger": False, "asr_confidence": 0.89},
        {"safety_mode": "ACTIVE", "journey_status": "DEVIATED", "threat_level": "LOW", "repeated_trigger": True, "asr_confidence": 0.82},
    ]

    profile_idx = 0

    # 1. Add Emergency
    for i, utt in enumerate(EMERGENCY_UTTERANCES):
        ctx = context_profiles[profile_idx % len(context_profiles)]
        profile_idx += 1
        items.append({
            "candidate_id": f"HS-CAND-{len(items)+1:03d}",
            "utterance": utt,
            "draft_category": "EMERGENCY",
            "scenario_context": ctx,
            "human_annotation": {
                "annotator_1": None,
                "annotator_2": None,
                "annotator_3": None,
                "resolved_source_label": None,
                "binary_ground_truth": None,
                "agreement_score": None,
                "status": "PENDING_HUMAN_ANNOTATION"
            }
        })

    # 2. Add Not Emergency Trigger Word
    for i, utt in enumerate(NOT_EMERGENCY_TRIGGER_WORD_UTTERANCES):
        ctx = context_profiles[profile_idx % len(context_profiles)]
        profile_idx += 1
        items.append({
            "candidate_id": f"HS-CAND-{len(items)+1:03d}",
            "utterance": utt,
            "draft_category": "NOT_EMERGENCY_TRIGGER_WORD",
            "scenario_context": ctx,
            "human_annotation": {
                "annotator_1": None,
                "annotator_2": None,
                "annotator_3": None,
                "resolved_source_label": None,
                "binary_ground_truth": None,
                "agreement_score": None,
                "status": "PENDING_HUMAN_ANNOTATION"
            }
        })

    # 3. Add Not Emergency Clean
    for i, utt in enumerate(NOT_EMERGENCY_CLEAN_UTTERANCES):
        ctx = context_profiles[profile_idx % len(context_profiles)]
        profile_idx += 1
        items.append({
            "candidate_id": f"HS-CAND-{len(items)+1:03d}",
            "utterance": utt,
            "draft_category": "NOT_EMERGENCY_CLEAN",
            "scenario_context": ctx,
            "human_annotation": {
                "annotator_1": None,
                "annotator_2": None,
                "annotator_3": None,
                "resolved_source_label": None,
                "binary_ground_truth": None,
                "agreement_score": None,
                "status": "PENDING_HUMAN_ANNOTATION"
            }
        })

    # 4. Add Ambiguous
    for i, utt in enumerate(AMBIGUOUS_UTTERANCES):
        ctx = context_profiles[profile_idx % len(context_profiles)]
        profile_idx += 1
        items.append({
            "candidate_id": f"HS-CAND-{len(items)+1:03d}",
            "utterance": utt,
            "draft_category": "AMBIGUOUS",
            "scenario_context": ctx,
            "human_annotation": {
                "annotator_1": None,
                "annotator_2": None,
                "annotator_3": None,
                "resolved_source_label": None,
                "binary_ground_truth": None,
                "agreement_score": None,
                "status": "PENDING_HUMAN_ANNOTATION"
            }
        })

    with open("data/candidates_v1.json", "w", encoding="utf-8") as f:
        json.dump({
            "version": "candidates_v1",
            "total_count": len(items),
            "distribution": {
                "EMERGENCY": 150,
                "NOT_EMERGENCY_TRIGGER_WORD": 90,
                "NOT_EMERGENCY_CLEAN": 40,
                "AMBIGUOUS": 20
            },
            "candidates": items
        }, f, indent=2)
    print("Successfully generated experiments/data/candidates_v1.json with 300 candidates.")

    # Also create the blank annotation sheet
    blank_sheet = []
    for item in items:
        blank_sheet.append({
            "candidate_id": item["candidate_id"],
            "utterance": item["utterance"],
            "annotator_1": "",
            "annotator_2": "",
            "annotator_3": "",
            "notes": ""
        })

    with open("data/annotation_package/annotation_sheet_blank.json", "w", encoding="utf-8") as f:
        json.dump({
            "title": "HerShield Human Annotation Sheet (Blank Template)",
            "instructions_ref": "experiments/data/annotation_package/README.md",
            "allowed_labels": [
                "EMERGENCY",
                "NOT_EMERGENCY_TRIGGER_WORD",
                "NOT_EMERGENCY_CLEAN",
                "AMBIGUOUS"
            ],
            "items": blank_sheet
        }, f, indent=2)
    print("Successfully generated experiments/data/annotation_package/annotation_sheet_blank.json.")

if __name__ == "__main__":
    generate_candidates()
