/* SHBACE Medical · final PWA collection polish for main/to me
   Orders banks 1–4, uses the supplied bank emblems, and exposes the established
   Dr. Al-Joaki system/topic artwork (large icons) so Banks 07 and 08 render the
   very same cards as the Dr. Al-Joaki bank. */
(function () {
  'use strict';
  const B = window.__SHB_BRIDGE;
  if (!B) { console.error('PWA collection polish: SHB bridge is missing.'); return; }

  const BANK_ICONS = [
    ['.ped-collection-previous:not(.ped-collection-bank07)', 'bank-university-tripoli.webp', 'Faculty of Medicine, University of Tripoli'],
    ['.ped-collection-bank07', 'bank-ai-clinical-cases.webp', 'AI Clinical Case'],
    ['.ped-collection-bank08', 'bank-ai-generated.webp', 'AI Generated'],
    ['.ped-collection-nelson', 'bank-nelson-textbook.webp', 'Nelson Textbook'],
    ['.ped-collection-allonce:not(.ped-collection-clinicalcase):not(.ped-collection-bank08)', 'bank-kasr-alainy.webp', 'Kasr Al-Ainy'],
    ['.ped-collection-clinicalcase:not(.ped-collection-bank07)', 'bank-ai-clinical-cases.webp', 'AI Clinical Cases'],
    ['.ped-collection-egyptian', 'bank-egyptian-book.webp', 'Egyptian Book']
  ];
  const FIRST_FOUR = ['ped-collection-aj', 'ped-collection-previous', 'ped-collection-bank07', 'ped-collection-bank08'];

  function addBadgeCss() {
    if (document.getElementById('shb-pwa-bank-badge-css')) return;
    const style = document.createElement('style');
    style.id = 'shb-pwa-bank-badge-css';
    style.textContent =
      '.ped-collection-avatar{overflow:hidden}'+
      '.ped-collection-avatar>img{display:block;width:100%;height:100%;max-width:100%;max-height:100%;object-fit:cover;border-radius:inherit}';
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

  /* Artwork for systems that have no row of their own in the Dr. Al-Joaki list. */
  function specialSystemSrc(name) {
    const map = B.TOPIC_ICON_ASSET || {};
    const value = norm(name);
    if (/dermatol|allerg|hepatology|child protection/.test(value)) return map['genetics|Skin Disorders'] || map['rheum|Immunodeficiency & Allergy'] || '';
    if (/inborn errors|metabolic/.test(value)) return map['rheum|Inborn Errors of Metabolism'] || '';
    if (/poison|environmental/.test(value)) return map['rheum|Poisoning'] || '';
    if (/general pediatrics|clinical skills/.test(value)) return map['growth|Other / Mixed Questions'] || '';
    if (/supplementary|curriculum gaps/.test(value)) return map['rheum|Other / Mixed Questions'] || map['growth|Other / Mixed Questions'] || '';
    return '';
  }

  /* Same markup the Dr. Al-Joaki system cards use (B.sysIcon 'lg'), so the core CSS sizes it identically. */
  function systemIconHtml(name) {
    try {
      if (typeof B.sysIcon !== 'function') return '';
      const rows = Array.isArray(B.SYS) ? B.SYS : [];
      const row = getSystemRow(name) || rows.find(r => r && r[0] === 'growth') || rows[0];
      if (!row || !row[2]) return '';
      const holder = document.createElement('div');
      holder.innerHTML = B.sysIcon(row[2], 'lg');
      const img = holder.querySelector('img');
      if (img) {
        const special = specialSystemSrc(name);
        if (special) img.src = special;
        img.alt = name;
        img.loading = 'lazy';
        img.decoding = 'async';
      }
      return holder.innerHTML;
    } catch (_) { return ''; }
  }

  /* Same markup the Dr. Al-Joaki topic cards use (.tno.ti with a 176px image). */
  function topicIconHtml(systemName, topicName) {
    try {
      let src = topicImage(systemName, topicName);
      if (!src) {
        const holder = document.createElement('div');
        holder.innerHTML = systemIconHtml(systemName);
        const systemImg = holder.querySelector('img');
        src = systemImg ? systemImg.getAttribute('src') : '';
      }
      if (!src) return '';
      const wrap = document.createElement('div');
      wrap.className = 'tno ti';
      const img = document.createElement('img');
      img.src = src;
      img.alt = String(topicName || '');
      img.width = 176;
      img.height = 176;
      img.loading = 'lazy';
      img.decoding = 'async';
      wrap.appendChild(img);
      return wrap.outerHTML;
    } catch (_) { return ''; }
  }

  window.__SHB_BANK_ICONS__ = { system: systemIconHtml, topic: topicIconHtml };

  addBadgeCss();
  window.__SHB_PWA_COLLECTION_POLISH__ = {
    firstFour: FIRST_FOUR.slice(),
    badgeAssets: BANK_ICONS.map(item => item[1]),
    topicIconMatching: true
  };
})();
