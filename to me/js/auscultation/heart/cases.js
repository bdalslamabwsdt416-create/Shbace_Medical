// Teaching descriptions are original summaries; references are linked per finding.
const valveReference=name=>'https://www.merckmanuals.com/professional/cardiovascular-disorders/valvular-disorders/'+name;
export const CASES={
 normal:{system:'heart',name:'Normal heart sounds',subtitle:'S₁ and S₂ · reference',audio:'normal',title:'Two sounds. One cardiac cycle.',text:'S₁ marks the start of ventricular systole. S₂ marks its end. Listen for the repeating pair and the longer pause after S₂.',pattern:'S₁ — S₂. Then a pause.',tip:'Find the two sounds before listening for anything between them. Compare the base and apex of the heart.',best:'mitral',piece:'diaphragm',type:'Original recording',timing:'S₁, then S₂',location:'Compare the apex and base',difference:'A murmur adds a sustained sound between the normal heart sounds. Do not confuse the quiet diastolic interval with a missing beat.',context:'This recording is a reference example. A normal-sounding examination does not rule out structural heart disease.',source:'https://www.merckmanuals.com/professional/cardiovascular-disorders/approach-to-the-cardiac-patient/cardiac-auscultation',strengths:{aortic:.8,pulmonic:.8,erb:.8,tricuspid:.8,mitral:.8}},
 stenosis:{system:'heart',name:'Aortic stenosis',subtitle:'Systolic · crescendo–decrescendo',audio:'stenosis',title:'Resistance at the aortic valve',text:'A narrowed aortic valve obstructs blood leaving the left ventricle. Turbulent ejection produces a murmur during systole.',pattern:'Builds up, then fades before S₂.',tip:'Listen at the second right intercostal space beside the sternum. The sound may radiate towards the carotid arteries.',best:'aortic',piece:'diaphragm',type:'Synthetic learning example',timing:'Systolic ejection murmur',location:'Aortic area · right upper sternal border',difference:'Unlike the more sustained systolic sound of mitral regurgitation, this example rises and falls in intensity. It is loudest near the heart base.',context:'The typical pattern helps identify a possible valve lesion. Echocardiography establishes anatomy and severity; loudness alone does not grade severity.',source:valveReference('aortic-stenosis'),strengths:{aortic:1,pulmonic:.6,erb:.55,tricuspid:.3,mitral:.22}},
 mitralRegurgitation:{system:'heart',name:'Mitral regurgitation',subtitle:'Systolic · blowing plateau',audio:'mitralRegurgitation',title:'Backflow during systole',text:'Incomplete mitral valve closure allows blood to flow from the left ventricle into the left atrium during systole. This example illustrates a sustained, blowing murmur.',pattern:'A blowing sound from S₁ towards S₂.',tip:'Use the diaphragm at the apex. Typical radiation is towards the left axilla; left lateral positioning may help at the bedside.',best:'mitral',piece:'diaphragm',type:'Synthetic learning example',timing:'Holosystolic (pansystolic)',location:'Mitral area · cardiac apex',difference:'Compare with aortic stenosis: the murmur is more sustained across systole and maximal at the apex, rather than peaking at the base.',context:'This is a classic pattern. Acute or mild regurgitation may sound different. The recording cannot determine severity; echocardiography assesses the valve and ventricular function.',source:valveReference('mitral-regurgitation'),strengths:{aortic:.24,pulmonic:.2,erb:.4,tricuspid:.58,mitral:1}},
 aorticRegurgitation:{system:'heart',name:'Aortic regurgitation',subtitle:'Diastolic · high-pitched decrescendo',audio:'aorticRegurgitation',title:'Backflow after the valve closes',text:'An incompletely closed aortic valve permits blood to return from the aorta to the left ventricle in diastole. The falling pressure gradient produces a fading murmur.',pattern:'S₂, followed by a fading blowing sound.',tip:'Use the diaphragm along the left sternal border, around the third or fourth intercostal space. Leaning forward at end-expiration can make it easier to hear.',best:'erb',piece:'diaphragm',type:'Synthetic learning example',timing:'Early diastole · after S₂',location:'Left sternal border · Erb’s point',difference:'Both aortic and mitral regurgitation are blowing sounds. Time them: aortic regurgitation starts after S₂; mitral regurgitation is heard during systole.',context:'A diastolic murmur warrants clinical assessment. This illustration does not reproduce all acute or chronic variants. Echocardiography confirms the lesion and assesses its severity.',source:valveReference('aortic-regurgitation'),strengths:{aortic:.55,pulmonic:.6,erb:1,tricuspid:.75,mitral:.3}},
 mitralStenosis:{system:'heart',name:'Mitral stenosis',subtitle:'Diastolic · low-pitched rumble',audio:'mitralStenosis',title:'Restricted ventricular filling',text:'A narrowed mitral valve restricts flow from the left atrium into the left ventricle during diastole. A mobile stenotic valve may produce an opening snap followed by a low rumble.',pattern:'S₂ → opening snap → low diastolic rumble.',tip:'Use the bell lightly at the apex. At the bedside, left lateral positioning and end-expiration help bring out the low-frequency murmur.',best:'mitral',piece:'bell',type:'Synthetic learning example',timing:'Diastolic rumble · after an opening snap',location:'Mitral area · cardiac apex',difference:'Aortic regurgitation is a higher-pitched, blowing diastolic murmur. Mitral stenosis is lower pitched and easier to hear with the bell at the apex.',context:'The opening snap can be absent in a heavily calcified valve. This example assumes sinus rhythm and includes late diastolic accentuation; this is not expected with atrial fibrillation.',source:valveReference('mitral-stenosis'),strengths:{aortic:.16,pulmonic:.18,erb:.25,tricuspid:.4,mitral:1}},
 normalLung:{system:'lung',name:'Normal breath sounds',subtitle:'Vesicular · reference',audio:'normalLung',title:'The normal breath sound',text:'Normal vesicular breathing is soft and rustling. Inspiration is louder and longer than the audible part of expiration. There is no sustained musical whistle or series of crackling bursts.',pattern:'Soft inspiration, followed by a quieter, shorter expiratory sound.',tip:'Listen to a complete breath with the diaphragm, then compare the same level on the opposite side.',best:'lung-right',piece:'diaphragm',type:'Manikin recording',timing:'Throughout inspiration · early expiration',location:'Peripheral lung fields · compare both sides',difference:'Wheeze adds a continuous musical whistle; crackles add brief, separate bursts. Compare each with this normal reference.',context:'Recorded from a clinical teaching manikin, not a patient. This single anterior recording is reused at all listening points to teach sound recognition; it does not reproduce regional differences. Normal-sounding breathing alone does not exclude disease.',source:'https://www.merckmanuals.com/professional/pulmonary-disorders/approach-to-the-pulmonary-patient/evaluation-of-the-patient-with-pulmonary-issues'},
 crackles:{system:'lung',name:'Crackles',subtitle:'Brief, discontinuous sounds',audio:'crackles',title:'Short interruptions in the breath sound',text:'Crackles are brief, discontinuous sounds associated with processes such as sudden opening of small airways. This recording comes from a person with pneumonia, but crackles alone do not establish that diagnosis.',pattern:'Separate crackling bursts, not a continuous whistle.',tip:'Listen over several breaths and compare matching points on both sides. This model makes the recording louder at the right posterior base for teaching.',best:'back-right-low',piece:'diaphragm',type:'Original recording',timing:'Brief sounds within the respiratory cycle',location:'Compare corresponding lung fields',difference:'Crackles are interrupted sounds; wheeze is sustained and musical. Describe timing, distribution and quality before suggesting a cause.',context:'Crackles can occur with pneumonia, pulmonary oedema or interstitial lung disease. This example and its simplified spatial distribution are not a diagnostic test.',source:'https://www.merckmanuals.com/professional/pulmonary-disorders/approach-to-the-pulmonary-patient/evaluation-of-the-patient-with-pulmonary-issues'},
 wheeze:{system:'lung',name:'Wheeze',subtitle:'Whistling · continuous, musical sound',audio:'wheeze',title:'Air moving through narrowed airways',text:'Wheeze is a sustained musical sound caused by airflow through narrowed airways. It often occurs in expiration and may be heard in asthma or COPD.',pattern:'A sustained whistling sound.',tip:'Compare both sides and listen throughout inspiration and expiration. These points illustrate listening technique, not a patient-specific map.',best:'lung-right',piece:'diaphragm',type:'Original recording',timing:'Continuous · often more evident in expiration',location:'Compare both sides of the chest',difference:'Unlike crackles, wheeze continues rather than breaking into short bursts. Wheeze is a finding, not a diagnosis of asthma.',context:'Assess breath sounds alongside respiratory effort, history and other findings. Severe airflow limitation can produce very little wheeze; a quiet chest is not proof of mild disease.',source:'https://www.merckmanuals.com/professional/pulmonary-disorders/symptoms-of-pulmonary-disorders/wheezing'}
};
Object.assign(CASES,{
  "s3": {
    "system": "heart",
    "name": "Third heart sound (S₃)",
    "subtitle": "Early diastole · extra low tone",
    "title": "An extra sound during rapid filling",
    "text": "Rapid early ventricular filling can produce a low-frequency S₃. In older adults it may indicate volume overload or ventricular dysfunction; in young people it can be physiological.",
    "pattern": "S₁ — S₂–S₃.",
    "tip": "Use the bell lightly at the apex; compare with normal sounds.",
    "best": "mitral",
    "piece": "bell",
    "timing": "Early diastole · after S₂",
    "location": "Apex for a left-sided S₃",
    "difference": "S₃ follows S₂; S₄ precedes S₁.",
    "context": "An S₃ alone does not diagnose heart failure. Manikin recording (HLS-CMDS), reused across listening points; regional differences are not recorded here.",
    "source": "https://www.merckmanuals.com/professional/cardiovascular-disorders/approach-to-the-cardiac-patient/cardiac-auscultation",
    "audio": "s3",
    "type": "Manikin recording"
  },
  "s4": {
    "system": "heart",
    "name": "Fourth heart sound (S₄)",
    "subtitle": "Late diastole · extra low tone",
    "title": "Atrial contraction meets a stiff ventricle",
    "text": "Atrial contraction against a poorly compliant ventricle produces a low-frequency S₄. It suggests impaired ventricular relaxation, for example with ventricular hypertrophy or ischaemia.",
    "pattern": "S₄–S₁ — S₂.",
    "tip": "Use the bell lightly. Identify the extra tone just before S₁.",
    "best": "mitral",
    "piece": "bell",
    "timing": "Late diastole · before S₁",
    "location": "Apex for a left-sided S₄",
    "difference": "Unlike S₃, S₄ occurs at the end of filling.",
    "context": "S₄ requires organised atrial contraction and is absent in atrial fibrillation. This manikin sample was recorded at the left upper sternal border; the apex tip describes clinical examination, not its recording site. Manikin recording (HLS-CMDS), reused across listening points; regional differences are not recorded here.",
    "source": "https://www.merckmanuals.com/professional/cardiovascular-disorders/approach-to-the-cardiac-patient/cardiac-auscultation",
    "audio": "s4",
    "type": "Manikin recording"
  },
  "fineCrackles": {
    "system": "lung",
    "name": "Fine crackles",
    "subtitle": "Short, high-pitched bursts",
    "title": "Small airways reopen abruptly",
    "text": "Sudden reopening of small airways produces brief, fine crackles, often during inspiration. They can accompany interstitial fibrosis or pulmonary oedema.",
    "pattern": "Brief, delicate crackling bursts.",
    "tip": "Listen through inspiration and compare the two bases.",
    "best": "back-right-low",
    "piece": "diaphragm",
    "timing": "Usually inspiration",
    "location": "Often basal · distribution depends on the cause",
    "difference": "Shorter and higher pitched than coarse crackles; not a continuous musical wheeze.",
    "context": "Crackles are a finding, not a diagnosis. This sample was recorded on the right lower anterior chest. Manikin recording (HLS-CMDS), reused across listening points; regional differences are not recorded here.",
    "source": "https://www.merckmanuals.com/professional/pulmonary-disorders/approach-to-the-pulmonary-patient/evaluation-of-the-patient-with-pulmonary-issues",
    "audio": "fineCrackles",
    "type": "Manikin recording"
  },
  "coarseCrackles": {
    "system": "lung",
    "name": "Coarse crackles",
    "subtitle": "Longer, lower-pitched bursts",
    "title": "Interrupted airflow in affected airways",
    "text": "Airway reopening and secretions can generate coarse crackles. These longer, lower-pitched bursts may accompany bronchiectasis or other airway disease.",
    "pattern": "Separate coarse pops or bubbling bursts.",
    "tip": "Compare with fine crackles and listen during both phases of breathing.",
    "best": "back-right-low",
    "piece": "diaphragm",
    "timing": "Inspiration and/or expiration",
    "location": "Distribution depends on the underlying process",
    "difference": "Discontinuous bursts, unlike the sustained rumble of rhonchi.",
    "context": "The sound alone cannot identify its cause. Recorded on the right lower anterior chest. Manikin recording (HLS-CMDS), reused across listening points; regional differences are not recorded here.",
    "source": "https://pmc.ncbi.nlm.nih.gov/articles/PMC5446130/",
    "audio": "coarseCrackles",
    "type": "Manikin recording"
  },
  "rhonchi": {
    "system": "lung",
    "name": "Rhonchi",
    "subtitle": "Low-pitched · continuous rumble",
    "title": "Airflow through narrowed larger airways",
    "text": "Secretions or narrowing in larger airways can produce low-pitched, snoring-like rhonchi. They can occur with bronchitis and may change after coughing.",
    "pattern": "A sustained low rumble.",
    "tip": "Compare its pitch with wheeze and its continuity with coarse crackles.",
    "best": "lung-left",
    "piece": "diaphragm",
    "timing": "Inspiration and/or expiration",
    "location": "Over affected airways",
    "difference": "Lower pitched than wheeze; more sustained than crackles.",
    "context": "Rhonchi do not establish a specific infection. This sample was recorded on the left upper anterior chest. Manikin recording (HLS-CMDS), reused across listening points; regional differences are not recorded here.",
    "source": "https://www.merckmanuals.com/professional/pulmonary-disorders/approach-to-the-pulmonary-patient/evaluation-of-the-patient-with-pulmonary-issues",
    "audio": "rhonchi",
    "type": "Manikin recording"
  },
  "pleuralRub": {
    "system": "lung",
    "name": "Pleural friction rub",
    "subtitle": "Rough · grating with breathing",
    "title": "Inflamed pleural surfaces rub together",
    "text": "Inflammation roughens the pleural surfaces. Their movement during breathing creates a localised grating sound, which can accompany pleuritis.",
    "pattern": "A rough, rubbing or creaking sound.",
    "tip": "Listen for a localised sound linked to inspiration and expiration.",
    "best": "lung-right-low",
    "piece": "diaphragm",
    "timing": "Often both respiratory phases",
    "location": "Localised over inflamed pleura",
    "difference": "Pleural rubbing follows breathing; pericardial rubbing follows the cardiac cycle.",
    "context": "A pleural rub may resemble crackles and requires clinical context. Recorded on the right middle anterior chest. Manikin recording (HLS-CMDS), reused across listening points; regional differences are not recorded here.",
    "source": "https://www.merckmanuals.com/professional/pulmonary-disorders/approach-to-the-pulmonary-patient/evaluation-of-the-patient-with-pulmonary-issues",
    "audio": "pleuralRub",
    "type": "Manikin recording"
  }
});
// New basic findings: relative levels are pedagogical, not patient-specific measurements.
Object.assign(CASES,{
  "tricuspidRegurgitation": {
    "system": "heart",
    "name": "Tricuspid regurgitation",
    "subtitle": "Systolic · lower left sternal border",
    "audio": "tricuspidRegurgitation",
    "title": "Backflow through the tricuspid valve",
    "text": "An incompletely closed tricuspid valve allows blood to return from the right ventricle to the right atrium during systole. Listen for a sustained blowing sound between S₁ and S₂.",
    "pattern": "A blowing murmur during systole.",
    "tip": "Compare all five areas. In this teaching example the recording is loudest at the lower left sternal border and quieter elsewhere.",
    "best": "tricuspid",
    "piece": "diaphragm",
    "type": "Patient recording",
    "timing": "Systolic · typically holosystolic",
    "location": "Lower left sternal border · tricuspid area",
    "difference": "Mitral regurgitation is usually loudest at the apex. Tricuspid regurgitation is usually best heard near the lower sternum and often increases with inspiration.",
    "context": "Recorded at the tricuspid area; the source clinician documented an audible tricuspid murmur. This patient also had mitral regurgitation, so this is not an isolated valve lesion. Point-to-point levels are a simplified teaching map, not measured transmission; respiratory changes are not simulated. Loudness does not grade severity.",
    "source": "https://www.merckmanuals.com/professional/cardiovascular-disorders/valvular-disorders/tricuspid-regurgitation",
    "strengths": {
      "aortic": 0.3,
      "pulmonic": 0.36,
      "erb": 0.64,
      "tricuspid": 1,
      "mitral": 0.48
    }
  },
  "pulmonaryStenosis": {
    "system": "heart",
    "name": "Pulmonary stenosis",
    "subtitle": "Systolic · left upper sternal border",
    "audio": "pulmonaryStenosis",
    "title": "Resistance at the pulmonary valve",
    "text": "A narrowed pulmonary valve obstructs blood leaving the right ventricle. Turbulent flow during ejection produces a systolic murmur that rises and falls in intensity.",
    "pattern": "A rough systolic sound that builds, then fades.",
    "tip": "Listen at the second left intercostal space beside the sternum. Compare with the aortic area on the right.",
    "best": "pulmonic",
    "piece": "diaphragm",
    "type": "Patient recording",
    "timing": "Systolic ejection murmur",
    "location": "Left upper sternal border · pulmonary area",
    "difference": "Both aortic and pulmonary stenosis produce an ejection murmur. Their usual sites of greatest intensity differ: right versus left upper sternal border.",
    "context": "Short published clinical excerpt, repeated for listening practice. The source describes marked obstruction; this is one example, not every presentation. Point-to-point levels are a simplified teaching map, not recordings from each site. Echocardiography determines anatomy and severity.",
    "source": "https://www.merckmanuals.com/professional/cardiovascular-disorders/valvular-disorders/pulmonary-stenosis",
    "strengths": {
      "aortic": 0.42,
      "pulmonic": 1,
      "erb": 0.65,
      "tricuspid": 0.32,
      "mitral": 0.24
    }
  },
  "reducedBreathSounds": {
    "system": "lung",
    "name": "Reduced breath sounds",
    "subtitle": "Right base · compare both sides",
    "audio": "normalLung",
    "title": "Less sound reaches the stethoscope",
    "text": "Breath sounds become quieter when airflow is reduced or sound transmission to the chest wall is impaired. This example models reduced intensity at the right lung base, as may occur over a pleural effusion.",
    "pattern": "Quiet breathing at the right base; clearer breathing on the left.",
    "tip": "Listen at the right posterior base, then use Compare other side without changing the volume. Compare the upper fields too.",
    "best": "back-right-low",
    "piece": "diaphragm",
    "type": "Simulated attenuation · manikin recording",
    "timing": "Reduced intensity throughout the breath",
    "location": "Right posterior base · compare with the left base",
    "difference": "This is a difference in loudness, not an added wheeze or crackle. A quiet region should be compared with the corresponding point on the other side.",
    "context": "The normal manikin recording is deliberately attenuated to teach a regional difference. This is not a patient recording of pleural effusion and does not model all its acoustic effects. Reduced sounds can also occur with pneumothorax or airway obstruction; the sound alone does not identify the cause.",
    "source": "https://www.merckmanuals.com/professional/pulmonary-disorders/approach-to-the-pulmonary-patient/evaluation-of-the-patient-with-pulmonary-issues",
    "strengths": {
      "lung-right": 0.8,
      "lung-left": 0.8,
      "lung-right-low": 0.48,
      "lung-left-low": 0.8,
      "back-right": 0.68,
      "back-left": 0.8,
      "back-right-low": 0.12,
      "back-left-low": 0.8
    }
  }
});
Object.assign(CASES,{
  ventricularSeptalDefect: {
    system: 'heart',
    name: 'Ventricular septal defect',
    subtitle: 'VSD · harsh systolic murmur',
    audio: 'ventricularSeptalDefect',
    title: 'Flow through an opening between the ventricles',
    text: 'A ventricular septal defect is an opening in the wall separating the ventricles. During systole, the pressure difference usually drives blood from left to right. Turbulent flow through the opening produces a harsh murmur.',
    pattern: 'A rough systolic murmur, typically extending from S₁ to S₂.',
    tip: 'Use the diaphragm at the lower left sternal border. Compare the neighbouring areas at the same volume.',
    best: 'tricuspid',
    piece: 'diaphragm',
    type: 'Patient recording',
    timing: 'Systolic · typically holosystolic',
    location: 'Lower left sternal border · same listening area as the tricuspid valve',
    difference: 'Mitral regurgitation is usually loudest at the apex. A VSD is usually loudest beside the lower sternum; a murmur at this site does not necessarily arise from the tricuspid valve.',
    context: 'Louder does not mean a larger defect: a restrictive VSD can be very noisy, while pressure equalisation can soften the murmur of a large defect. Echocardiography establishes the diagnosis. This short published clinical excerpt repeats for practice. Relative levels across the five points are a teaching map, not recordings from each site.',
    source: 'https://www.merckmanuals.com/professional/pediatrics/congenital-cardiovascular-anomalies/ventricular-septal-defect-vsd',
    strengths: {aortic: .3, pulmonic: .4, erb: .72, tricuspid: 1, mitral: .5}
  }
});
// The generic patient crackles example remains in Explore; the quiz uses the specific subtypes.
export function quizCasesFor(system){return casesFor(system).filter(id=>id!=='crackles');}
export function casesFor(system){return Object.keys(CASES).filter(id=>CASES[id].system===system);}
export function pickQuizCase(system,previous,random=Math.random){const options=quizCasesFor(system).filter(id=>id!==previous);return options[Math.floor(random()*options.length)];}
