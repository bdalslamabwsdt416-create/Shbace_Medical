import {CASES} from './cases.js?v=spatial-profile-1';
import {POINTS} from './listening-points.js?v=spatial-profile-1';

const heartRules = [
  {re:/aortic stenosis|aortic sclerosis|bicuspid aortic valve.*stenosis/i, point:'aortic', source:'Aortic valve and left-ventricular outflow tract', site:'Aortic area · 2nd right intercostal space, parasternal', radiation:'Classically radiates towards the carotid arteries', focus:'heart-aortic', anatomyNote:'The relevant thoracic anatomy includes the aortic outflow region and adjacent heart structures; it does not separately segment the valve leaflets. This is anatomical orientation text only; the 3D scene does not automatically highlight the region.'},
  {re:/aortic regurgitation|aortic insufficiency/i, point:'erb', source:'Aortic valve and aortic root', site:'Left sternal border · around the 3rd–4th intercostal spaces / Erb area', radiation:'Usually heard along the left sternal border; no single obligatory radiation pattern', focus:'heart-aortic', anatomyNote:'The relevant anatomy includes the aortic root/outflow region. Erb’s point is the surface listening site, not the physical position of the valve. This is anatomical orientation text only; the 3D scene does not automatically highlight the region.'},
  {re:/mitral regurgitation|mitral valve prolapse/i, point:'mitral', source:'Mitral valve and left atrium–left ventricle junction', site:'Mitral area · apex, 5th left intercostal space near the midclavicular line', radiation:'Often radiates towards the left axilla', focus:'heart-mitral', anatomyNote:'The relevant anatomy includes the left-sided cardiac structures adjacent to the mitral valve; the leaflets are not separately segmented. This is anatomical orientation text only; the 3D scene does not automatically highlight the region.'},
  {re:/mitral stenosis|opening snap/i, point:'mitral', source:'Mitral valve and left atrioventricular junction', site:'Mitral area · apex; bell with light pressure for the low-pitched rumble', radiation:'Usually localised to the apex; compare with the rest of the precordium', focus:'heart-mitral', anatomyNote:'The relevant anatomy includes the left atrium and adjacent ventricular region; the valve leaflets are not separately segmented. This is anatomical orientation text only; the 3D scene does not automatically highlight the region.'},
  {re:/tricuspid regurgitation|tricuspid stenosis/i, point:'tricuspid', source:'Tricuspid valve and right atrium–right ventricle junction', site:'Tricuspid area · lower left sternal border, 4th–5th intercostal spaces', radiation:'Usually localised to the lower left sternal border; right-sided murmurs often increase with inspiration', focus:'heart-tricuspid', anatomyNote:'The relevant anatomy includes the right atrium and adjacent ventricular region; the valve leaflets are not separately segmented. This is anatomical orientation text only; the 3D scene does not automatically highlight the region.'},
  {re:/pulmonary stenosis|pulmonary regurgitation|pulmonic/i, point:'pulmonic', source:'Pulmonary valve and right-ventricular outflow tract', site:'Pulmonic area · 2nd left intercostal space, parasternal', radiation:'May be transmitted towards the left shoulder or back, depending on the lesion', focus:'heart-pulmonary', anatomyNote:'The relevant anatomy includes the pulmonary outflow and adjacent right-heart structures; the valve leaflets are not separately segmented. This is anatomical orientation text only; the 3D scene does not automatically highlight the region.'},
  {re:/ventricular septal defect|\bvsd\b/i, point:'tricuspid', source:'Interventricular septum and left-to-right ventricular shunt', site:'Usually lower left sternal border · 4th–5th intercostal spaces', radiation:'May be heard across the precordium; a thrill can be palpable at the lower sternal border', focus:'heart-septum', anatomyNote:'The relevant anatomy includes the ventricular region. It does not display the septal defect itself. This is anatomical orientation text only; the 3D scene does not automatically highlight the region.'},
  {re:/atrial septal defect|\basd\b/i, point:'pulmonic', source:'Atrial septum with right-heart and pulmonary-flow consequences', site:'Pulmonic area · 2nd left intercostal space; assess splitting of S2', radiation:'The associated flow murmur is usually heard at the pulmonary area', focus:'heart-pulmonary', anatomyNote:'The relevant anatomy includes the atria and pulmonary outflow; the septal opening is not segmented. This is anatomical orientation text only; the 3D scene does not automatically highlight the region.'},
  {re:/patent ductus arteriosus|\bpda\b/i, point:'pulmonic', source:'Ductus arteriosus between the aorta and left pulmonary artery', site:'Left infraclavicular / upper left sternal region; the five-point thorax selector is an approximation', radiation:'May be transmitted towards the left infraclavicular area and back', focus:'heart-pulmonary', anatomyNote:'The relevant anatomy includes the great-vessel region; the duct itself is not separately segmented. This is anatomical orientation text only; the 3D scene does not automatically highlight the region.'},
  {re:/normal heart sound|normal cardiac cycle/i, point:'mitral', source:'Cardiac valves during the normal cardiac cycle', site:'Compare the apex and base; S1 is often clearer at the apex and S2 at the base', radiation:'Not applicable to the normal reference pair', focus:'heart', anatomyNote:'The relevant anatomy includes the heart as a whole; use the listening points to compare S1 and S2. This is anatomical orientation text only; the 3D scene does not automatically highlight the region.'},
  {re:/third heart sound|\bs3\b|fourth heart sound|\bs4\b|gallop/i, point:'mitral', source:'Ventricular filling and the left-ventricular wall (for a left-sided gallop)', site:'Apex · use the bell lightly, with the patient in the left lateral position when appropriate', radiation:'Usually best appreciated near the apex; right-sided sounds require a lower sternal focus', focus:'heart-mitral', anatomyNote:'The relevant anatomy includes the ventricular region; it does not simulate intracardiac vibration. This is anatomical orientation text only; the 3D scene does not automatically highlight the region.'},
  {re:/s2|splitting/i, point:'pulmonic', source:'Aortic and pulmonary valve closure', site:'Base of the heart · aortic and pulmonic areas', radiation:'Compare both upper sternal borders and respiratory variation', focus:'heart-pulmonary', anatomyNote:'The relevant anatomy includes the great-vessel outflow region; the sound remains a recording, not a physiological simulation. This is anatomical orientation text only; the 3D scene does not automatically highlight the region.'},
  {re:/hypertrophic cardiomyopathy|subaortic stenosis/i, point:'tricuspid', source:'Interventricular septum and left-ventricular outflow tract', site:'Left sternal border, often lower sternal border; compare with the apex', radiation:'May be transmitted towards the base; dynamic manoeuvres change intensity', focus:'heart-septum', anatomyNote:'The relevant anatomy includes the septal/outflow region; it does not render myocardial thickness or dynamic obstruction. This is anatomical orientation text only; the 3D scene does not automatically highlight the region.'},
  {re:/pericarditis|pericardial.*rub/i, point:'tricuspid', source:'Pericardial layers surrounding the heart', site:'Left lower sternal border; listen with the diaphragm while leaning forward', radiation:'Usually localised to the precordium', focus:'heart', anatomyNote:'The pericardial layers are not separately segmented; the heart is shown for orientation. This is anatomical orientation text only; the 3D scene does not automatically highlight the region.'},
  {re:/coarctation/i, point:null, source:'Aortic arch and aortic isthmus', site:'Left interscapular back; this posterior site is not one of the five standard cardiac points', radiation:'May be heard over the back and across the chest', focus:'heart-aortic', anatomyNote:'The relevant anatomy includes the aortic region. The exact posterior listening site is described in text because it is not a selectable cardiac marker. This is anatomical orientation text only; the 3D scene does not automatically highlight the region.'},
  {re:/korotkoff|blood pressure/i, point:null, source:'Brachial artery in the antecubital fossa', site:'Not a thoracic auscultation point · listen over the brachial artery', radiation:'Not applicable', focus:'none', anatomyNote:'This finding belongs to blood-pressure measurement at the arm, outside the thorax model.'}
];

const lungRules = [
  {re:/crackles|crepitations/i, source:'Small airways and peripheral lung units; the exact mechanism depends on the cause', focus:'alveolar', anatomyNote:'The relevant anatomy includes the relevant lung field. Individual alveoli are microscopic and are not separate 3D meshes. This is anatomical orientation text only; the 3D scene does not automatically highlight the region.'},
  {re:/wheeze/i, source:'Intrathoracic bronchi and bronchioles', focus:'airway', anatomyNote:'The conducting-airway tree serves as the general sound-generating system, not as a precise obstruction map. This is anatomical orientation text only; the 3D scene does not automatically highlight the region.'},
  {re:/rhonchi/i, source:'Larger conducting bronchi, often influenced by secretions', focus:'airway', anatomyNote:'The relevant anatomy includes the larger airway tree; the recording does not identify a single obstructed bronchus. This is anatomical orientation text only; the 3D scene does not automatically highlight the region.'},
  {re:/stridor/i, source:'Larynx and proximal trachea', focus:'airway', point:null, site:'Listen over the neck / upper airway; the larynx is outside the detailed thorax model', anatomyNote:'The relevant anatomy includes the proximal airway only as an orientation aid; it does not include a detailed larynx. This is anatomical orientation text only; the 3D scene does not automatically highlight the region.'},
  {re:/pleural friction rub|pleural rub/i, source:'Visceral and parietal pleural surfaces', focus:'pleura', anatomyNote:'Pleural layers are not separate meshes; the adjacent lung field is relevant for orientation. This is anatomical orientation text only; the 3D scene does not automatically highlight the region.'},
  {re:/bronchophony|egophony|pectoriloquy/i, source:'Lung parenchyma beneath the stethoscope; often a region of consolidation in abnormal findings', focus:'alveolar', anatomyNote:'The selected lung field is described for orientation; the model does not map tissue density or consolidation. This is anatomical orientation text only; the 3D scene does not automatically highlight the region.'},
  {re:/vesicular - diminished|reduced breath|absent breath/i, source:'The affected lung field with reduced sound transmission / air entry', focus:'alveolar', anatomyNote:'The relevant anatomy includes the affected lung field; it does not simulate pleural fluid, pneumothorax or airway obstruction. This is anatomical orientation text only; the 3D scene does not automatically highlight the region.'},
  {re:/bronchial/i, source:'Central conducting airway; bronchial breathing is normal over the trachea but may be pathological over peripheral lung', focus:'airway', point:null, site:'Normal over the trachea; peripheral bronchial breathing requires clinical correlation', anatomyNote:'The airway tree serves as an anatomical reference. The model does not include a detailed neck or tracheal auscultation marker. This is anatomical orientation text only; the 3D scene does not automatically highlight the region.'},
  {re:/bronchovesicular/i, source:'Main bronchi and adjacent central lung fields', focus:'airway', anatomyNote:'The airway tree and adjacent lung field serve as anatomical orientation references. This is anatomical orientation text only; the 3D scene does not automatically highlight the region.'},
  {re:/vesicular - normal|normal breath sounds/i, source:'Peripheral airways and lung parenchyma across both lungs', focus:'alveolar', anatomyNote:'Both lungs represent the broad normal reference region; compare symmetric sites rather than looking for one focal lesion.'}
];

function pointFor(item, rule) {
  if (rule && Object.prototype.hasOwnProperty.call(rule, 'point')) return rule.point;
  const direct = String(item?.point || '').trim();
  if (direct) return direct;
  const source = [item?.title,item?.subgroup,item?.category].filter(Boolean).join(' ').toLowerCase();
  if (item?.system === 'heart') {
    if (/aortic/.test(source)) return 'aortic';
    if (/pulmonary|pulmonic/.test(source)) return 'pulmonic';
    if (/mitral/.test(source)) return 'mitral';
    if (/tricuspid|ventricular septal defect|\bvsd\b/.test(source)) return 'tricuspid';
    if (/atrial septal defect|\basd\b/.test(source)) return 'pulmonic';
  }
  return null;
}

export function getClinicalLink(item) {
  const title = String(item?.title || '');
  const category = String(item?.category || '');
  const uncertain = category === 'Needs Source Review' || item?.reviewStatus === 'Needs Source Review';
  const rules = item?.system === 'lung' ? lungRules : heartRules;
  const rule = uncertain ? null : rules.find(x => x.re.test(title));
  const pointId = uncertain ? null : pointFor(item, rule);
  const point = POINTS.find(x => x.id === pointId);
  const system = item?.system === 'lung' ? 'lung' : 'heart';
  const defaultFocus = system === 'lung' ? 'alveolar' : 'heart';
  const source = uncertain
    ? 'This source annotation is unresolved; do not interpret it as a confirmed diagnosis.'
    : (rule?.source || (system === 'lung' ? 'Respiratory tract and lung field described by the recording label' : 'Cardiac structure described by the recording label'));
  const site = uncertain
    ? 'Not assigned until the source annotation is checked'
    : (rule?.site || (point ? point.name + ' · ' + point.position : system === 'lung' ? 'Compare corresponding lung fields; no single site is encoded for this recording' : 'Compare the standard cardiac listening areas; no single site is encoded for this recording'));
  const radiation = uncertain ? 'Not assigned' : (rule?.radiation || (system === 'lung' ? 'Not applicable · compare matching fields on both sides' : 'No specific radiation has been assigned to this recording'));
  return {
    point: pointId,
    pointName: point?.name || '',
    source,
    site,
    radiation,
    focus: rule?.focus || defaultFocus,
    focusLabel: rule?.focus === 'airway' ? 'Conducting airways'
      : rule?.focus === 'pleura' ? 'Pleural region'
      : rule?.focus === 'alveolar' ? 'Lung field / peripheral lung units'
      : rule?.focus === 'heart-aortic' ? 'Aortic root / outflow region'
      : rule?.focus === 'heart-pulmonary' ? 'Pulmonary outflow / adjacent right heart'
      : rule?.focus === 'heart-mitral' ? 'Left atrium / left-ventricular region'
      : rule?.focus === 'heart-tricuspid' ? 'Right atrium / right-ventricular region'
      : rule?.focus === 'heart-septum' ? 'Ventricular septal / outflow region'
      : rule?.focus === 'none' ? 'Outside the thorax model'
      : system === 'lung' ? 'Lung field' : 'Heart',
    anatomyNote: rule?.anatomyNote || (system === 'lung'
      ? 'The relevant structure is described for anatomical orientation only; the 3D scene does not automatically highlight it, and the recording is not a scan of the source.'
      : 'The relevant heart region is described for anatomical orientation only; the 3D scene does not automatically highlight it, and the exact valve or lesion may not be separately segmented.'),
    uncertain
  };
}

const heartFallback = {
  aortic:    {aortic:1,pulmonic:.60,erb:.55,tricuspid:.30,mitral:.22},
  pulmonic:  {aortic:.58,pulmonic:1,erb:.72,tricuspid:.38,mitral:.22},
  erb:       {aortic:.55,pulmonic:.68,erb:1,tricuspid:.68,mitral:.38},
  tricuspid: {aortic:.30,pulmonic:.36,erb:.64,tricuspid:1,mitral:.50},
  mitral:    {aortic:.24,pulmonic:.20,erb:.40,tricuspid:.58,mitral:1}
};
const lungPointMap = new Map(POINTS.filter(p => p.system === 'lung').map(p => [p.id,p]));
function localLungProfile(best) {
  const anchor = lungPointMap.get(best);
  if (!anchor) return null;
  const profile = {};
  for (const [id,p] of lungPointMap) {
    if (id === best) { profile[id] = 1; continue; }
    const sameSide = (id.includes('right') && best.includes('right')) || (id.includes('left') && best.includes('left'));
    const sameView = Boolean(p.back) === Boolean(anchor.back);
    const distance = Math.hypot((p.x-anchor.x), (p.y-anchor.y));
    if (sameSide && sameView) profile[id] = Math.max(.42, .88 - distance*.30);
    else if (sameSide) profile[id] = Math.max(.48, .76 - distance*.22);
    else if (sameView) profile[id] = Math.max(.22, .38 - distance*.06);
    else profile[id] = Math.max(.18, .30 - distance*.05);
  }
  return profile;
}

function namedHeartProfile(item) {
  const title = String(item?.title || '');
  const category = String(item?.category || '');
  if (category === 'Needs Source Review' || item?.reviewStatus === 'Needs Source Review') return null;
  const matches = [
    [/aortic stenosis|aortic sclerosis|bicuspid aortic valve.*stenosis/i,'stenosis'],
    [/mitral regurgitation|mitral valve prolapse/i,'mitralRegurgitation'],
    [/aortic regurgitation|aortic insufficiency/i,'aorticRegurgitation'],
    [/mitral stenosis/i,'mitralStenosis'],
    [/tricuspid regurgitation/i,'tricuspidRegurgitation'],
    [/pulmonary stenosis/i,'pulmonaryStenosis'],
    [/ventricular septal defect|\bvsd\b/i,'ventricularSeptalDefect'],
    [/normal heart sound/i,'normal']
  ];
  for (const [re,id] of matches) {
    if (re.test(title) && CASES[id]?.strengths) return CASES[id].strengths;
  }
  return null;
}

export function getRelativeIntensity(item, pointId) {
  if (!item || !pointId) return {value:1,label:'No spatial comparison active',mapped:false};
  const clinicalLink = getClinicalLink(item);
  if (clinicalLink.uncertain || !clinicalLink.point) return {value:.8,label:clinicalLink.uncertain?'Unclassified source · neutral teaching level':'No thoracic listening point mapped · neutral level',mapped:false};
  const title = String(item.title || '');
  const isNormal = /normal heart sound|vesicular - normal|normal breath sound/i.test(title);
  if (item.system === 'heart') {
    const profile = namedHeartProfile(item) || heartFallback[item.point] || heartFallback[getClinicalLink(item).point];
    if (!profile || getClinicalLink(item).uncertain) return {value:.8,label:'No confirmed location map · neutral level',mapped:false};
    const value = Number(profile[pointId] ?? .8);
    return {value,label:isNormal ? 'Balanced reference · compare the points' : value >= .92 ? 'Strongest at this listening point' : value >= .62 ? 'Audible here · reduced from the best-heard site' : 'Quieter here · compare with the best-heard site',mapped:true};
  }
  const points = [...lungPointMap.keys()];
  if (!points.includes(pointId)) return {value:.8,label:'No lung-field comparison mapped',mapped:false};
  if (isNormal || /polyphonic wheeze|wheeze/i.test(title) && !/monophonic|focal/i.test(title) && item.category !== 'Clinical recordings') {
    return {value:.82,label:'Broad reference · compare corresponding fields',mapped:true};
  }
  const best = getClinicalLink(item).point || String(item.point || '');
  const sourceSpecific = item.category === 'Clinical recordings' || /patient/i.test([item.kind,item.variant].join(' '));
  if (/vesicular - diminished|reduced breath|absent breath/i.test(title)) {
    const value = pointId === best ? .34 : .82;
    return {value,label:pointId === best ? 'Reduced breath-sound level at this field' : 'Reference level · compare with the reduced field',mapped:true};
  }
  const profile = localLungProfile(best);
  if (!profile) return {value:.8,label:'No focal field assigned · compare both lungs',mapped:false};
  const value = Number(profile[pointId] ?? .8);
  return {value,label:value >= .92 ? 'Strongest at this lung field' : value >= .62 ? 'Audible here · reduced from the annotated field' : 'Quieter here · compare the opposite field',mapped:true,sourceSpecific};
}
