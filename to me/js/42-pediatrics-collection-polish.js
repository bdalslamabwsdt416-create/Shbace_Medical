/* SHBACE Medical · final PWA collection polish for main/to me
   Orders banks 1–4, uses the supplied bank emblems, and reuses the established
   Dr. Al-Joaki system/topic artwork wherever a matching topic exists.
   Also exposes window.__SHB_BANK_ICONS__ (shared names + icons for AI Clinical Cases and AI Generated). */
(function () {
  'use strict';
  const B = window.__SHB_BRIDGE;
  if (!B) { console.error('PWA collection polish: SHB bridge is missing.'); return; }

  const BANK_ICONS = [
    ['.ped-collection-previous:not(.ped-collection-bank07)', 'bank-university-tripoli.webp', 'Faculty of Medicine, University of Tripoli'],
    ['.ped-collection-bank07', 'bank-ai-clinical-cases.webp', 'AI Clinical Cases'],
    ['.ped-collection-bank08', 'bank-ai-generated.webp', 'AI Generated'],
    ['.ped-collection-nelson', 'bank-nelson-textbook.webp', 'Nelson Textbook'],
    ['.ped-collection-allonce:not(.ped-collection-clinicalcase):not(.ped-collection-bank08)', 'bank-kasr-alainy.webp', 'Kasr Al-Ainy'],
    ['.ped-collection-clinicalcase:not(.ped-collection-bank07)', 'bank-clinical-case.webp', 'Clinical Cases'],
    ['.ped-collection-egyptian', 'bank-egyptian-book.webp', 'Egyptian Book']
  ];
  const FIRST_FOUR = ['ped-collection-aj', 'ped-collection-previous', 'ped-collection-bank07', 'ped-collection-bank08'];

  function addBadgeCss() {
    if (document.getElementById('shb-pwa-bank-badge-css')) return;
    const style = document.createElement('style');
    style.id = 'shb-pwa-bank-badge-css';
    style.textContent =
      '.ped-collection-avatar{overflow:hidden}'+
      '.ped-collection-avatar>img{display:block;width:100%;height:100%;max-width:100%;max-height:100%;object-fit:cover;border-radius:inherit}'+
      '.cc-icon-art>img,.ai08-icon-art>img{display:block;width:100%;height:100%;max-width:100%;max-height:100%;object-fit:cover;border-radius:11px}'+
      '.tno.ti.shb-gen-icon{display:grid;place-items:center;color:hsl(var(--gh,200) 78% 80%);background:linear-gradient(145deg,hsl(var(--gh,200) 46% 26%),hsl(var(--gh,200) 52% 12%));border:1px solid hsl(var(--gh,200) 55% 48% / .5)}'+
      '.tno.ti.shb-gen-icon svg{display:block;width:58%;height:58%;fill:none;stroke:currentColor;stroke-width:2;stroke-linecap:round;stroke-linejoin:round}';
    document.head.appendChild(style);
  }

  function updateCollectionHtml(html) {
    const root = document.createElement('div');
    root.innerHTML = String(html || '');
    const grid = root.querySelector('.ped-collections-grid');
    if (!grid) return html;

    BANK_ICONS.forEach(([selector, file, label]) => {
      root.querySelectorAll(selector).forEach(card => {
        const avatar = card.querySelector('.ped-collection-avatar');
        if (!avatar) return;
        const img = document.createElement('img');
        img.src = '/assets/img/' + file;
        img.alt = label + ' question bank';
        img.loading = 'lazy';
        img.decoding = 'async';
        avatar.replaceChildren(img);
        avatar.setAttribute('role', 'img');
        avatar.setAttribute('aria-label', img.alt);
      });
    });

    const cards = Array.from(grid.querySelectorAll(':scope > .ped-collection-card'));
    const priority = [];
    FIRST_FOUR.forEach(cls => {
      const card = cards.find(item => item.classList.contains(cls));
      if (card && !priority.includes(card)) priority.push(card);
    });
    priority.concat(cards.filter(card => !priority.includes(card))).forEach(card => grid.appendChild(card));
    return root.innerHTML;
  }

  const previousSpecialtiesView = window.specialtiesView;
  if (typeof previousSpecialtiesView === 'function') {
    window.specialtiesView = function () {
      return updateCollectionHtml(previousSpecialtiesView.apply(this, arguments));
    };
  }

  const norm = value => String(value == null ? '' : value)
    .toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[\u064B-\u065F\u0670\u0640]/g, '').replace(/[أإآٱ]/g, 'ا')
    .replace(/ى/g, 'ي').replace(/ة/g, 'ه')
    .replace(/[^a-z0-9\u0600-\u06ff]+/g, ' ').trim();

  const SYSTEM_HINTS = [
    [/central nervous|neurolog|cns/, 'cns'],
    [/cardiovascular|cardiac|heart/, 'cardio'],
    [/endocrin/, 'endocrinology'],
    [/gastrointestinal|digestive|git/, 'git'],
    [/ha?ematolog|blood/, 'haematology'],
    [/infectious|vaccin|immunolog/, 'infectious'],
    [/neonat|newborn/, 'neonatology'],
    [/nephrolog|renal|urinar|urolog/, 'nephrology'],
    [/respirator|lung/, 'respiratory'],
    [/genetic/, 'genetics'],
    [/growth|nutrition|development/, 'growth'],
    [/rheumat|metabolic|poison/, 'rheum']
  ];
  function systemKey(name) {
    const value = String(name || '').toLowerCase();
    if (/dermatol|allerg|hepatology|child protection/.test(value)) return 'genetics';
    if (/inborn errors|metabolic|poison|environmental/.test(value)) return 'rheum';
    if (/general pediatrics|clinical skills|supplementary|curriculum gaps/.test(value)) return 'growth';
    const hint = SYSTEM_HINTS.find(([re]) => re.test(value));
    return hint ? hint[1] : '';
  }
  function getSystemRow(name) {
    const key = systemKey(name);
    const rows = Array.isArray(B.SYS) ? B.SYS : [];
    return rows.find(row => row && row[0] === key) ||
      rows.find(row => row && key && norm(row[0] + ' ' + row[1]).includes(norm(key))) || null;
  }

  const TOPIC_ALIASES = [
    [/eczema|dermatitis|dermatology|skin disorder/, 'genetics', 'Skin Disorders'],
    [/allerg|anaphylaxis|immunodeficiency|immunology/, 'rheum', 'Immunodeficiency & Allergy'],
    [/hepatitis|hepatology|liver disease|jaundice/, 'git', 'Liver Disease & Jaundice'],
    [/inborn errors|metabolic|storage disease/, 'rheum', 'Inborn Errors of Metabolism'],
    [/poison|toxic|environmental emergency/, 'rheum', 'Poisoning'],
    [/vaccin|immuniz|immunis|vaccine/, 'infectious', 'Vaccination & Immunisation'],
    [/febrile seizure|febrile convulsion/, 'cns', 'Febrile Seizures'],
    [/seizure|epilep|convulsion/, 'cns', 'Epilepsy & Seizures'],
    [/meningitis|encephalitis/, 'cns', 'Meningitis & Encephalitis'],
    [/hydrocephalus|neural tube/, 'cns', 'Hydrocephalus & Neural Tube Defects'],
    [/cerebral palsy/, 'cns', 'Cerebral Palsy'],
    [/autism|adhd|attention deficit|developmental delay/, 'cns', 'Autism, Attention-Deficit Hyperactivity Disorder & Developmental Delay'],
    [/atrial septal|ventricular septal|septal defect|patent ductus|\b(asd|vsd|avsd|pda)\b/, 'cardio', 'Septal Defects & Patent Ductus Arteriosus'],
    [/coarctation/, 'cardio', 'Coarctation of the Aorta'],
    [/tetralogy|\btof\b/, 'cardio', 'Tetralogy of Fallot'],
    [/cyanosis|cyanotic/, 'cardio', 'Cyanosis & Congenital Heart Disease (General)'],
    [/endocarditis/, 'cardio', 'Infective Endocarditis'],
    [/rheumatic fever|rheumatic heart/, 'cardio', 'Acute Rheumatic Fever'],
    [/arrhythmia|svt|wolff|heart block/, 'cardio', 'Arrhythmias (Supraventricular Tachycardia, Wolff-Parkinson-White & Heart Block)'],
    [/innocent murmur|cardiac examination|heart murmur/, 'cardio', 'Innocent Murmurs & Cardiac Examination'],
    [/heart failure|cardiomyopath/, 'cardio', 'Heart Failure'],
    [/transposition/, 'cardio', 'Transposition of the Great Arteries'],
    [/myocarditis/, 'cardio', 'Myocarditis'],
    [/adrenal|cah|addison|cushing|ambiguous genitalia|sex development/, 'endocrinology', 'Adrenal Disorders (CAH, Addison Disease & Cushing Syndrome)'],
    [/diabetic ketoacidosis|\bdka\b|hyperosmolar/, 'endocrinology', 'Diabetic Ketoacidosis & Hyperosmolar State'],
    [/diabetes mellitus|type 1 diabetes|type 2 diabetes/, 'endocrinology', 'Diabetes Mellitus'],
    [/short stature|growth hormone deficiency|hypopituitarism/, 'endocrinology', 'Short Stature & Growth Disorders'],
    [/congenital hypothyroid|cretinism/, 'endocrinology', 'Congenital Hypothyroidism & Cretinism'],
    [/hyperthyroid|graves/, 'endocrinology', 'Hyperthyroidism (Graves Disease)'],
    [/puberty|gonadal/, 'endocrinology', 'Puberty & Gonadal Disorders'],
    [/hypoglyc|infant of diabetic mother/, 'endocrinology', 'Hypoglycemia & Infant of Diabetic Mother'],
    [/asthma|wheez/, 'respiratory', 'Asthma'],
    [/bronchiolitis|croup|stridor|rsv/, 'respiratory', 'Bronchiolitis, Croup & Stridor'],
    [/pneumonia/, 'respiratory', 'Pneumonia'],
    [/cystic fibrosis|bronchiectasis/, 'respiratory', 'Cystic Fibrosis & Chronic Lung Disease'],
    [/coeliac|celiac|malabsorption/, 'git', 'Coeliac Disease & Malabsorption'],
    [/reflux|gastroesophageal|pyloric stenosis|vomiting/, 'git', 'Reflux, Vomiting & Pyloric Stenosis'],
    [/diarrh|gastroenteritis|dehydrat/, 'git', 'Diarrhoea & Dehydration'],
    [/constipation|hirschsprung|soiling/, 'git', 'Constipation, Hirschsprung & Soiling'],
    [/intussusception|acute abdomen/, 'git', 'Intussusception & Acute Abdomen'],
    [/inflammatory bowel|crohn|ulcerative colitis/, 'git', 'Inflammatory Bowel Disease'],
    [/hepat|liver disease|jaundice|portal hypertension|biliary atresia/, 'git', 'Liver Disease & Jaundice'],
    [/urinary tract infection|\buti\b|vesicoureteric reflux|\bvur\b/, 'nephrology', 'Urinary Tract Infection & Vesicoureteral Reflux'],
    [/nephrotic/, 'nephrology', 'Nephrotic Syndrome'],
    [/nephritic|glomerulonephritis|psgn/, 'nephrology', 'Glomerulonephritis (Post-Streptococcal, IgA & Others)'],
    [/acute kidney injury|\baki\b|dialysis|hyperkalaemia/, 'nephrology', 'Acute Kidney Injury, Fluids & Electrolytes'],
    [/chronic kidney disease|\bckd\b|transplant/, 'nephrology', 'Chronic Kidney Disease, Dialysis & Transplantation'],
    [/haemolytic uraemic|hemolytic uremic|\bhus\b/, 'nephrology', 'Hemolytic Uremic Syndrome'],
    [/hypertension/, 'nephrology', 'Hypertension in Children'],
    [/neonatal jaundice|kernicterus|bilirubin/, 'neonatology', 'Neonatal Jaundice'],
    [/prematur|respiratory distress syndrome|\brds\b|apnoea of prematurity/, 'neonatology', 'Prematurity & Respiratory Distress'],
    [/birth asphyxia|resuscitation|apgar|hypoxic ischaemic/, 'neonatology', 'Birth Asphyxia, Resuscitation & Apgar'],
    [/neonatal sepsis|congenital infection/, 'neonatology', 'Neonatal Sepsis & Congenital Infections'],
    [/newborn examination|normal newborn|routine newborn/, 'neonatology', 'Newborn Examination & Normal Care'],
    [/vitamin k|haemorrhagic disease of newborn|neonatal bleeding/, 'neonatology', 'Vitamin K & Neonatal Bleeding'],
    [/necrotizing enterocolitis|neonatal gastrointestinal/, 'neonatology', 'Neonatal Gastrointestinal & Surgical Conditions'],
    [/vaccin|immunisation|immunization|bcg|polio vaccine|mmr/, 'infectious', 'Vaccination & Immunisation'],
    [/tuberculosis|\btb\b/, 'infectious', 'Tuberculosis'],
    [/malaria|parasitic/, 'infectious', 'Malaria & Parasitic Infections'],
    [/hiv|mother to child transmission/, 'infectious', 'Human Immunodeficiency Virus (HIV)'],
    [/measles|rubella|mumps|varicella|viral exanthem|roseola|parvovirus/, 'infectious', 'Exanthems & Viral Infections'],
    [/sepsis|bacterial infection|fever/, 'infectious', 'Fever, Sepsis & Bacterial Infections'],
    [/iron deficiency|microcytic anaemia|microcytic anemia/, 'haematology', 'Iron Deficiency & Nutritional Anaemia'],
    [/haemolytic anaemia|hemolytic anemia|g6pd|sickle cell/, 'haematology', 'Haemolytic Anaemias'],
    [/bleeding disorder|itp|von willebrand|coagulation/, 'haematology', 'Bleeding Disorders'],
    [/leukaemia|leukemia|lymphoma|childhood cancer/, 'haematology', 'Leukaemia & Childhood Cancers']
  ];

  function topicImage(systemName, topicName) {
    const map = B.TOPIC_ICON_ASSET || {};
    const key = systemKey(systemName);
    const entries = Object.keys(map);
    const topic = norm(topicName);
    if (!key || !topic) return '';
    const exact = entries.find(item => item.startsWith(key + '|') && norm(item.slice(item.indexOf('|') + 1)) === topic);
    if (exact) return map[exact];

    const alias = TOPIC_ALIASES.find(([re]) => re.test(String(topicName || '')));
    if (alias && map[alias[1] + '|' + alias[2]]) return map[alias[1] + '|' + alias[2]];

    const words = topic.split(' ').filter(word => word.length > 2 && !['the','and','for','with','from','that','into','other','general','approach','child','children'].includes(word));
    let best = null;
    entries.forEach(item => {
      if (!item.startsWith(key + '|')) return;
      const label = norm(item.slice(item.indexOf('|') + 1));
      const candidate = label.split(' ').filter(word => word.length > 2 && !['the','and','for','with','from','that','into','other','general'].includes(word));
      const overlap = words.filter(word => candidate.some(part => part === word || (word.length > 5 && part.length > 5 && (part.includes(word) || word.includes(part)))));
      const score = overlap.length / Math.max(1, Math.min(words.length, candidate.length));
      if (!best || score > best.score) best = { item, score };
    });
    return best && best.score >= 0.42 ? map[best.item] : '';
  }

  function applySystemImage(box, name) {
    if (!box) return;
    const map = B.TOPIC_ICON_ASSET || {};
    const value = norm(name);
    let special = '';
    if (/dermatol|allerg|hepatology|child protection/.test(value)) {
      special = map['genetics|Skin Disorders'] || map['rheum|Immunodeficiency & Allergy'] || '';
    } else if (/inborn errors|metabolic/.test(value)) {
      special = map['rheum|Inborn Errors of Metabolism'] || '';
    } else if (/poison|environmental/.test(value)) {
      special = map['rheum|Poisoning'] || '';
    } else if (/general pediatrics|clinical skills/.test(value)) {
      special = map['growth|Other / Mixed Questions'] || '';
    } else if (/supplementary|curriculum gaps/.test(value)) {
      special = map['rheum|Other / Mixed Questions'] || map['growth|Other / Mixed Questions'] || '';
    }
    try {
      if (special) {
        const img = document.createElement('img');
        img.src = special;
        img.alt = name;
        img.loading = 'lazy';
        img.decoding = 'async';
        box.replaceChildren(img);
        return;
      }
      const row = getSystemRow(name);
      if (!row || typeof B.sysIcon !== 'function') return;
      const holder = document.createElement('div');
      holder.innerHTML = B.sysIcon(row[2], 'lg');
      const img = holder.querySelector('img');
      if (img) {
        img.alt = name;
        img.loading = 'lazy';
        img.decoding = 'async';
        box.replaceChildren(img);
      }
    } catch (_) {}
  }

  function applyTopicImage(box, systemName, topicName) {
    if (!box) return;
    const src = topicImage(systemName, topicName);
    if (!src) return;
    const img = document.createElement('img');
    img.src = src;
    img.alt = topicName;
    img.loading = 'lazy';
    img.decoding = 'async';
    box.replaceChildren(img);
  }

  function refreshBankIcons() {
    let page = '';
    try { page = String(appPage || ''); } catch (_) {}
    const root = document.querySelector('#phoneContent .screen') || document;
    if (page === 'clinicalSystems' || page === 'ai08Systems') {
      root.querySelectorAll('.cc-list-card,.ai08-list-card').forEach(card => {
        const label = card.querySelector('.cc-list-copy strong,.ai08-list-copy strong');
        const box = card.querySelector('.cc-sys-icon,.ai08-sys-icon');
        if (label && box) applySystemImage(box, label.textContent.trim());
      });
    } else if (page === 'clinicalTopics' || page === 'ai08Topics') {
      const heading = root.querySelector('.cc-page>h1,.ai08-page>h1');
      const systemName = heading ? heading.textContent.trim() : '';
      root.querySelectorAll('.cc-list-card,.ai08-list-card').forEach(card => {
        const label = card.querySelector('.cc-list-copy strong,.ai08-list-copy strong');
        const box = card.querySelector('.cc-topic-number,.ai08-topic-number');
        if (label && box) applyTopicImage(box, systemName, label.textContent.trim());
      });
    }
  }

  /* ───────────── Shared names and icons for the two AI banks (07 and 08) ─────────────
     Rules: one consistent spelling for every system/topic name; every different system and every
     different topic gets its own icon; an icon repeats only when the system or topic itself is the same. */
  const SPELLING = [
    [/Haemorrhag/g, 'Hemorrhag'], [/haemorrhag/g, 'hemorrhag'], [/Haem/g, 'Hem'], [/haem/g, 'hem'],
    [/Anaem/g, 'Anem'], [/anaem/g, 'anem'], [/Leukaem/g, 'Leukem'], [/leukaem/g, 'leukem'],
    [/Paediatric/g, 'Pediatric'], [/paediatric/g, 'pediatric'], [/Oesophag/g, 'Esophag'], [/oesophag/g, 'esophag'],
    [/([Dd])iarrhoea/g, '$1iarrhea'], [/Hyperkalaem/g, 'Hyperkalem'], [/hyperkalaem/g, 'hyperkalem']
  ];
  function fixSpelling(text) {
    let out = String(text == null ? '' : text).replace(/\s+/g, ' ').trim();
    SPELLING.forEach(([re, to]) => { out = out.replace(re, to); });
    return out;
  }
  const CANON_SYSTEMS = [
    [/^(central nervous|neurolog|cns\b)/, 'Central Nervous System'],
    [/^(cardiovascular|cardiolog|cardiac|cvs\b|heart)/, 'Cardiovascular System'],
    [/^endocrin/, 'Endocrine System'],
    [/^(gastrointestinal|gastroenterolog|git\b|digestive)/, 'Gastrointestinal System'],
    [/^hematolog/, 'Hematology'],
    [/^infectious/, 'Infectious Diseases'],
    [/^neonat/, 'Neonatology'],
    [/^(nephrolog|renal)/, 'Nephrology'],
    [/^respirat/, 'Respiratory System'],
    [/^(pediatric )?genetics?$/, 'Genetics']
  ];
  function canonicalSystem(name) {
    const text = fixSpelling(name).replace(/\s+and\s+/gi, ' & ');
    const lower = text.toLowerCase();
    const hit = CANON_SYSTEMS.find(([re]) => re.test(lower));
    return hit ? hit[1] : text;
  }
  function displayTopic(name) { return fixSpelling(name); }

  const attr = v => String(v == null ? '' : v).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
  function imageTile(src, alt) {
    return '<div class="tno ti"><img src="' + attr(src) + '" alt="' + attr(alt) + '" width="176" height="176" loading="lazy" decoding="async"></div>';
  }
  const GEN_SHAPES = [
    [/nervous|neurolog|seizure|epilep|mening|brain|cns|enceph|cerebr|neural/, '<path d="M24 8c-3-4-10-2-10 4-5 1-6 8-2 11-3 5 1 11 6 11 2 5 8 5 10 1 3 4 9 3 10-2 5-1 7-7 3-11 3-5 0-10-5-10-1-6-8-7-12-4Z"/><path d="M24 9v29"/>'],
    [/cardio|heart|cardiac|septal|tetralogy|endocard|arrhythm|murmur/, '<path d="M24 39S7 29 7 17c0-8 10-12 17-3 7-9 17-5 17 3 0 12-17 22-17 22Z"/><path d="M10 23h8l4-8 5 16 4-8h7"/>'],
    [/respirat|lung|asthma|pneumonia|bronchi|croup|pertussis/, '<path d="M23 10v13m2-13v13M23 19c-5 0-8 4-10 10l-3 8c-1 3 2 5 5 4l9-4V19Zm2 0c5 0 8 4 10 10l3 8c1 3-2 5-5 4l-9-4V19Z"/>'],
    [/gastro|digestive|hepat|liver|stomach|intestin|diarr|coeliac|celiac|reflux|bowel|git/, '<path d="M17 8c-2 7 1 9 5 11 3 2 2 6-1 7-4 1-5 5-2 9 3 4 11 4 15 0 3-3 2-7-2-9-4-2-3-6 0-9 3-3 2-7-1-9"/>'],
    [/nephro|renal|kidney|urinary|urolog|nephrotic|glomerul/, '<path d="M18 9c-7 0-11 8-9 17 1 7 6 11 11 8 4-2 3-7 2-11-1-5 1-14-4-14Zm12 0c7 0 11 8 9 17-1 7-6 11-11 8-4-2-3-7-2-11 1-5-1-14 4-14Z"/>'],
    [/endocrin|hormone|thyroid|diabet|adrenal|pituitar|puberty/, '<path d="M24 8c-4 5-9 9-9 16a9 9 0 0 0 18 0c0-7-5-11-9-16Z"/><path d="M18 25c3-3 9-3 12 0"/>'],
    [/neonat|newborn|infant|prematur|birth/, '<circle cx="24" cy="19" r="10"/><path d="M19 19h.1m10 0h.1m-8 5c2 2 4 2 6 0M12 39c2-7 7-10 12-10s10 3 12 10"/>'],
    [/infect|vaccin|immun|virus|bacter|fever|sepsis|malaria|tubercul|hiv/, '<path d="M24 6 39 12v11c0 9-6 15-15 19C15 38 9 32 9 23V12l15-6Z"/><circle cx="24" cy="23" r="7"/>'],
    [/hemat|blood|anem|iron|sickle|leuk|lymphoma|bleeding|coagul/, '<path d="M24 6c-5 8-13 15-13 23a13 13 0 0 0 26 0C37 21 29 14 24 6Z"/><path d="M17 29c1 5 4 7 8 7"/>'],
    [/growth|development|nutrition|milestone|feeding|obesity|vitamin|malnutrition/, '<path d="M10 39V9m0 30h29M17 33V25h6v8m5 0V17h6v16m5 0V11h4v22"/>'],
    [/genetic|dna|chromosom|inherit|dermat|skin|eczema/, '<path d="M14 8c0 12 20 20 20 32M34 8C34 20 14 28 14 40"/><path d="M17 13h14M17 22h14M17 31h14"/>'],
    [/rheumat|metabolic|poison|joint|arthritis|musculoskeletal|toxic/, '<circle cx="24" cy="24" r="6"/><path d="M24 8v6m0 20v6M8 24h6m20 0h6M13 13l4 4m14 14 4 4m0-22-4 4M17 31l-4 4"/>']
  ];
  const GEN_DEFAULT = '<path d="M24 6 39 15v18l-15 9L9 33V15l15-9Z"/><path d="M16 24h16m-8-8v16"/>';
  function hashOf(text) { let h = 7; for (let i = 0; i < text.length; i++) h = (h * 31 + text.charCodeAt(i)) >>> 0; return h; }
  function generatedTile(systemName, topicName) {
    const label = displayTopic(topicName);
    const hue = hashOf(norm(label) + '|' + norm(systemName)) % 360;
    const hit = GEN_SHAPES.find(([re]) => re.test((label + ' ' + systemName).toLowerCase()));
    return '<div class="tno ti shb-gen-icon" role="img" aria-label="' + attr(label) + '" style="--gh:' + hue + '"><svg viewBox="0 0 48 48" aria-hidden="true">' + (hit ? hit[1] : GEN_DEFAULT) + '</svg></div>';
  }

  const NOISE = ['the','and','for','with','from','that','into','other','general','approach','child','children'];
  function topicCandidates(systemName, topicName) {
    const map = B.TOPIC_ICON_ASSET || {};
    const key = systemKey(systemName);
    const topic = norm(topicName);
    const out = [];
    const push = src => { if (src && out.indexOf(src) < 0) out.push(src); };
    if (!topic) return out;
    const entries = Object.keys(map).filter(item => !key || item.startsWith(key + '|'));
    entries.forEach(item => { if (norm(item.slice(item.indexOf('|') + 1)) === topic) push(map[item]); });
    const alias = TOPIC_ALIASES.find(([re]) => re.test(String(topicName || '')));
    if (alias) push(map[alias[1] + '|' + alias[2]]);
    const words = topic.split(' ').filter(w => w.length > 2 && NOISE.indexOf(w) < 0);
    const scored = [];
    entries.forEach(item => {
      const label = norm(item.slice(item.indexOf('|') + 1));
      if (/other mixed/.test(label)) return;
      const parts = label.split(' ').filter(w => w.length > 2 && NOISE.indexOf(w) < 0);
      const overlap = words.filter(w => parts.some(p => p === w || (w.length > 5 && p.length > 5 && (p.includes(w) || w.includes(p)))));
      const score = overlap.length / Math.max(1, Math.min(words.length, parts.length));
      if (score >= 0.5) scored.push([score, map[item]]);
    });
    scored.sort((a, b) => b[0] - a[0]).slice(0, 3).forEach(pair => push(pair[1]));
    return out;
  }
  /* One tile per topic in a list; two different topics never receive the same picture. */
  function topicIcons(systemName, names) {
    const used = new Set();
    const byName = new Map();
    return (names || []).map(name => {
      const id = norm(name);
      if (byName.has(id)) return byName.get(id);
      const src = topicCandidates(systemName, name).find(s => !used.has(s));
      let html;
      if (src) { used.add(src); html = imageTile(src, displayTopic(name)); }
      else html = generatedTile(systemName, name);
      byName.set(id, html);
      return html;
    });
  }

  function specialSystemSrc(name) {
    const map = B.TOPIC_ICON_ASSET || {};
    const value = norm(name);
    if (/dermatol|allerg|hepatology|child protection/.test(value)) return map['genetics|Skin Disorders'] || map['rheum|Immunodeficiency & Allergy'] || '';
    if (/inborn errors|metabolic/.test(value)) return map['rheum|Inborn Errors of Metabolism'] || '';
    if (/poison|environmental/.test(value)) return map['rheum|Poisoning'] || '';
    if (/general pediatrics|clinical skills|comprehensive/.test(value)) return map['growth|Other / Mixed Questions'] || '';
    if (/supplementary|curriculum gaps/.test(value)) return map['rheum|Other / Mixed Questions'] || map['growth|Other / Mixed Questions'] || '';
    return '';
  }
  function rowImageSrc(row) {
    try {
      if (!row || typeof B.sysIcon !== 'function') return '';
      const holder = document.createElement('div');
      holder.innerHTML = B.sysIcon(row[2], 'lg');
      const img = holder.querySelector('img');
      return img ? (img.getAttribute('src') || '') : '';
    } catch (_) { return ''; }
  }
  function systemTile(src, name, row) {
    try {
      const rows = Array.isArray(B.SYS) ? B.SYS : [];
      const base = row || rows.find(r => r && r[0] === 'growth') || rows[0];
      if (base && typeof B.sysIcon === 'function') {
        const holder = document.createElement('div');
        holder.innerHTML = B.sysIcon(base[2], 'lg');
        const img = holder.querySelector('img');
        if (img) { img.setAttribute('src', src); img.setAttribute('alt', name); return holder.innerHTML; }
      }
    } catch (_) {}
    return imageTile(src, name);
  }
  /* One tile per medical system in a list; every different system gets its own picture. */
  function systemIcons(names) {
    const map = B.TOPIC_ICON_ASSET || {};
    const keys = Object.keys(map).filter(k => !/other \/ mixed/i.test(k));
    const used = new Set();
    const byName = new Map();
    return (names || []).map(raw => {
      const name = canonicalSystem(raw);
      if (byName.has(name)) return byName.get(name);
      const row = getSystemRow(name);
      const family = systemKey(name);
      const candidates = [specialSystemSrc(name), rowImageSrc(row)].filter(Boolean);
      keys.filter(k => family && k.startsWith(family + '|')).forEach(k => candidates.push(map[k]));
      keys.forEach(k => candidates.push(map[k]));
      const src = candidates.find(s => !used.has(s)) || candidates[0] || '';
      let html;
      if (src) { used.add(src); html = systemTile(src, name, row); }
      else html = generatedTile(name, name);
      byName.set(name, html);
      return html;
    });
  }
  window.__SHB_BANK_ICONS__ = {
    fixSpelling: fixSpelling,
    canonicalSystem: canonicalSystem,
    topicName: displayTopic,
    systems: systemIcons,
    topics: topicIcons,
    system: name => systemIcons([name])[0],
    topic: (systemName, topicName) => topicIcons(systemName, [topicName])[0]
  };

  addBadgeCss();
  const previousRender = window.renderAppDemo;
  if (typeof previousRender === 'function') {
    window.renderAppDemo = function () {
      const result = previousRender.apply(this, arguments);
      try { refreshBankIcons(); } catch (error) { console.error('PWA bank icon refresh failed', error); }
      return result;
    };
  }
  window.__SHB_PWA_COLLECTION_POLISH__ = {
    firstFour: FIRST_FOUR.slice(),
    badgeAssets: BANK_ICONS.map(item => item[1]),
    topicIconMatching: true
  };
})();
