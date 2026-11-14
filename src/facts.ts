// What the game tells you about a structure once its question is answered,
// and what Find by Function asks about it (CLUES, at the end).
// A structure without an entry here just shows nothing: fill them in as you go
// (`npm run missing-facts` lists the ones left).
export interface Fact {
  /** What it is or does, in one plain sentence. */
  does: string;
  /** Something surprising about it, in one sentence. */
  fun: string;
}

// By structure name, exactly as in RULES in src/structures.ts. A name that
// exists at several levels ("Ribs") has one entry for all of them.
export const FACTS: Record<string, Fact> = {
  'Thigh bone (femur)': {
    does: 'It carries your weight from the hip to the knee, and anchors the big muscles that move the leg.',
    fun: 'It is the longest and strongest bone in the body, about a quarter of your height.',
  },
  'Ribs': {
    does: 'They form a cage that protects the heart and lungs and moves as you breathe.',
    fun: 'Most people have 12 pairs, and the lowest two pairs do not reach the breastbone at the front.',
  },
  'Parietal lobe': {
    does: 'It handles touch, body position and your sense of where things are in space.',
    fun: 'Damage to one side can make a person ignore the opposite half of the world around them.',
  },
  'Frontal lobe': {
    does: 'It handles planning, decisions, self-control and voluntary movement.',
    fun: 'It is the largest lobe of the brain, and one of the last parts to finish maturing, in the mid-twenties.',
  },
  'Spine': {
    does: 'It holds your body upright, lets you bend and twist, and protects the spinal cord.',
    fun: 'It starts out as 33 vertebrae, and the lowest ones fuse together to form the sacrum and tailbone.',
  },
  'Eyes': {
    does: 'They turn light into signals that the brain reads as pictures.',
    fun: 'The image that lands on the back of each eye is upside down, and the brain flips it the right way up.',
  },
  'Diaphragm': {
    does: 'This dome-shaped muscle under the lungs pulls down to draw air in each time you breathe.',
    fun: 'Hiccups happen when it suddenly spasms and your vocal cords snap shut.',
  },
  'Collarbone (clavicle)': {
    does: 'It braces the shoulder out from the chest and links the arm to the rest of the skeleton.',
    fun: 'It is one of the most often broken bones, usually from a fall onto the shoulder or an outstretched hand.',
  },
  'Lats (latissimus dorsi)': {
    does: 'These broad back muscles pull your arms down and back, as in climbing or swimming.',
    fun: 'They stretch from the lower spine all the way up to the upper arm, and are among the widest muscles in the body.',
  },
  'Abs (rectus abdominis)': {
    does: 'This muscle bends your trunk forward and helps hold your belly in.',
    fun: 'The "six-pack" is this muscle split by bands of tissue; everyone has them, but fat can hide them.',
  },
  'Shoulder blade (scapula)': {
    does: 'This flat, triangular bone links the upper arm to the collarbone and gives shoulder muscles a base.',
    fun: 'It is held against the back by muscles alone, with no true joint to the ribs.',
  },
  'Appendix': {
    does: 'It is a small pouch at the start of the large intestine, and its exact job is still debated.',
    fun: 'People live perfectly well without it, and doctors remove it when it becomes infected.',
  },
  'Large intestine (colon)': {
    does: 'It absorbs water and salts from the leftovers of your food and turns them into stool.',
    fun: 'It is about 1.5 metres long and home to trillions of bacteria.',
  },
  'Bladder': {
    does: 'It stores urine until you are ready to go to the toilet.',
    fun: 'A healthy adult bladder can comfortably hold roughly half a litre.',
  },
  'Hip bone': {
    does: 'It is the large pelvic bone that holds the hip socket and carries the weight of your upper body.',
    fun: 'Each one starts as three separate bones, which fuse together as you grow.',
  },
  'Penis': {
    does: 'It carries urine out of the body and delivers sperm during reproduction.',
    fun: 'Many mammals have a bone in it, but humans do not.',
  },
  'Testicles': {
    does: 'They make sperm and the hormone testosterone.',
    fun: 'They hang outside the body because sperm develop best a little cooler than body temperature.',
  },
  'Glutes (gluteus maximus)': {
    does: 'This is the largest buttock muscle, driving your hip backward when you stand up, climb or run.',
    fun: 'It is the largest muscle in the human body.',
  },
  'Hamstrings': {
    does: 'These muscles at the back of the thigh bend the knee and pull the leg backward.',
    fun: 'The name comes from butchers, who hung hams by the long tendons here.',
  },
  'Foot bones': {
    does: 'They form arches that carry your weight and spring you forward as you walk.',
    fun: 'Each foot has 26 bones, so your two feet hold about a quarter of all the bones in your body.',
  },
  'Upper arm bone (humerus)': {
    does: 'It is the single long bone of the upper arm, linking the shoulder to the elbow.',
    fun: 'The "funny bone" you bang is really a nerve passing just behind the lower end of this bone.',
  },
  'Forearm bones (radius and ulna)': {
    does: 'These two bones let you bend the elbow and turn your palm up and down.',
    fun: 'When you turn your palm over, the radius rolls across the ulna.',
  },
  'Hand bones': {
    does: 'They give the hand its strength and its fine control for gripping and handling things.',
    fun: 'Each hand has 27 bones, which is more than a quarter of those in the whole body.',
  },
  'Shinbone (tibia)': {
    does: 'It is the thick bone at the front of the lower leg, and it takes most of your weight below the knee.',
    fun: 'It is the second longest bone in the body, after the thigh bone.',
  },
  'Fibula': {
    does: 'This slim bone beside the shinbone steadies the ankle and anchors muscles of the lower leg.',
    fun: 'It carries very little body weight, so surgeons can take a piece of it to repair other bones.',
  },
  'Kneecap (patella)': {
    does: 'It sits in front of the knee, shielding the joint and helping the thigh muscles straighten the leg.',
    fun: 'A baby\'s kneecap is soft cartilage at first and turns to bone over the first few years of life.',
  },
  'Achilles tendon': {
    does: 'It joins the calf muscles to the heel bone, letting you push off when you walk, run or jump.',
    fun: 'It is the thickest and strongest tendon in the body.',
  },
  'Trapezius': {
    does: 'This kite-shaped muscle lifts and steadies the shoulder blades and helps hold your head up.',
    fun: 'Its name comes from its shape: the left and right muscles together form a trapezoid.',
  },
  'Deltoid': {
    does: 'This rounded cap of muscle raises your arm to the front, the side and the back.',
    fun: 'Its name comes from the Greek letter delta, which is shaped like a triangle.',
  },
  'Chest muscle (pectoralis major)': {
    does: 'It pulls the arm across the chest and turns it inward, as in throwing or pushing.',
    fun: 'Its name comes from the Latin word for chest, pectus.',
  },
  'Aorta': {
    does: 'It is the main artery of the body, carrying blood from the heart out to everything else.',
    fun: 'It is the largest artery in the body, and every beat of the heart pushes blood through it.',
  },
  'Biceps': {
    does: 'It bends the elbow and turns the forearm so that your palm faces up.',
    fun: 'Its name means "two heads", because it has two tendons attached at the shoulder.',
  },
  'Triceps': {
    does: 'It straightens the elbow, doing the opposite job to the biceps.',
    fun: 'Its name means "three heads", and it makes up most of the muscle at the back of the upper arm.',
  },
  'Heart': {
    does: 'It pumps blood around the body, carrying oxygen and food to every part.',
    fun: 'It beats about 100,000 times a day, without ever stopping to rest.',
  },
  'Quadriceps': {
    does: 'These four muscles on the front of the thigh straighten the knee, as in kicking or standing up.',
    fun: 'Its name means "four heads", one for each of its four parts.',
  },
  'Calf muscle (gastrocnemius)': {
    does: 'It is the bulging muscle of the calf that lifts your heel when you walk, run or jump.',
    fun: 'Its name comes from Greek words meaning "belly of the leg".',
  },
  'Skull': {
    does: 'It protects the brain and gives the face its shape.',
    fun: 'Of its 22 bones, only the lower jaw can move.',
  },
  'Jawbone (mandible)': {
    does: 'It is the lower jaw, and it moves when you chew and speak.',
    fun: 'It is the largest and strongest bone of the face.',
  },
  'Ears': {
    does: 'They catch sounds and also help your body keep its balance.',
    fun: 'Inside each ear are the three smallest bones in the body.',
  },
  'Teeth': {
    does: 'They bite and grind your food and help shape the sounds of speech.',
    fun: 'The enamel that covers them is the hardest substance in the body.',
  },
  'Lips': {
    does: 'They seal the mouth, help form words and are very sensitive to touch.',
    fun: 'They are much more sensitive to touch than most other skin.',
  },
  'Brainstem': {
    does: 'It links the brain to the spinal cord and controls breathing, heartbeat and swallowing.',
    fun: 'It keeps you breathing even while you are fast asleep.',
  },
  'Cerebellum': {
    does: 'It fine-tunes your movements and balance so they are smooth and coordinated.',
    fun: 'It is only a small part of the brain by volume, yet it holds more than half of the brain\'s nerve cells.',
  },
  'Food pipe (esophagus)': {
    does: 'This muscular tube carries swallowed food from the throat down to the stomach.',
    fun: 'Waves of muscle push food along it, so you can swallow even while upside down.',
  },
  'Stomach': {
    does: 'It churns food with acid and enzymes into a soupy mix before passing it on.',
    fun: 'Its lining makes a thick coat of mucus so the stomach does not digest itself.',
  },
  'Liver': {
    does: 'It cleans the blood, makes bile to digest fat and stores energy.',
    fun: 'It can regrow after part of it is removed.',
  },
  'Kidneys': {
    does: 'They filter your blood, removing waste and extra water as urine.',
    fun: 'You can live a healthy life with just one.',
  },
  'Small intestine': {
    does: 'It is where most digestion finishes and most nutrients pass into the blood.',
    fun: 'It is the longest part of the digestive tract, several metres of coiled tube.',
  },
  'Temporal lobe': {
    does: 'It processes sound and memory, and helps you understand speech.',
    fun: 'It is named after the temple of the head, which is where it sits.',
  },
  'Occipital lobe': {
    does: 'It is the brain\'s visual centre, making sense of what your eyes see.',
    fun: 'It is the smallest of the four main lobes, at the very back of the brain.',
  },
  'Lungs': {
    does: 'They take oxygen from the air into the blood and pass carbon dioxide back out.',
    fun: 'The left lung is smaller than the right to leave room for the heart.',
  },
  'Windpipe (trachea)': {
    does: 'This tube carries air from the throat down towards the lungs.',
    fun: 'It is held open by C-shaped rings of cartilage.',
  },
  'Breastbone (sternum)': {
    does: 'It is the flat bone in the middle of your chest, where most of your ribs attach.',
    fun: 'Its lower tip, the xiphoid process, is named after the Greek word for sword.',
  },
  'Thoracic vertebrae': {
    does: 'These 12 vertebrae form the upper and middle back, and each one holds a pair of ribs.',
    fun: 'They are the only vertebrae that connect to ribs.',
  },
  'Pancreas': {
    does: 'It makes enzymes that digest food and insulin that controls the sugar in your blood.',
    fun: 'Its name comes from Greek words meaning "all flesh".',
  },
  'Intervertebral discs': {
    does: 'These tough cushions between the vertebrae absorb shocks and let the spine bend.',
    fun: 'Each has a soft, jelly-like centre inside a firm outer ring.',
  },
  'Inferior vena cava': {
    does: 'It is the body\'s largest vein, carrying blood from the legs and belly back to the heart.',
    fun: 'Blood from your feet climbs it against gravity, helped by the squeeze of your leg muscles.',
  },
  'Cervical vertebrae': {
    does: 'These seven vertebrae support the head and let the neck turn and nod.',
    fun: 'A giraffe has the same number of neck vertebrae as you do, just much longer ones.',
  },
  'Lumbar vertebrae': {
    does: 'These five large vertebrae in the lower back carry most of the weight of the upper body.',
    fun: 'They are the biggest vertebrae in the spine.',
  },
  'Obliques (external oblique)': {
    does: 'It runs diagonally along the side of the belly, twisting and bending the trunk.',
    fun: 'Its fibres run in the same direction as your fingers when your hands are in coat pockets.',
  },
  'Rhomboids': {
    does: 'They pull the shoulder blades together and hold them against the ribs.',
    fun: 'They are named after their diamond shape, a rhombus.',
  },
  'Serratus anterior': {
    does: 'It pulls the shoulder blade forward around the ribs, as when you punch or push.',
    fun: 'Its edge on the ribs looks like the teeth of a saw, which is what "serratus" means.',
  },
  'Neck muscle (sternocleidomastoid)': {
    does: 'It turns and tilts the head, and helps lift it when you lie on your back.',
    fun: 'Its name lists where it attaches: the sternum, the clavicle and the mastoid bone behind the ear.',
  },
  'Rotator cuff': {
    does: 'These four small muscles hold the upper arm in its shoulder socket and rotate it.',
    fun: 'Its tendons are among the most commonly injured parts of the shoulder.',
  },
  'Pituitary gland': {
    does: 'It releases hormones that control growth and tell many other glands what to do.',
    fun: 'It is only about the size of a pea, yet it is often called the master gland.',
  },
  'Rectum': {
    does: 'It stores stool until you can get to a toilet.',
    fun: 'It is the last stretch of the large intestine, about 12 centimetres long.',
  },
  'Ureters': {
    does: 'These two thin tubes carry urine from the kidneys down to the bladder.',
    fun: 'Waves of muscle push the urine along, so it flows even when you lie down.',
  },
  'Sacrum': {
    does: 'It is the triangle of fused vertebrae wedged between the hip bones at the base of the spine.',
    fun: 'It forms from five separate bones that fuse together as you grow up.',
  },
  'Hip flexors (iliopsoas)': {
    does: 'These muscles lift your thigh toward your chest, as when you climb stairs.',
    fun: 'In beef, the psoas part of this muscle is the tender cut known as the fillet.',
  },
  'Gluteus medius': {
    does: 'It sits on the side of the hip and keeps your pelvis level when you stand on one leg.',
    fun: 'When it is weak, the hip drops with each step and the walk becomes a visible waddle.',
  },
  'Sartorius': {
    does: 'It crosses the thigh diagonally, bending the hip and knee, as when you sit cross-legged.',
    fun: 'It is the longest muscle in the body, and its name comes from the Latin for tailor.',
  },
  'Adductors': {
    does: 'These inner-thigh muscles squeeze your legs together.',
    fun: 'A pulled groin is usually a strain of these muscles.',
  },
  'Shin muscle (tibialis anterior)': {
    does: 'It lifts the front of your foot so your toes clear the ground as you step.',
    fun: 'When it is weak, the foot drags or slaps down, a problem called foot drop.',
  },
  'Soleus': {
    does: 'This flat calf muscle lies under the gastrocnemius and pushes your heel up when you stand or walk.',
    fun: 'It is nicknamed the second heart, because its squeeze helps push blood in the leg veins back upward.',
  },
  'Erector spinae': {
    does: 'This group of muscles runs along the spine, keeping you upright and straightening your back.',
    fun: 'Its name literally means "spine raiser".',
  },
  'Toe bones (phalanges)': {
    does: 'They help you balance and push off the ground when you walk.',
    fun: 'The big toe has two of these bones, while each of the other toes has three.',
  },
  'Radius': {
    does: 'It is the forearm bone on the thumb side, and it rolls over the ulna when you turn your palm.',
    fun: 'Its name is the Latin word for the spoke of a wheel.',
  },
  'Ulna': {
    does: 'It is the forearm bone on the little-finger side and forms the main part of the elbow joint.',
    fun: 'The bony point of the elbow that you rest on is the top of this bone.',
  },
  'Wrist bones (carpals)': {
    does: 'These eight small bones make up the wrist and let the hand bend in many directions.',
    fun: 'They are arranged in two rows of four.',
  },
  'Finger bones (phalanges)': {
    does: 'They let your fingers curl to grip and make precise movements.',
    fun: 'Each finger has three of these bones, but the thumb has only two.',
  },
  'Metacarpals': {
    does: 'These five long bones form the palm and link the wrist to the fingers.',
    fun: 'The knuckles you see on a clenched fist are the ends of these bones.',
  },
  'Ankle bones (tarsals)': {
    does: 'These seven bones make up the ankle and the back half of the foot.',
    fun: 'The largest of them is the heel bone.',
  },
  'Heel bone (calcaneus)': {
    does: 'It forms the heel and takes the first impact of each step.',
    fun: 'It is the largest bone in the foot.',
  },
  'Metatarsals': {
    does: 'These five long bones form the middle of the foot, between the ankle and the toes.',
    fun: 'They bear much of your weight when you push off the ground.',
  },
  'Thalamus': {
    does: 'It relays signals from most of your senses to the right parts of the cortex.',
    fun: 'Smell is the main sense that mostly skips it.',
  },
  'Coronary arteries': {
    does: 'They wrap around the heart and bring blood to the heart muscle itself.',
    fun: 'The heart muscle feeds from them, not from the blood passing through its chambers.',
  },
  'Brachioradialis': {
    does: 'It bends the elbow, especially when your thumb points up, as in lifting a mug.',
    fun: 'It is the muscle on top of the forearm that bulges when you do a hammer curl.',
  },
  'Carotid artery': {
    does: 'It carries blood up the neck to the head and brain.',
    fun: 'You can feel a pulse in it at the side of your neck.',
  },
  'Forehead muscle (frontalis)': {
    does: 'It lifts your eyebrows and wrinkles your forehead.',
    fun: 'The lines on your forehead are skin folding as this muscle tightens.',
  },
  'Eye muscle (orbicularis oculi)': {
    does: 'It circles the eye and closes the eyelids when you blink or squint.',
    fun: 'A real smile makes it crinkle the skin at the corners of your eyes.',
  },
  'Mouth muscle (orbicularis oris)': {
    does: 'It circles the mouth and closes and purses the lips.',
    fun: 'It is the muscle you use to whistle, kiss and drink through a straw.',
  },
  'Superior vena cava': {
    does: 'It carries blood from the head, neck and arms back to the heart.',
    fun: 'It is short, only about seven centimetres long.',
  },
  'Jugular vein': {
    does: 'These neck veins drain blood from the head back toward the heart.',
    fun: 'The external jugular vein can bulge visibly on your neck when you strain or cry.',
  },
  'Chewing muscle (masseter)': {
    does: 'It is the strong muscle of the cheek that closes the jaw to chew.',
    fun: 'It is one of the strongest muscles for its size, and you can feel it bulge when you clench your teeth.',
  },
  'Temporalis': {
    does: 'This fan-shaped muscle on the side of the head helps close the jaw.',
    fun: 'You can feel it move at your temple when you chew.',
  },
  'Optic nerve': {
    does: 'It carries signals from the eye to the brain.',
    fun: 'Where it leaves the eye there are no light-sensing cells, which creates a blind spot.',
  },
  'Frontal bone': {
    does: 'It forms the forehead and the roof of the eye sockets.',
    fun: 'At birth it is two halves, which fuse together in early childhood.',
  },
  'Occipital bone': {
    does: 'It forms the back and base of the skull, with a large hole for the spinal cord.',
    fun: 'The hole is called the foramen magnum, which is Latin for "great opening".',
  },
  'Temporal bone': {
    does: 'It forms the side and base of the skull and houses the parts of the ear.',
    fun: 'It holds the three tiny bones of the middle ear, the smallest in the body.',
  },
  'Parietal bone': {
    does: 'Two of these curved bones form the roof and upper sides of the skull.',
    fun: 'They meet along the top of the head in a zigzag joint called the sagittal suture.',
  },
  'Cheekbone (zygomatic bone)': {
    does: 'It forms the prominence of the cheek and part of the eye socket.',
    fun: 'Its Greek root, "zygon", means yoke, and the bone is also called the zygoma.',
  },
  'Nasal bone': {
    does: 'Two small bones form the bridge of the nose.',
    fun: 'Only the bridge is bone; the rest of the nose is cartilage.',
  },
  'Upper jaw (maxilla)': {
    does: 'It forms the upper jaw, holds the upper teeth and shapes part of the nose and eye sockets.',
    fun: 'It contains the largest of the sinuses, the air spaces in the skull.',
  },
  'Adam\'s apple (thyroid cartilage)': {
    does: 'It shields the voice box at the front of the throat.',
    fun: 'It often sticks out more in men, which is why it is called the Adam\'s apple.',
  },
  'IT band (iliotibial tract)': {
    does: 'It is a thick band of tissue down the outer thigh that steadies the hip and knee.',
    fun: 'Runners and cyclists often get a sore knee when it rubs against the bone.',
  },
  'Gums': {
    does: 'They are the soft tissue that hugs the teeth and seals around their base.',
    fun: 'Gum disease is one of the most common reasons adults lose teeth.',
  },
  'Pulmonary artery': {
    does: 'It carries blood low in oxygen from the heart to the lungs.',
    fun: 'Almost all arteries carry oxygen-rich blood, and this one is the main exception.',
  },
  'Pulmonary veins': {
    does: 'These carry freshly oxygenated blood from the lungs back to the heart.',
    fun: 'They are unusual veins, because they carry oxygen-rich blood.',
  },
  'Spleen': {
    does: 'It filters old red blood cells out of the blood and helps fight infection.',
    fun: 'You can live without it, though you get some infections more easily.',
  },
  'Gallbladder': {
    does: 'It stores bile from the liver and squeezes it out to help digest fat.',
    fun: 'This small pear-shaped bag can be removed, and people live normally without it.',
  },
  'Hippocampus': {
    does: 'It helps turn experiences into lasting memories and helps you find your way around.',
    fun: 'Its name is Greek for seahorse, which it resembles.',
  },
  'Amygdala': {
    does: 'This almond-shaped cluster of cells helps process emotions, especially fear.',
    fun: 'Its name is the Greek word for almond.',
  },
  'Bronchi': {
    does: 'These branching tubes carry air from the windpipe into each lung.',
    fun: 'They keep dividing into smaller tubes, a network often called the bronchial tree.',
  },
  'Corpus callosum': {
    does: 'It is a thick band of nerve fibres connecting the left and right halves of the brain.',
    fun: 'It holds roughly 200 million nerve fibres.',
  },
  'Prostate': {
    does: 'This walnut-sized gland makes fluid that nourishes and carries sperm.',
    fun: 'It sits just below the bladder and wraps around the tube that carries urine out.',
  },
  'Intercostal muscles': {
    does: 'They sit between the ribs and move them as you breathe.',
    fun: 'The word "Intercostal" simply means "between the ribs".',
  },
  'Sphenoid bone': {
    does: 'It is a butterfly-shaped bone at the base of the skull that joins many of the other skull bones.',
    fun: 'It touches every other bone of the braincase.',
  },
  'Ethmoid bone': {
    does: 'It forms part of the inner wall and roof of the nose and the inner wall of the eye sockets.',
    fun: 'The word "Ethmoid" means sieve, because of its many tiny holes where smell nerves pass.',
  },
  'Hyoid bone': {
    does: 'This U-shaped bone in the neck anchors the tongue and helps in swallowing.',
    fun: 'It is the only bone in the body that does not touch another bone.',
  },
  'Lacrimal bone': {
    does: 'It is a thin bone in the inner eye socket, with a groove for the tear duct.',
    fun: 'It is the smallest bone of the face.',
  },
  'Vomer': {
    does: 'It is a thin bone that forms the lower part of the wall between the nostrils.',
    fun: 'Its name is Latin for ploughshare, the blade of a plough, which it resembles.',
  },
  'Incisors': {
    does: 'These front teeth cut food, as when you bite into an apple.',
    fun: 'Their name comes from the Latin for "to cut".',
  },
  'Canine teeth': {
    does: 'These pointed teeth tear food.',
    fun: 'They have the longest roots of all human teeth.',
  },
  'Premolars': {
    does: 'They sit between the canines and molars and crush and tear food.',
    fun: 'An adult has eight of them, while young children have none.',
  },
  'Molars': {
    does: 'These broad back teeth grind food.',
    fun: 'Wisdom teeth are the last molars to arrive, if they come at all.',
  },
  'Thymus': {
    does: 'It trains T cells, a kind of white blood cell, to fight germs.',
    fun: 'It is biggest in childhood, then shrinks and turns mostly to fat after puberty.',
  },
  'Pons': {
    does: 'It relays signals between the brain and cerebellum and helps control breathing and sleep.',
    fun: 'The word "Pons" is the Latin word for bridge.',
  },
  'Medulla oblongata': {
    does: 'It controls automatic functions such as heartbeat, breathing and blood pressure.',
    fun: 'It is only about three centimetres long.',
  },
  'Hypothalamus': {
    does: 'It keeps body temperature, hunger, thirst and sleep in balance.',
    fun: 'It is roughly the size of an almond.',
  },
  'Pineal gland': {
    does: 'It makes melatonin, a hormone that signals night and helps set your sleep rhythm.',
    fun: 'The philosopher Descartes called it the seat of the soul.',
  },
  'Duodenum': {
    does: 'It is the first part of the small intestine, where food mixes with bile and juices from the pancreas.',
    fun: 'Its name comes from the Latin for twelve, as it is about twelve finger-widths long.',
  },
  'Jejunum': {
    does: 'It is the middle part of the small intestine, where much of the food\'s goodness is absorbed.',
    fun: 'Its name comes from the Latin for empty, because it was found empty in dissections.',
  },
  'Ileum': {
    does: 'It is the last part of the small intestine, and it absorbs vitamin B12.',
    fun: 'A valve at its end stops the contents of the colon flowing back in.',
  },
  'Motor cortex (precentral gyrus)': {
    does: 'It sends the signals that make your muscles move on purpose.',
    fun: 'Its map of the body is distorted: hands and face get the most room.',
  },
  'Sensory cortex (postcentral gyrus)': {
    does: 'It receives touch signals from across the body.',
    fun: 'Its map of the body is distorted: lips and fingertips get the most room.',
  },
  'Upper lobe of the lung': {
    does: 'It is the top section of each lung.',
    fun: 'The right lung has three lobes, but the left has only two.',
  },
  'Middle lobe of the lung': {
    does: 'It is the middle section of the right lung.',
    fun: 'Only the right lung has one, because the left lung makes room for the heart.',
  },
  'Lower lobe of the lung': {
    does: 'It is the bottom section of each lung, resting on the diaphragm.',
    fun: 'The right lung has three lobes, but the left has only two.',
  },
  'Biceps femoris': {
    does: 'It is the outermost hamstring, bending the knee and pulling the leg backward.',
    fun: 'Its name means "two-headed muscle of the thigh".',
  },
  'Rectus femoris': {
    does: 'It is the part of the quadriceps that crosses the hip, so it lifts the thigh and straightens the knee.',
    fun: 'The word "Rectus" means straight, because its fibres run straight down the thigh.',
  },
  'Zygomaticus major': {
    does: 'It pulls the corners of the mouth up and back when you smile.',
    fun: 'It is the main muscle behind a smile, and it is attached to the cheekbone.',
  },
  'Buccinator': {
    does: 'It presses the cheek against the teeth, helping you chew, blow and suck.',
    fun: 'It is sometimes called the trumpeter\'s muscle.',
  },
  'Platysma': {
    does: 'It is a thin sheet of muscle under the skin of the neck that pulls the mouth corners down.',
    fun: 'You can see it tense as cords on your neck when you grimace.',
  },
  'Digastric': {
    does: 'It helps open the jaw and lifts the hyoid bone when you swallow.',
    fun: 'The word "Digastric" means two bellies, for its two muscle sections.',
  },
  'Brachialis': {
    does: 'It bends the elbow and lies beneath the biceps.',
    fun: 'It is called the workhorse of the elbow, because it works whether your palm faces up or down.',
  },
  'Celiac trunk': {
    does: 'It is an artery from the aorta that feeds the stomach, liver and spleen.',
    fun: 'The word "Celiac" comes from the Greek word for belly.',
  },
  'Brachiocephalic artery': {
    does: 'It branches off the aorta and splits to supply the right arm and the right side of the head.',
    fun: 'It exists only on the right side; on the left, those vessels come straight off the aorta.',
  },
  'Subclavian artery': {
    does: 'It carries blood out to the arm.',
    fun: 'Its name means "under the collarbone".',
  },
  'Subclavian vein': {
    does: 'It carries blood back from the arm toward the heart.',
    fun: 'Its name means "under the collarbone".',
  },
  'Brachiocephalic veins': {
    does: 'Two veins that join to form the superior vena cava, which empties into the heart.',
    fun: 'The left one is longer than the right.',
  },
  'Midbrain': {
    does: 'It helps control eye movements and reflexes to sights and sounds, and makes dopamine.',
    fun: 'The loss of its dopamine-making cells causes Parkinson\'s disease.',
  },
  'Cingulate gyrus': {
    does: 'It links emotion with action, and helps you notice mistakes and pain.',
    fun: 'Its name is Latin for belt: it wraps around the corpus callosum.',
  },
  'Primary visual cortex': {
    does: 'It is the first part of the cortex to receive signals from the eyes, and maps out what you see.',
    fun: 'It is also called the striate cortex, after a pale stripe in it that can be seen with the naked eye.',
  },
  'Broca\'s area': {
    does: 'It plans the movements of speech and helps you put words together into sentences.',
    fun: 'Paul Broca found it in 1861 in a patient who understood speech but could say only the word "tan".',
  },
  'Wernicke\'s area': {
    does: 'It helps you understand the words you hear and read.',
    fun: 'People with damage here can speak fluently, but what they say often makes little sense.',
  },
  'Superior frontal gyrus': {
    does: 'It helps plan complex movements and keeps information in mind while you work with it.',
    fun: 'Stimulating one spot on it during brain surgery once made a patient laugh.',
  },
  'Middle frontal gyrus': {
    does: 'It helps you hold things in mind, focus your attention and plan what to do next.',
    fun: 'Near its back end is an area that aims your eyes when you choose where to look.',
  },
  'Inferior frontal gyrus': {
    does: 'It helps you speak, and stop yourself from doing something you had started to do.',
    fun: 'In most people its left side holds Broca\'s area, which is needed for speech.',
  },
  'Orbitofrontal cortex (orbital gyri)': {
    does: 'It weighs up rewards and punishments to help you make choices.',
    fun: 'It sits right above the eye sockets, which are called orbits and give it its name.',
  },
  'Superior parietal lobule': {
    does: 'It combines sight and touch to keep track of where your body is and guide your reach.',
    fun: 'Damage here can leave people able to see an object clearly yet unable to reach for it accurately.',
  },
  'Supramarginal gyrus': {
    does: 'It helps you process the sounds of words and make sense of what you touch.',
    fun: 'It curves around the back end of the lateral sulcus, the deep groove along the side of the brain.',
  },
  'Angular gyrus': {
    does: 'It helps with reading, writing, arithmetic and making sense of language.',
    fun: 'Damage here can leave a person unable to tell left from right or to name their own fingers.',
  },
  'Auditory cortex (superior temporal gyrus)': {
    does: 'It receives sound signals from the ears and works out pitch, loudness and speech.',
    fun: 'It is laid out like a piano keyboard, with low notes at one end and high notes at the other.',
  },
  'Middle temporal gyrus': {
    does: 'It helps you understand the meaning of words and of what you see.',
    fun: 'It lies between two grooves that run the length of the temporal lobe.',
  },
  'Inferior temporal gyrus': {
    does: 'It helps you recognise objects by their shape and colour.',
    fun: 'It is the last stop of the "what" pathway, which carries sight forward from the back of the brain.',
  },
  'Fusiform gyrus': {
    does: 'It helps you recognise faces, and written words too.',
    fun: 'Damage here can leave people unable to recognise faces, even those of family and friends.',
  },
  'Parahippocampal gyrus': {
    does: 'It helps you recognise places and scenes, and feeds information to the hippocampus.',
    fun: 'One part of it responds more strongly to pictures of rooms and landscapes than to faces or objects.',
  },
  'Visual association cortex': {
    does: 'It builds on the first visual signals to work out colour, shape, depth and motion.',
    fun: 'Damage to one small part of it can leave a person seeing the world only in shades of grey.',
  },
  'Insula': {
    does: 'It senses the state of your body, such as heartbeat, hunger and pain, and processes taste.',
    fun: 'It is hidden from view, folded deep inside the groove on the side of the brain.',
  },
  'Caudate nucleus': {
    does: 'It helps you learn from rewards and plan movements towards a goal.',
    fun: 'Its name means "tailed": it has a long tail that curves around in the shape of a C.',
  },
  'Putamen': {
    does: 'It helps control movement, and learn habits and skills by practice.',
    fun: 'Its name is Latin for a shell or husk, like that of a nut.',
  },
  'Globus pallidus': {
    does: 'It works as a brake on movement, keeping unwanted motions in check.',
    fun: 'Its name is Latin for "pale globe": the many nerve fibres crossing it make it look pale.',
  },
  'Lateral ventricles': {
    does: 'These two fluid-filled chambers, one in each half of the brain, make most of the fluid that cushions it.',
    fun: 'The brain makes about half a litre of this fluid every day.',
  },
  'Third ventricle': {
    does: 'This narrow fluid-filled slit in the middle of the brain passes fluid on from the lateral ventricles.',
    fun: 'It lies between the two halves of the thalamus, which often touch each other across it.',
  },
  'Fourth ventricle': {
    does: 'This chamber between the brainstem and cerebellum lets the fluid out to flow around the brain.',
    fun: 'It is shaped like a tent, and its diamond-shaped floor is called the rhomboid fossa.',
  },
  'Fornix': {
    does: 'This arch of nerve fibres carries signals out of the hippocampus, and is important for memory.',
    fun: 'Its name is the Latin word for arch.',
  },
  'Optic chiasm': {
    does: 'Here the two optic nerves meet and half of their fibres cross to the other side.',
    fun: 'It is named after the Greek letter chi, which is written as an X.',
  },
  'Optic tract': {
    does: 'It carries sight signals from the optic chiasm to a relay station in the thalamus.',
    fun: 'Each one carries the opposite half of your view, with signals from both eyes.',
  },
};

export function factFor(structure: string): Fact | undefined {
  return FACTS[structure];
}

// What Find by Function asks: what a structure does, as the end of the question
// "Which part of the brain …?". Every structure of the brain has one, at every
// level, and no two are alike: a clue has to point at one structure only among
// those of its level.
export const CLUES: Record<string, string> = {
  'Frontal lobe': 'plans, decides and starts your movements',
  'Parietal lobe': 'feels touch and maps the space around you',
  'Temporal lobe': 'processes sound and understands speech',
  'Occipital lobe': 'makes sense of what your eyes see',
  'Cerebellum': 'keeps your movements smooth and balanced',
  'Brainstem': 'keeps you breathing and your heart beating',
  'Corpus callosum': 'connects the two halves of the brain',
  'Thalamus': 'relays most of your senses to the cortex',
  'Pituitary gland': 'releases hormones that direct other glands',
  'Hippocampus': 'turns experiences into lasting memories',
  'Amygdala': 'processes fear and other emotions',
  'Optic nerve': 'carries signals from the eye towards the brain',
  'Optic chiasm': 'lets half of each eye\'s fibres cross sides',
  'Optic tract': 'carries sight from the chiasm to the thalamus',
  'Midbrain': 'makes dopamine and turns your eyes by reflex',
  'Pons': 'relays signals from the cortex to the cerebellum',
  'Medulla oblongata': 'sets your heartbeat and blood pressure',
  'Hypothalamus': 'controls hunger, thirst and body temperature',
  'Pineal gland': 'makes melatonin to set your sleep rhythm',
  'Motor cortex (precentral gyrus)': 'sends the commands that move your muscles',
  'Sensory cortex (postcentral gyrus)': 'receives touch from all over the body',
  'Cingulate gyrus': 'notices mistakes and ties emotion to action',
  'Primary visual cortex': 'is the first part of the cortex to receive sight',
  'Broca\'s area': 'plans the movements of speech',
  'Wernicke\'s area': 'lets you understand spoken language',
  'Superior frontal gyrus': 'plans complex movements before you make them',
  'Middle frontal gyrus': 'holds things in mind while you work on them',
  'Inferior frontal gyrus': 'lets you stop yourself in the middle of an action',
  'Orbitofrontal cortex (orbital gyri)': 'judges how good or bad an outcome is',
  'Superior parietal lobule': 'guides your hand to what you reach for',
  'Supramarginal gyrus': 'processes the sounds that words are made of',
  'Angular gyrus': 'helps you read, write and do arithmetic',
  'Auditory cortex (superior temporal gyrus)': 'receives sound and works out its pitch',
  'Middle temporal gyrus': 'stores the meanings of words and things',
  'Inferior temporal gyrus': 'recognises objects by shape and colour',
  'Fusiform gyrus': 'recognises faces',
  'Parahippocampal gyrus': 'recognises places and scenes',
  'Visual association cortex': 'works out colour, shape and motion in what you see',
  'Insula': 'senses your heartbeat, hunger and taste',
  'Caudate nucleus': 'learns which actions pay off',
  'Putamen': 'learns habits and practised skills',
  'Globus pallidus': 'passes the basal ganglia\'s output to the thalamus',
  'Lateral ventricles': 'makes most of the fluid that cushions the brain',
  'Third ventricle': 'holds fluid in a slit between the two thalami',
  'Fourth ventricle': 'lets the fluid out to flow around the brain',
  'Fornix': 'carries signals out of the hippocampus',
};

export function clueFor(structure: string): string | undefined {
  return CLUES[structure];
}
