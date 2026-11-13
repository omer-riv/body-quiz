// What the questions are about. The body is 937 parts (public/body/manifest.json),
// named the way anatomists name them: "left fifth rib", "long head of right
// biceps brachii". A structure is what a player is asked for: "Ribs", "Biceps".
// Which structures there are depends on the level: Easy asks for the skull,
// Medium for the frontal bone, Hard for the sphenoid.
export type Layer = 'skin' | 'muscle' | 'bone' | 'organ' | 'vessel' | 'brain';
export type SystemId = 'skeleton' | 'muscles' | 'organs' | 'brain';
export type Level = 1 | 2 | 3;

export const LAYERS: Layer[] = ['skin', 'muscle', 'bone', 'organ', 'vessel', 'brain'];
export const LAYER_NAMES: Record<Layer, string> = {
  skin: 'Skin', muscle: 'Muscles', bone: 'Skeleton', organ: 'Organs', vessel: 'Vessels', brain: 'Brain',
};
export const SYSTEMS: SystemId[] = ['skeleton', 'muscles', 'organs', 'brain'];
export const SYSTEM_NAMES: Record<SystemId, string> = {
  skeleton: 'Skeleton', muscles: 'Muscles', organs: 'Organs', brain: 'Brain',
};
export const LEVEL_NAMES: Record<Level, string> = { 1: 'Easy', 2: 'Medium', 3: 'Hard' };

const SYSTEM_OF: Partial<Record<Layer, SystemId>> = {
  bone: 'skeleton', muscle: 'muscles', organ: 'organs', vessel: 'organs', brain: 'brain',
};
export const SYSTEM_LAYERS: Record<SystemId, Layer[]> = {
  skeleton: ['bone'], muscles: ['muscle'], organs: ['organ', 'vessel'], brain: ['brain'],
};

export interface PartInfo {
  id: string;
  name: string;
  layer: Layer;
}

export interface Structure {
  name: string;
  system: SystemId;
}

// name, the first and last level it is asked at, and what it is made of: a
// pattern over the part's name without its side. Within a system the first rule
// that fits at the level wins, so the order matters.
type Rule = [name: string, min: Level, max: Level, match: RegExp];

const CARPALS = /scaphoid|lunate|triquetral|pisiform|trapezium|trapezoid|capitate|hamate/;
const TARSALS = /talus|navicular|cuboid|cuneiform/;

const RULES: Record<SystemId, Rule[]> = {
  skeleton: [
    ['Skull', 1, 1, /frontal bone|parietal bone|occipital bone|temporal bone|sphenoid|ethmoid|nasal bone|lacrimal|zygomatic|maxilla|vomer|palatine|nasal concha/],
    ['Frontal bone', 2, 3, /^frontal bone/],
    ['Parietal bone', 2, 3, /^parietal bone/],
    ['Occipital bone', 2, 3, /^occipital bone/],
    ['Temporal bone', 2, 3, /^temporal bone/],
    ['Cheekbone (zygomatic bone)', 2, 3, /zygomatic/],
    ['Upper jaw (maxilla)', 2, 3, /maxilla/],
    ['Nasal bone', 2, 3, /^nasal bone/],
    ['Sphenoid bone', 3, 3, /sphenoid/],
    ['Ethmoid bone', 3, 3, /ethmoid/],
    ['Lacrimal bone', 3, 3, /lacrimal/],
    ['Vomer', 3, 3, /vomer/],
    ['Palatine bone', 3, 3, /palatine/],
    ['Inferior nasal concha', 3, 3, /nasal concha/],
    ['Jawbone (mandible)', 1, 3, /^mandible/],
    ['Teeth', 1, 2, /tooth/],
    ['Incisors', 3, 3, /incisor/],
    ['Canine teeth', 3, 3, /canine/],
    ['Premolars', 3, 3, /premolar/],
    ['Molars', 3, 3, /molar/],
    ['Spine', 1, 1, /vertebra|^atlas|^axis|intervertebral|sacrum/],
    ['Atlas (C1)', 3, 3, /^atlas/],
    ['Axis (C2)', 3, 3, /^axis/],
    ['Intervertebral discs', 2, 3, /intervertebral/],
    ['Cervical vertebrae', 2, 3, /cervical vertebra|^atlas|^axis/],
    ['Thoracic vertebrae', 2, 3, /thoracic vertebra/],
    ['Lumbar vertebrae', 2, 3, /lumbar vertebra/],
    ['Sacrum', 2, 3, /sacrum/],
    ['Breastbone (sternum)', 1, 3, /sternum|manubrium|xiphoid/],
    ['Costal cartilage', 3, 3, /costal cartilage/],
    ['Ribs', 1, 3, /\brib$|costal cartilage/],
    ['Collarbone (clavicle)', 1, 3, /clavicle/],
    ['Shoulder blade (scapula)', 1, 3, /scapula/],
    ['Upper arm bone (humerus)', 1, 3, /humerus/],
    ['Forearm bones (radius and ulna)', 1, 1, /^radius|^ulna/],
    ['Radius', 2, 3, /^radius/],
    ['Ulna', 2, 3, /^ulna/],
    ['Hand bones', 1, 1, new RegExp('metacarpal|finger|thumb|' + CARPALS.source)],
    ['Wrist bones (carpals)', 2, 2, CARPALS],
    ['Scaphoid', 3, 3, /scaphoid/],
    ['Lunate', 3, 3, /lunate/],
    ['Triquetrum', 3, 3, /triquetral/],
    ['Pisiform', 3, 3, /pisiform/],
    ['Trapezium', 3, 3, /trapezium/],
    ['Trapezoid', 3, 3, /trapezoid/],
    ['Capitate', 3, 3, /capitate/],
    ['Hamate', 3, 3, /hamate/],
    ['Metacarpals', 2, 3, /metacarpal/],
    ['Finger bones (phalanges)', 2, 3, /finger|thumb/],
    ['Hip bone', 1, 3, /^hip bone/],
    ['Thigh bone (femur)', 1, 3, /femur/],
    ['Kneecap (patella)', 1, 3, /patella/],
    ['Shinbone (tibia)', 1, 3, /^tibia/],
    ['Fibula', 1, 3, /^fibula/],
    ['Foot bones', 1, 1, new RegExp('metatarsal|toe|calcaneus|sesamoid|' + TARSALS.source)],
    ['Heel bone (calcaneus)', 2, 3, /calcaneus/],
    ['Ankle bones (tarsals)', 2, 2, TARSALS],
    ['Talus', 3, 3, /talus/],
    ['Navicular', 3, 3, /navicular/],
    ['Cuboid', 3, 3, /cuboid/],
    ['Cuneiforms', 3, 3, /cuneiform/],
    ['Metatarsals', 2, 3, /metatarsal/],
    ['Toe bones (phalanges)', 2, 3, /toe/],
    ["Adam's apple (thyroid cartilage)", 2, 3, /thyroid cartilage/],
    ['Hyoid bone', 3, 3, /hyoid/],
  ],
  muscles: [
    ['Achilles tendon', 1, 3, /calcaneal tendon/],
    ['Deltoid', 1, 3, /deltoid/],
    ['Chest muscle (pectoralis major)', 1, 3, /pectoralis major/],
    ['Biceps', 1, 3, /biceps brachii/],
    ['Triceps', 1, 3, /triceps brachii/],
    ['Abs (rectus abdominis)', 1, 3, /rectus abdominis/],
    ['Glutes (gluteus maximus)', 1, 3, /gluteus maximus/],
    ['Quadriceps', 1, 2, /rectus femoris|vastus/],
    ['Hamstrings', 1, 2, /biceps femoris|semitendinosus|semimembranosus/],
    ['Calf muscle (gastrocnemius)', 1, 3, /gastrocnemius/],
    ['Trapezius', 1, 3, /trapezius/],
    ['Lats (latissimus dorsi)', 1, 3, /latissimus dorsi/],
    ['Diaphragm', 1, 3, /diaphragm/],
    ['Obliques (external oblique)', 2, 3, /external oblique/],
    ['Sartorius', 2, 3, /sartorius/],
    ['Soleus', 2, 3, /soleus/],
    ['Shin muscle (tibialis anterior)', 2, 3, /tibialis anterior/],
    ['Neck muscle (sternocleidomastoid)', 2, 3, /sternocleidomastoid/],
    ['Chewing muscle (masseter)', 2, 3, /masseter/],
    ['Temporalis', 2, 3, /^temporalis/],
    ['Gluteus medius', 2, 3, /gluteus medius/],
    ['Serratus anterior', 2, 3, /serratus anterior/],
    ['Brachioradialis', 2, 3, /brachioradialis/],
    ['Intercostal muscles', 2, 3, /intercostal/],
    ['Rotator cuff', 2, 2, /supraspinatus|infraspinatus|teres minor|subscapularis/],
    ['Adductors', 2, 2, /adductor (brevis|longus|magnus|minimus)|pectineus/],
    ['Hip flexors (iliopsoas)', 2, 2, /psoas major|iliacus/],
    ['Rhomboids', 2, 2, /rhomboid/],
    ['Erector spinae', 2, 2, /iliocostalis|longissimus|spinalis/],
    ['Forehead muscle (frontalis)', 2, 3, /frontalis/],
    ['Eye muscle (orbicularis oculi)', 2, 3, /orbicularis oculi/],
    ['Mouth muscle (orbicularis oris)', 2, 3, /orbicularis oris/],
    ['IT band (iliotibial tract)', 2, 3, /iliotibial/],
  ],
  organs: [
    ['Heart', 1, 1, /wall of heart|valve|papillary|coronary|cardiac vein|veins of ventricle/],
    ['Heart', 2, 3, /wall of heart|valve|papillary/],
    ['Lungs', 1, 2, /lobe of lung/],
    ['Upper lobe of the lung', 3, 3, /upper lobe of lung/],
    ['Middle lobe of the lung', 3, 3, /middle lobe of lung/],
    ['Lower lobe of the lung', 3, 3, /lower lobe of lung/],
    ['Windpipe (trachea)', 1, 1, /trachea|bronchus/],
    ['Windpipe (trachea)', 2, 3, /trachea/],
    ['Bronchi', 2, 3, /bronchus/],
    ['Food pipe (esophagus)', 1, 3, /esophagus/],
    ['Liver', 1, 3, /^liver/],
    ['Stomach', 1, 3, /^stomach/],
    ['Gallbladder', 2, 3, /gallbladder/],
    ['Pancreas', 2, 3, /pancrea/],
    ['Spleen', 2, 3, /^spleen/],
    ['Kidneys', 1, 3, /^kidney/],
    ['Adrenal glands', 3, 3, /adrenal/],
    ['Bladder', 1, 3, /urinary bladder/],
    ['Ureters', 2, 3, /ureter/],
    ['Urethra', 3, 3, /urethra/],
    ['Small intestine', 1, 2, /duodenum|jejunum|ileum/],
    ['Duodenum', 3, 3, /duodenum/],
    ['Jejunum', 3, 3, /jejunum/],
    ['Ileum', 3, 3, /ileum/],
    ['Appendix', 1, 3, /appendix/],
    ['Rectum', 2, 3, /rectum/],
    ['Large intestine (colon)', 1, 3, /colon|taenia|rectum/],
    ['Thymus', 3, 3, /thymus/],
    ['Prostate', 2, 3, /prostate/],
    ['Epididymis', 3, 3, /epididymis/],
    ['Testicles', 1, 3, /testis|epididymis/],
    ['Penis', 1, 3, /penis/],
    ['Vas deferens', 3, 3, /deferent/],
    ['Seminal vesicles', 3, 3, /seminal/],
    ['Eyes', 1, 3, /eyeball/],
    ['Ears', 1, 3, /^ear$/],
    ['Lips', 1, 3, /labial/],
    ['Gums', 2, 3, /gingiva/],
    ['Aorta', 1, 3, /aorta/],
    ['Coronary arteries', 2, 3, /coronary artery/],
    ['Cardiac veins', 3, 3, /cardiac vein|coronary sinus|veins of ventricle/],
    ['Pulmonary artery', 2, 3, /pulmonary artery/],
    ['Pulmonary veins', 2, 3, /pulmonary vein/],
    ['Superior vena cava', 2, 3, /superior vena cava/],
    ['Inferior vena cava', 2, 3, /inferior vena cava/],
    ['Carotid artery', 2, 3, /carotid/],
    ['Jugular vein', 2, 3, /jugular/],
    ['Iliac arteries', 3, 3, /iliac artery/],
    ['Iliac veins', 3, 3, /iliac vein/],
    ['Renal artery', 3, 3, /renal artery/],
    ['Renal vein', 3, 3, /renal vein/],
    ['Subclavian artery', 3, 3, /subclavian artery/],
    ['Subclavian vein', 3, 3, /subclavian vein/],
    ['Brachiocephalic artery', 3, 3, /brachiocephalic artery/],
    ['Brachiocephalic veins', 3, 3, /brachiocephalic vein/],
    ['Mesenteric arteries', 3, 3, /mesenteric artery/],
    ['Superior mesenteric vein', 3, 3, /mesenteric vein/],
    ['Celiac trunk', 3, 3, /celiac/],
    ['Splenic artery', 3, 3, /splenic artery/],
    ['Splenic vein', 3, 3, /splenic vein/],
    ['Hepatic artery', 3, 3, /hepatic artery/],
    ['Gastric artery', 3, 3, /gastric artery/],
  ],
  brain: [
    ['Cerebellum', 1, 3, /cerebellum/],
    ['Brainstem', 1, 2, /midbrain|pons|^medulla|colliculus/],
    ['Midbrain', 3, 3, /midbrain|colliculus/],
    ['Pons', 3, 3, /^pons/],
    ['Medulla oblongata', 3, 3, /^medulla/],
    ['Motor cortex (precentral gyrus)', 3, 3, /precentral/],
    ['Sensory cortex (postcentral gyrus)', 3, 3, /postcentral/],
    ['Cingulate gyrus', 3, 3, /cingulate/],
    // The regions the build cuts out of the model's own parts (CARVE in scripts/build-body.py).
    ['Primary visual cortex', 3, 3, /primary visual cortex/],
    ["Broca's area", 3, 3, /broca/i],
    ["Wernicke's area", 3, 3, /wernicke/i],
    // Easy and Medium ask for the lobes, Hard for the folds they are made of.
    ['Frontal lobe', 1, 2, /frontal gyrus|precentral|orbital gyri|broca/i],
    ['Parietal lobe', 1, 2, /postcentral|parietal|supramarginal|angular/],
    ['Temporal lobe', 1, 2, /temporal gyrus|fusiform|parahippocampal|wernicke/i],
    ['Occipital lobe', 1, 2, /occipital lobe|visual cortex/],
    ['Superior frontal gyrus', 3, 3, /superior frontal/],
    ['Middle frontal gyrus', 3, 3, /middle frontal/],
    ['Inferior frontal gyrus', 3, 3, /inferior frontal/],
    ['Orbitofrontal cortex (orbital gyri)', 3, 3, /orbital gyri/],
    ['Superior parietal lobule', 3, 3, /superior parietal/],
    ['Supramarginal gyrus', 3, 3, /supramarginal/],
    ['Angular gyrus', 3, 3, /angular/],
    ['Auditory cortex (superior temporal gyrus)', 3, 3, /superior temporal/],
    ['Middle temporal gyrus', 3, 3, /middle temporal/],
    ['Inferior temporal gyrus', 3, 3, /inferior temporal/],
    ['Fusiform gyrus', 3, 3, /fusiform/],
    ['Parahippocampal gyrus', 3, 3, /parahippocampal/],
    // What is left of the occipital lobe without the primary visual cortex.
    ['Visual association cortex', 3, 3, /occipital lobe/],
    ['Corpus callosum', 2, 3, /callosum/],
    ['Thalamus', 2, 3, /^thalamus/],
    ['Pituitary gland', 2, 3, /pituitary/],
    ['Hippocampus', 2, 3, /^hippocampus/],
    ['Amygdala', 2, 3, /amygdala/],
    ['Optic chiasm', 3, 3, /optic chiasm/],
    ['Optic tract', 3, 3, /optic tract/],
    ['Optic nerve', 2, 3, /optic/],
    ['Hypothalamus', 3, 3, /hypothalamus|mammillary|tuber cinereum/],
    ['Pineal gland', 3, 3, /pineal/],
    ['Caudate nucleus', 3, 3, /caudate/],
    ['Putamen', 3, 3, /putamen/],
    ['Globus pallidus', 3, 3, /pallidus/],
    ['Lateral ventricles', 3, 3, /lateral ventricle/],
    ['Third ventricle', 3, 3, /third ventricle/],
    ['Fourth ventricle', 3, 3, /fourth ventricle/],
    ['Fornix', 3, 3, /fornix/],
    ['Insula', 3, 3, /insula/],
  ],
};

/** A part's name without its side and the dataset's own marks: "left fifth rib" is "fifth rib". */
export function baseName(partName: string): string {
  return partName.replace(/\b(left|right) /g, '').replace(/, nsn$/, '').replace(/^set of /, '').trim();
}

function capitalize(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

/** A part's own name, for a part no structure covers: "Left fifth rib". */
export function partLabel(partName: string): string {
  return capitalize(partName.replace(/, nsn$/, '').replace(/^set of /, ''));
}

// A muscle or bone no rule names is its own structure at Hard, with its heads
// and parts as one: "long head of biceps femoris" is "Biceps femoris".
function ownName(base: string): string {
  const whole = base.match(/^.* (?:head|part|belly) of (.+)$/);
  return capitalize(whole ? whole[1] : base);
}

/** The structure a part belongs to at a level, or null if nothing is asked about it there. */
export function structureOf(part: PartInfo, level: Level): Structure | null {
  const system = SYSTEM_OF[part.layer];
  if (!system) return null;
  const base = baseName(part.name);
  for (const [name, min, max, match] of RULES[system]) {
    if (level >= min && level <= max && match.test(base)) return { name, system };
  }
  if (level === 3 && (system === 'skeleton' || system === 'muscles')) return { name: ownName(base), system };
  return null;
}

/** What to call a part when it is tapped: its most exact structure, else its own name. */
export function describe(part: PartInfo): string {
  return structureOf(part, 3)?.name ?? partLabel(part.name);
}

export interface Entry extends Structure {
  parts: string[];
}

/** Every structure of a level, with the parts that make it up. */
export function entries(parts: readonly PartInfo[], level: Level): Entry[] {
  const byName = new Map<string, Entry>();
  for (const part of parts) {
    const structure = structureOf(part, level);
    if (!structure) continue;
    const key = structure.system + ':' + structure.name;
    let entry = byName.get(key);
    if (!entry) byName.set(key, (entry = { ...structure, parts: [] }));
    entry.parts.push(part.id);
  }
  return [...byName.values()];
}
