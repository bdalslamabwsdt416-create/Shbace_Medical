export const POINTS=[
 {id:'aortic',short:'Aorta',code:'A',name:'Aortic area',position:'2nd right intercostal space, parasternal',system:'heart',x:-.28,y:.68},
 {id:'pulmonic',short:'Pulmonic',code:'P',name:'Pulmonic area',position:'2nd left intercostal space, parasternal',system:'heart',x:.3,y:.68},
 {id:'erb',short:'Erb',code:'E',name:"Erb's point",position:'3rd left intercostal space, parasternal',system:'heart',x:.3,y:.28},
 {id:'tricuspid',short:'Tricuspid',code:'T',name:'Tricuspid area',position:'4th-5th left intercostal space, parasternal',system:'heart',x:.25,y:-.23},
 {id:'mitral',short:'Mitral',code:'M',name:'Mitral area',position:'5th left intercostal space, midclavicular line',system:'heart',x:.83,y:-.48},
 {id:'lung-right',short:'Right upper',code:'R1',name:'Lung - right anterior',position:'Right upper lung field',system:'lung',x:-.74,y:.62},
 {id:'lung-left',short:'Left upper',code:'L1',name:'Lung - left anterior',position:'Left upper lung field',system:'lung',x:.74,y:.62},
 {id:'lung-right-low',short:'Right middle',code:'R2',name:'Right middle lobe area',position:'Front - right anterolateral chest',system:'lung',x:-1,y:-.65},
 {id:'lung-left-low',short:'Left lingula',code:'L2',name:'Left lingula area',position:'Front - lingula of the left upper lobe',system:'lung',x:1,y:-.65},
 {id:'back-right',short:'Right upper',code:'R3',name:'Lung - right posterior',position:'Right upper posterior lung field',system:'lung',x:-.75,y:.4,back:true},
 {id:'back-left',short:'Left upper',code:'L3',name:'Lung - left posterior',position:'Left upper posterior lung field',system:'lung',x:.75,y:.4,back:true},
 {id:'back-right-low',short:'Right lower',code:'R4',name:'Lung - right posterior base',position:'Right lower posterior lung field',system:'lung',x:-.85,y:-1.05,back:true},
 {id:'back-left-low',short:'Left lower',code:'L4',name:'Lung - left posterior base',position:'Left lower posterior lung field',system:'lung',x:.85,y:-1.05,back:true}
];
// Regions guide examination; the model does not isolate individual lung lobes.
export const LUNG_GUIDE={
 'lung-right':{lobe:'Right upper lobe',view:'front',pair:'lung-left',reverse:'back-right',detail:'Listen below the clavicle, then compare the same level on the left.'},
 'lung-left':{lobe:'Left upper lobe',view:'front',pair:'lung-right',reverse:'back-left',detail:'Listen below the clavicle, then compare the same level on the right.'},
 'lung-right-low':{lobe:'Right middle lobe',view:'front',pair:'lung-left-low',reverse:'back-right-low',detail:'The middle lobe is assessed over the right anterior and lateral chest.'},
 'lung-left-low':{lobe:'Lingula - left upper lobe',view:'front',pair:'lung-right-low',reverse:'back-left-low',detail:'The lingula belongs to the left upper lobe; the left lung has no middle lobe.'},
 'back-right':{lobe:'Right upper posterior field',view:'back',pair:'back-left',reverse:'lung-right',detail:'Compare the upper posterior fields, then work down towards the bases.'},
 'back-left':{lobe:'Left upper posterior field',view:'back',pair:'back-right',reverse:'lung-left',detail:'Compare the upper posterior fields, then work down towards the bases.'},
 'back-right-low':{lobe:'Right lower lobe',view:'back',pair:'back-left-low',reverse:'lung-right-low',detail:'The lower lobes are best accessed from the back. Listen below the scapula and compare both bases.'},
 'back-left-low':{lobe:'Left lower lobe',view:'back',pair:'back-right-low',reverse:'lung-left-low',detail:'The lower lobes are best accessed from the back. Listen below the scapula and compare both bases.'}
};
export function pointForView(id,view){const guide=LUNG_GUIDE[id];return guide&&guide.view!==view?guide.reverse:id;}
